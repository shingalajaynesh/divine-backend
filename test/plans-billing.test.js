import assert from 'node:assert/strict';
import test from 'node:test';
import { SubscriptionService } from '../src/modules/subscription/subscription.service.js';

const VIEWER_STAFF = { id: '66666666-6666-4666-a666-666666666666', role: { roleType: 'STAFF' } };
const VIEWER_MOTHER = { id: '77777777-7777-4777-a777-777777777777', role: { roleType: 'MOTHER' } };

test('SubscriptionService - Plan CRUD, coupons, trial, direct activation protection, entitlements, and renewals run', async () => {
  const mockPlans = [];
  const mockCoupons = [];
  const mockSubscriptions = [];
  const mockPayments = [];
  const mockInvoices = [];
  const mockUsers = [
    { id: '77777777-7777-4777-a777-777777777777', displayName: 'Jane Doe', subscriptionStatus: 'standard', save: async function() { return this; } }
  ];

  // Seed standard plan
  mockPlans.push({
    id: '11111111-1111-4111-a111-111111111111',
    name: 'Standard Care Package',
    description: 'Basic daily plans',
    price: 999.00,
    billingPeriod: 'monthly',
    trialDays: 7,
    features: ['daily_plans', 'vitals_tracker'],
    save: async function() { return this; },
    destroy: async function() {
      const idx = mockPlans.indexOf(this);
      if (idx !== -1) mockPlans.splice(idx, 1);
    }
  });

  const mockModels = {
    Sequelize: {
      Op: {
        lte: Symbol('lte')
      }
    },
    SubscriptionPlan: {
      findAll: async () => mockPlans,
      findByPk: async (id) => mockPlans.find(p => p.id === id) || null,
      create: async (input) => {
        const row = {
          ...input,
          save: async function() { return this; },
          destroy: async function() {
            const idx = mockPlans.indexOf(this);
            if (idx !== -1) mockPlans.splice(idx, 1);
          },
          update: async function(updates) {
            Object.assign(this, updates);
            return this;
          }
        };
        mockPlans.push(row);
        return row;
      }
    },
    Coupon: {
      findAll: async () => mockCoupons,
      findByPk: async (id) => mockCoupons.find(c => c.id === id) || null,
      findOne: async (options) => {
        return mockCoupons.find(c => c.code === options.where?.code) || null;
      },
      create: async (input) => {
        const row = {
          ...input,
          save: async function() { return this; },
          destroy: async function() {
            const idx = mockCoupons.indexOf(this);
            if (idx !== -1) mockCoupons.splice(idx, 1);
          }
        };
        mockCoupons.push(row);
        return row;
      }
    },
    UserSubscription: {
      findOne: async (options) => {
        const sub = mockSubscriptions.find(s => s.userId === options.where?.userId);
        if (sub) {
          sub.plan = mockPlans.find(p => p.id === sub.planId) || null;
        }
        return sub || null;
      },
      findAll: async (options) => {
        let list = mockSubscriptions;
        if (options?.where?.currentPeriodEndDate) {
          const lteVal = options.where.currentPeriodEndDate[mockModels.Sequelize.Op.lte];
          if (lteVal) {
            list = list.filter(s => new Date(s.currentPeriodEndDate) <= lteVal);
          }
        }
        return list;
      },
      create: async (input) => {
        const row = {
          ...input,
          id: `sub_${Math.random().toString(36).substring(2, 10)}`,
          save: async function() { return this; }
        };
        mockSubscriptions.push(row);
        return row;
      }
    },
    Payment: {
      create: async (input) => {
        const row = {
          ...input,
          id: input.id || `pay_${Math.random().toString(36).substring(2, 10)}`,
          save: async function() { return this; }
        };
        mockPayments.push(row);
        return row;
      },
      findOne: async (options) => {
        return mockPayments.find(p => p.razorpayOrderId === options.where?.razorpayOrderId) || null;
      }
    },
    Invoice: {
      findAll: async () => mockInvoices,
      create: async (input) => {
        const row = {
          ...input,
          id: input.id || `inv_${Math.random().toString(36).substring(2, 10)}`,
          save: async function() { return this; }
        };
        mockInvoices.push(row);
        return row;
      }
    },
    FinancialTransaction: {
      create: async (input) => {
        return {
          ...input,
          save: async function() { return this; }
        };
      }
    },
    User: {
      findByPk: async (id) => mockUsers.find(u => u.id === id) || null
    }
  };

  const mockSequelize = {
    transaction: async (cb) => {
      return cb({});
    }
  };

  const service = new SubscriptionService(mockModels, mockSequelize);

  // 1. Plan CRUD operations
  await assert.rejects(
    service.createSubscriptionPlan(VIEWER_MOTHER, { name: 'Hack Package', price: 0, billingPeriod: 'monthly', trialDays: 7 }),
    /Unauthorized access/
  );

  const premiumPlan = await service.createSubscriptionPlan(VIEWER_STAFF, {
    name: 'Garbh Sanskar Premium',
    description: 'All access daily lessons, yoga classes, and consultation bookings',
    price: 2999.00,
    billingPeriod: 'monthly',
    trialDays: 14,
    features: ['daily_plans', 'vitals_tracker', 'live_classes', 'expert_consultations']
  });
  assert.equal(premiumPlan.name, 'Garbh Sanskar Premium');
  assert.equal(mockPlans.length, 2);

  // Validation checks
  await assert.rejects(
    service.createSubscriptionPlan(VIEWER_STAFF, { name: '', price: 100, billingPeriod: 'monthly', trialDays: 7 }),
    /Plan name is required/
  );
  await assert.rejects(
    service.createSubscriptionPlan(VIEWER_STAFF, { name: 'Neg Price', price: -50.0, billingPeriod: 'monthly', trialDays: 7 }),
    /Price cannot be negative/
  );

  // 2. Promo Coupons
  const coupon = await service.createCoupon(VIEWER_STAFF, {
    code: 'WELCOME50',
    discountPercent: 50,
    validFrom: '2026-01-01T00:00:00Z',
    validUntil: '2026-12-31T23:59:59Z',
    maxRedemptions: 10
  });
  assert.equal(coupon.code, 'WELCOME50');
  assert.equal(coupon.discountPercent, 50);

  // Validate coupon
  const validC = await service.validateCoupon('WELCOME50');
  assert.ok(validC);

  // 3. Free Trial Flow
  const trialSub = await service.startTrial('77777777-7777-4777-a777-777777777777', premiumPlan.id);
  assert.equal(trialSub.status, 'trialing');
  assert.ok(trialSub.trialEndDate);

  // 4. Direct paid activation is blocked; verified Razorpay checkout must be used.
  // Clear mockSubscriptions to avoid "You already have active sub" trial check if any
  mockSubscriptions.length = 0;

  await assert.rejects(
    service.subscribe('77777777-7777-4777-a777-777777777777', premiumPlan.id, 'WELCOME50'),
    /Direct paid subscription activation is disabled/
  );
  assert.equal(mockInvoices.length, 0);

  const paidSub = await service.startTrial('77777777-7777-4777-a777-777777777777', premiumPlan.id);
  paidSub.status = 'active';

  // 5. Entitlement check
  const hasLiveClasses = await service.checkUserEntitlement('77777777-7777-4777-a777-777777777777', 'live_classes');
  assert.equal(hasLiveClasses, true);

  const hasAdvancedNourishment = await service.checkUserEntitlement('77777777-7777-4777-a777-777777777777', 'advanced_nourishment');
  assert.equal(hasAdvancedNourishment, false);

  // 6. Renewals Simulation Run
  // Set currentPeriodEndDate in the past to trigger renewal
  paidSub.currentPeriodEndDate = new Date('2026-06-01T00:00:00Z');
  paidSub.plan = premiumPlan; // Attach plan manually for simulation mock include

  const renewedSubs = await service.simulateRenewalProcess();
  assert.equal(renewedSubs.length, 1);
  assert.equal(renewedSubs[0].status, 'active');
  assert.ok(new Date(renewedSubs[0].currentPeriodEndDate) > new Date('2026-06-01T00:00:00Z'));

  // Should have generated the renewal invoice amount
  assert.equal(mockInvoices.length, 1);
  assert.equal(parseFloat(mockInvoices[0].amount), 2999.00); // full renewal price

  // 7. Delete Plan & Coupon
  const planDel = await service.deleteSubscriptionPlan(VIEWER_STAFF, premiumPlan.id);
  assert.equal(planDel, true);
  assert.equal(mockPlans.find(p => p.id === premiumPlan.id), undefined);

  const couponDel = await service.deleteCoupon(VIEWER_STAFF, coupon.id);
  assert.equal(couponDel, true);
  assert.equal(mockCoupons.find(c => c.id === coupon.id), undefined);
});
