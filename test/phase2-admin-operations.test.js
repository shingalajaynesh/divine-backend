process.env.NODE_ENV = 'test';
import assert from 'node:assert/strict';
import test from 'node:test';
import { graphql } from 'graphql';
import schema from '../src/gql/schema/index.js';
import crypto from 'crypto';

// Setup Mock Data
const ADMIN_USER_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01';
const SUPER_ADMIN_USER_ID = 'sa0eebc99-9c0b-4ef8-bb6d-6bb9bd380a00';
const STAFF_USER_ID = 's0eebc99-9c0b-4ef8-bb6d-6bb9bd380a02';
const CENTER_ID = 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a04';
const ROLE_ID = 'r0eebc99-9c0b-4ef8-bb6d-6bb9bd380a05';
const PRODUCT_ID = 'p0eebc99-9c0b-4ef8-bb6d-6bb9bd380a06';
const PAYMENT_ID = 'pay0eebc-9c0b-4ef8-bb6d-6bb9bd380a07';

// Mock getAuth from firebase-admin/auth
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { mock } from 'node:test';

initializeApp({ projectId: 'mock-project-id' });

// Define token hashing locally for validation
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

// Global mock state to simulate DB records
let staffInvitations = [];
let users = [];
let auditLogs = [];
let inventoryMovements = [];
let products = [
  { id: PRODUCT_ID, title: 'Maternal Nutrition Pack', price: 99.0, inventoryCount: 50, centerId: CENTER_ID }
];
let payments = [];
let refunds = [];

// Reset database state before each scenario
const resetDbState = () => {
  staffInvitations = [];
  users = [];
  auditLogs = [];
  inventoryMovements = [];
  products = [
    { id: PRODUCT_ID, title: 'Maternal Nutrition Pack', price: 99.0, inventoryCount: 50, centerId: CENTER_ID }
  ];
  payments = [];
  refunds = [];
};

// Mock Sequelize Transaction Context
const mockSequelize = {
  transaction: async (cb) => {
    return cb({
      LOCK: { UPDATE: 'UPDATE' }
    });
  },
  authenticate: async () => {}
};

const mockModels = {
  Role: {
    findByPk: async (id) => {
      if (id === ROLE_ID) {
        return { id: ROLE_ID, name: 'Center Staff', roleType: 'STAFF' };
      }
      return null;
    }
  },
  Center: {
    findByPk: async (id) => {
      if (id === CENTER_ID) {
        return { id: CENTER_ID, name: 'Central Clinic' };
      }
      return null;
    }
  },
  User: {
    findOne: async ({ where }) => {
      const email = where.emailAddress?.toLowerCase();
      const uid = where.firebaseUid;
      const u = users.find(usr => (email && usr.emailAddress === email) || (uid && usr.firebaseUid === uid)) || null;
      if (u) {
        u.save = async () => u;
        u.toJSON = () => u;
      }
      return u;
    },
    create: async (data) => {
      const user = { ...data, save: async () => user, toJSON: () => user };
      users.push(user);
      return user;
    },
    findByPk: async (id) => {
      const u = users.find(usr => usr.id === id) || null;
      if (u) {
        u.save = async () => u;
        u.toJSON = () => u;
      }
      return u;
    }
  },
  StaffInvitation: {
    findOne: async ({ where }) => {
      const email = where.emailAddress?.toLowerCase();
      const token = where.token;
      const invite = staffInvitations.find(i => (email && i.emailAddress === email) || (token && i.token === token)) || null;
      if (invite) {
        invite.save = async () => invite;
        invite.toJSON = () => invite;
      }
      return invite;
    },
    create: async (data) => {
      const invite = {
        ...data,
        save: async () => invite,
        toJSON: () => invite
      };
      staffInvitations.push(invite);
      return invite;
    },
    findByPk: async (id) => {
      const invite = staffInvitations.find(i => i.id === id);
      if (invite) {
        invite.save = async () => invite;
        invite.toJSON = () => invite;
      }
      return invite || null;
    }
  },
  AdminAuditLog: {
    create: async (data) => {
      auditLogs.push(data);
      return data;
    }
  },
  Product: {
    findByPk: async (id) => {
      const p = products.find(prod => prod.id === id);
      if (p) {
        p.save = async () => p;
      }
      return p || null;
    }
  },
  InventoryMovement: {
    findOne: async ({ where }) => {
      const key = where.requestCorrelationId;
      return inventoryMovements.find(m => key && m.requestCorrelationId === key) || null;
    },
    create: async (data) => {
      inventoryMovements.push(data);
      return data;
    }
  },
  Payment: {
    findByPk: async (id) => {
      const pay = payments.find(p => p.id === id);
      if (pay) {
        pay.save = async () => pay;
      }
      return pay || null;
    }
  },
  PaymentRefund: {
    findOne: async ({ where }) => {
      const key = where.idempotencyKey;
      return refunds.find(r => key && r.idempotencyKey === key) || null;
    },
    create: async (data) => {
      refunds.push(data);
      return data;
    }
  },
  FinancialTransaction: {
    create: async (data) => {
      return data;
    }
  }
};

// Mock Firebase verifyIdToken
const mockAuth = getAuth();
mock.method(mockAuth, 'verifyIdToken', async (token) => {
  if (token === 'valid-token') {
    return { uid: 'fb-uid-123', email: 'test-staff@clinic.com', email_verified: true };
  }
  if (token === 'unverified-email') {
    return { uid: 'fb-uid-456', email: 'test-staff@clinic.com', email_verified: false };
  }
  if (token === 'mismatched-email') {
    return { uid: 'fb-uid-789', email: 'other-email@clinic.com', email_verified: true };
  }
  throw new Error('Invalid Firebase token');
});

// 1. Staff Creation & Invitation Suite
test('createStaff enforces duplicate invitation prevention and role escalation checks', async () => {
  resetDbState();

  const createStaffMutation = `
    mutation CreateStaff($emailAddress: String!, $displayName: String!, $roleId: ID!, $centerId: ID!) {
      createStaff(emailAddress: $emailAddress, displayName: $displayName, roleId: $roleId, centerId: $centerId) {
        id
        emailAddress
        token
        status
      }
    }
  `;

  // Scenario A: Duplicate invitation prevention
  staffInvitations.push({
    id: 'invite-1',
    emailAddress: 'test-staff@clinic.com',
    status: 'INVITED',
    expiresAt: new Date(Date.now() + 100000), // Active
    token: hashToken('token-abc')
  });

  const resultDuplicate = await graphql({
    schema,
    source: createStaffMutation,
    variableValues: {
      emailAddress: 'test-staff@clinic.com',
      displayName: 'Test Staff',
      roleId: ROLE_ID,
      centerId: CENTER_ID
    },
    contextValue: {
      viewer: { id: ADMIN_USER_ID, centerId: CENTER_ID, role: { roleType: 'ADMIN' } },
      models: mockModels,
      sequelize: mockSequelize,
      logger: { info: () => {} }
    }
  });

  assert.ok(resultDuplicate.errors?.[0]?.message.includes('already pending'));

  // Scenario B: Role escalation prevention (regular Admin trying to invite an Admin to another center)
  const resultEscalation = await graphql({
    schema,
    source: createStaffMutation,
    variableValues: {
      emailAddress: 'escalated@clinic.com',
      displayName: 'Escalated Admin',
      roleId: ROLE_ID,
      centerId: 'other-center-id'
    },
    contextValue: {
      viewer: { id: ADMIN_USER_ID, centerId: CENTER_ID, role: { roleType: 'ADMIN' } },
      models: mockModels,
      sequelize: mockSequelize,
      logger: { info: () => {} }
    }
  });

  assert.ok(resultEscalation.errors?.[0]?.message.includes('different center'));
});

// 2. Invitation Expiry & Verification Suite
test('linkFirebaseStaffAccount enforces invitation expiry, email mismatch, and verified status checks', async () => {
  resetDbState();

  const linkMutation = `
    mutation LinkFirebaseStaffAccount($token: String!, $firebaseIdToken: String!) {
      linkFirebaseStaffAccount(token: $token, firebaseIdToken: $firebaseIdToken) {
        id
        emailAddress
        isActive
      }
    }
  `;

  // Scenario A: Invitation expiry
  staffInvitations.push({
    id: 'invite-expired',
    emailAddress: 'expired@clinic.com',
    status: 'INVITED',
    expiresAt: new Date(Date.now() - 10000), // Expired
    token: hashToken('token-expired'),
    save: async () => {}
  });

  const resultExpired = await graphql({
    schema,
    source: linkMutation,
    variableValues: {
      token: 'token-expired',
      firebaseIdToken: 'valid-token'
    },
    contextValue: {
      models: mockModels,
      sequelize: mockSequelize
    }
  });

  assert.ok(resultExpired.errors?.[0]?.message.includes('expired'));

  // Scenario B: Unverified email
  const rawToken = 'raw-token-123';
  const hashedToken = hashToken(rawToken);
  staffInvitations.push({
    id: 'invite-valid',
    emailAddress: 'test-staff@clinic.com',
    status: 'INVITED',
    expiresAt: new Date(Date.now() + 100000),
    token: hashedToken,
  });
  users.push({
    id: 'local-user-id',
    emailAddress: 'test-staff@clinic.com',
    isActive: false,
    save: async () => {}
  });

  const resultUnverified = await graphql({
    schema,
    source: linkMutation,
    variableValues: {
      token: rawToken,
      firebaseIdToken: 'unverified-email'
    },
    contextValue: {
      models: mockModels,
      sequelize: mockSequelize
    }
  });
  assert.ok(resultUnverified.errors?.[0]?.message.includes('must be verified'));

  // Scenario C: Email mismatch
  const resultMismatch = await graphql({
    schema,
    source: linkMutation,
    variableValues: {
      token: rawToken,
      firebaseIdToken: 'mismatched-email'
    },
    contextValue: {
      models: mockModels,
      sequelize: mockSequelize
    }
  });
  assert.ok(resultMismatch.errors?.[0]?.message.includes('does not match'));

  // Scenario D: Successful linking
  const resultSuccess = await graphql({
    schema,
    source: linkMutation,
    variableValues: {
      token: rawToken,
      firebaseIdToken: 'valid-token'
    },
    contextValue: {
      models: mockModels,
      sequelize: mockSequelize
    }
  });
  assert.equal(resultSuccess.errors, undefined);
  assert.equal(resultSuccess.data.linkFirebaseStaffAccount.isActive, true);
  assert.equal(users[0].firebaseUid, 'fb-uid-123');
});

// 3. Inventory Movement & Stock Control Suite
test('adjustInventory enforces positive/negative movement, note requirements, and negative-stock prevention', async () => {
  resetDbState();

  const adjustMutation = `
    mutation AdjustInventory(
      $productId: ID!
      $centerId: ID
      $reasonCode: String!
      $reasonNote: String!
      $quantityChange: Int!
      $idempotencyKey: String!
    ) {
      adjustInventory(
        productId: $productId
        centerId: $centerId
        reasonCode: $reasonCode
        reasonNote: $reasonNote
        quantityChange: $quantityChange
        idempotencyKey: $idempotencyKey
      ) {
        id
        quantityAfter
      }
    }
  `;

  // Scenario A: Inventory negative-stock prevention (starting at 50, trying to subtract 60)
  const resultNegativeStock = await graphql({
    schema,
    source: adjustMutation,
    variableValues: {
      productId: PRODUCT_ID,
      centerId: CENTER_ID,
      reasonCode: 'DAMAGED',
      reasonNote: 'Lost in warehouse fire',
      quantityChange: -60,
      idempotencyKey: 'key-1'
    },
    contextValue: {
      viewer: { id: ADMIN_USER_ID, centerId: CENTER_ID, role: { roleType: 'ADMIN' } },
      models: mockModels,
      sequelize: mockSequelize
    }
  });

  assert.ok(resultNegativeStock.errors?.[0]?.message.includes('cannot go negative'));

  // Scenario B: Note requirements (trying to adjust with DAMAGED without 5-char reasonNote)
  const resultShortNote = await graphql({
    schema,
    source: adjustMutation,
    variableValues: {
      productId: PRODUCT_ID,
      centerId: CENTER_ID,
      reasonCode: 'DAMAGED',
      reasonNote: 'bad',
      quantityChange: -5,
      idempotencyKey: 'key-2'
    },
    contextValue: {
      viewer: { id: ADMIN_USER_ID, centerId: CENTER_ID, role: { roleType: 'ADMIN' } },
      models: mockModels,
      sequelize: mockSequelize
    }
  });

  assert.ok(resultShortNote.errors?.[0]?.message.includes('at least 5 characters'));

  // Scenario C: Positive stock adjustment (adding 10 items)
  const resultPositive = await graphql({
    schema,
    source: adjustMutation,
    variableValues: {
      productId: PRODUCT_ID,
      centerId: CENTER_ID,
      reasonCode: 'STOCK_RECEIVED',
      reasonNote: 'New supplier batch received today',
      quantityChange: 10,
      idempotencyKey: 'key-3'
    },
    contextValue: {
      viewer: { id: ADMIN_USER_ID, centerId: CENTER_ID, role: { roleType: 'ADMIN' } },
      models: mockModels,
      sequelize: mockSequelize
    }
  });

  assert.equal(resultPositive.errors, undefined);
  assert.equal(resultPositive.data.adjustInventory.quantityAfter, 60);

  // Scenario D: Duplicate idempotency key check (submitting same key does not double-adjust)
  const resultDuplicateKey = await graphql({
    schema,
    source: adjustMutation,
    variableValues: {
      productId: PRODUCT_ID,
      centerId: CENTER_ID,
      reasonCode: 'STOCK_RECEIVED',
      reasonNote: 'New supplier batch received today',
      quantityChange: 10,
      idempotencyKey: 'key-3' // Same key
    },
    contextValue: {
      viewer: { id: ADMIN_USER_ID, centerId: CENTER_ID, role: { roleType: 'ADMIN' } },
      models: mockModels,
      sequelize: mockSequelize
    }
  });

  assert.equal(resultDuplicateKey.errors, undefined);
  // Returns original movement, doesn't add stock again
  assert.equal(products[0].inventoryCount, 60);

  // Scenario E: Reused idempotency key with different parameters rejects
  const resultMismatchedKey = await graphql({
    schema,
    source: adjustMutation,
    variableValues: {
      productId: PRODUCT_ID,
      centerId: CENTER_ID,
      reasonCode: 'STOCK_RECEIVED',
      reasonNote: 'New supplier batch received today',
      quantityChange: 20, // Different!
      idempotencyKey: 'key-3'
    },
    contextValue: {
      viewer: { id: ADMIN_USER_ID, centerId: CENTER_ID, role: { roleType: 'ADMIN' } },
      models: mockModels,
      sequelize: mockSequelize
    }
  });

  assert.ok(resultMismatchedKey.errors?.[0]?.message.includes('reused with different parameters'));
});

// 4. Financial Integrity & Refunds Suite
test('adminCreateRefund processes transaction locks, provider calls, and idempotency parameter checks', async () => {
  resetDbState();

  const refundMutation = `
    mutation AdminCreateRefund($paymentId: ID!, $amountMinor: Int!, $reason: String!, $idempotencyKey: String!) {
      adminCreateRefund(paymentId: $paymentId, amountMinor: $amountMinor, reason: $reason, idempotencyKey: $idempotencyKey) {
        id
        status
        requestedAmountMinor
      }
    }
  `;

  payments.push({
    id: PAYMENT_ID,
    razorpayPaymentId: 'pay_rzp_mock_123',
    amountMinor: 10000,
    amount: '100.00',
    currency: 'INR',
    status: 'captured',
    totalRefundedMinor: 0,
    userId: 'user-1'
  });

  // Scenario A: Refund success
  const resultSuccess = await graphql({
    schema,
    source: refundMutation,
    variableValues: {
      paymentId: PAYMENT_ID,
      amountMinor: 5000,
      reason: 'Customer request refund',
      idempotencyKey: 'ref-key-1'
    },
    contextValue: {
      viewer: { id: ADMIN_USER_ID, centerId: CENTER_ID, role: { roleType: 'ADMIN' } },
      models: mockModels,
      sequelize: mockSequelize
    }
  });

  assert.equal(resultSuccess.errors, undefined);
  assert.equal(resultSuccess.data.adminCreateRefund.status, 'processed');
  assert.equal(resultSuccess.data.adminCreateRefund.requestedAmountMinor, 5000);
  assert.equal(payments[0].totalRefundedMinor, 5000);
  assert.equal(payments[0].status, 'partially_refunded');

  // Scenario B: Idempotency parameter check (different parameters with same key fails)
  const resultMismatchedKey = await graphql({
    schema,
    source: refundMutation,
    variableValues: {
      paymentId: PAYMENT_ID,
      amountMinor: 2000, // Different!
      reason: 'Customer request refund',
      idempotencyKey: 'ref-key-1'
    },
    contextValue: {
      viewer: { id: ADMIN_USER_ID, centerId: CENTER_ID, role: { roleType: 'ADMIN' } },
      models: mockModels,
      sequelize: mockSequelize
    }
  });

  assert.ok(resultMismatchedKey.errors?.[0]?.message.includes('reused with different parameters'));
});
