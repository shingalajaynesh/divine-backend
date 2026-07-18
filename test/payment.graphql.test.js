import assert from 'node:assert/strict';
import test from 'node:test';
import crypto from 'node:crypto';
import { SubscriptionService } from '../src/modules/subscription/subscription.service.js';
import { RazorpayWebhookService } from '../src/modules/payment/razorpayWebhook.service.js';

const MEMBER_USER_ID = 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a99';
const STANDARD_PLAN_ID = '17a5b3a4-e910-410a-86fe-2d5d71eb5aa4';
const PREMIUM_PLAN_ID = '27a5b3a4-e910-410a-86fe-2d5d71eb5aa5';

const attachSave = (row) => ({
  ...row,
  save: async function() { return this; }
});

const mockSequelize = {
  transaction: async (callback) => callback({ LOCK: { UPDATE: 'UPDATE' } })
};

const buildModels = () => {
  const plans = [
    { id: STANDARD_PLAN_ID, price: '1499.00', billingPeriod: 'yearly', name: 'Standard Plan', trialDays: 7 },
    { id: PREMIUM_PLAN_ID, price: '2999.00', billingPeriod: 'yearly', name: 'Premium Plan', trialDays: 14 }
  ];
  const coupons = [{
    id: '37a5b3a4-e910-410a-86fe-2d5d71eb5aa6',
    code: 'GARBH50',
    discountPercent: 50,
    discountAmount: null,
    validFrom: new Date(Date.now() - 1000),
    validUntil: new Date(Date.now() + 60_000),
    maxRedemptions: 500,
    redemptionsCount: 0,
    save: async function() { return this; }
  }];
  const checkoutIntents = [];
  const payments = [];
  const subscriptions = [];
  const invoices = [];
  const financialTransactions = [];
  const couponRedemptions = [];
  const providerEvents = [];

  const models = {
    SubscriptionPlan: {
      findByPk: async (id) => plans.find((plan) => plan.id === id) || null
    },
    Coupon: {
      findOne: async (options) => coupons.find((coupon) => coupon.code === options.where?.code) || null,
      findByPk: async (id) => coupons.find((coupon) => coupon.id === id) || null
    },
    User: {
      findByPk: async (id) => {
        if (id !== MEMBER_USER_ID) return null;
        return attachSave({ id, centerId: 'center_1', subscriptionStatus: 'free' });
      }
    },
    PaymentCheckoutIntent: {
      create: async (input) => {
        const row = attachSave(input);
        checkoutIntents.push(row);
        return row;
      },
      findByPk: async (id) => checkoutIntents.find((intent) => intent.id === id) || null,
      findOne: async (options) => {
        if (options.where?.razorpayOrderId) {
          return checkoutIntents.find((intent) => intent.razorpayOrderId === options.where.razorpayOrderId) || null;
        }
        return null;
      }
    },
    Payment: {
      create: async (input) => {
        const row = attachSave(input);
        payments.push(row);
        return row;
      },
      findOne: async (options) => payments.find((payment) =>
        (!options.where?.checkoutIntentId || payment.checkoutIntentId === options.where.checkoutIntentId) &&
        (!options.where?.userId || payment.userId === options.where.userId) &&
        (!options.where?.status || payment.status === options.where.status)
      ) || null
    },
    UserSubscription: {
      findOne: async (options) => {
        const sub = subscriptions.find((item) => item.userId === options.where?.userId) || null;
        if (sub) sub.plan = plans.find((plan) => plan.id === sub.planId) || null;
        return sub;
      },
      create: async (input) => {
        const row = attachSave({ id: 'sub_1', ...input });
        subscriptions.push(row);
        return row;
      }
    },
    Invoice: {
      findOne: async (options) => invoices.find((invoice) => invoice.paymentId === options.where?.paymentId) || null,
      create: async (input) => {
        const row = attachSave({ id: `invoice_${invoices.length + 1}`, ...input });
        invoices.push(row);
        return row;
      }
    },
    FinancialTransaction: {
      findOne: async (options) => financialTransactions.find((tx) =>
        tx.paymentId === options.where?.paymentId && tx.type === options.where?.type
      ) || null,
      create: async (input) => {
        const row = attachSave({ id: `tx_${financialTransactions.length + 1}`, ...input });
        financialTransactions.push(row);
        return row;
      }
    },
    CouponRedemption: {
      findOne: async (options) => couponRedemptions.find((redemption) =>
        redemption.checkoutIntentId === options.where?.checkoutIntentId
      ) || null,
      create: async (input) => {
        const row = attachSave({ id: `redemption_${couponRedemptions.length + 1}`, ...input });
        couponRedemptions.push(row);
        return row;
      }
    },
    PaymentProviderEvent: {
      findOne: async (options) => providerEvents.find((event) =>
        event.provider === options.where?.provider && event.providerEventId === options.where?.providerEventId
      ) || null,
      create: async (input) => {
        const row = attachSave(input);
        providerEvents.push(row);
        return row;
      }
    }
  };

  return {
    models,
    state: { coupons, checkoutIntents, payments, subscriptions, invoices, financialTransactions, couponRedemptions, providerEvents }
  };
};

const capturedClient = {
  createOrder: async ({ amount, currency, receipt, notes }) => ({ id: `order_${receipt}`, amount, currency, receipt, status: 'created', notes }),
  fetchPayment: async (paymentId, expected) => ({
    id: paymentId,
    order_id: expected.expectedOrderId,
    amount: expected.expectedAmountMinor || 74950,
    currency: expected.expectedCurrency || 'INR',
    status: 'captured',
  })
};

test('createRazorpayOrder creates a trusted checkout intent with backend-calculated amount', async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'test';
  try {
    const { models, state } = buildModels();
    const service = new SubscriptionService(models, mockSequelize, capturedClient);

    const order = await service.createRazorpayOrder(MEMBER_USER_ID, PREMIUM_PLAN_ID, 'GARBH50');

    assert.ok(order.id.startsWith('order_'));
    assert.equal(order.amount, 149950);
    assert.equal(order.currency, 'INR');
    assert.equal(order.receipt, state.checkoutIntents[0].receipt);
    assert.equal(state.checkoutIntents[0].subscriptionPlanId, PREMIUM_PLAN_ID);
    assert.equal(state.checkoutIntents[0].couponId, state.coupons[0].id);
    assert.equal(state.checkoutIntents[0].expectedAmountMinor, 149950);
    assert.equal(state.payments[0].status, 'pending');
    assert.equal(state.payments[0].checkoutIntentId, state.checkoutIntents[0].id);
    assert.equal(state.coupons[0].redemptionsCount, 0);
  } finally {
    process.env.NODE_ENV = previousNodeEnv;
  }
});

test('verifyRazorpayPayment requires provider-captured payment and remains idempotent', async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'test';
  try {
    const { models, state } = buildModels();
    const service = new SubscriptionService(models, mockSequelize, capturedClient);

    const order = await service.createRazorpayOrder(MEMBER_USER_ID, STANDARD_PLAN_ID, 'GARBH50');
    const first = await service.verifyRazorpayPayment(
      MEMBER_USER_ID,
      PREMIUM_PLAN_ID,
      order.id,
      'pay_mock_payment_123',
      'mock_signature'
    );
    const second = await service.verifyRazorpayPayment(
      MEMBER_USER_ID,
      order.id,
      'pay_mock_payment_123',
      'mock_signature'
    );

    assert.equal(first.planId, STANDARD_PLAN_ID);
    assert.equal(second.planId, STANDARD_PLAN_ID);
    assert.equal(state.payments[0].status, 'captured');
    assert.equal(state.checkoutIntents[0].status, 'paid');
    assert.equal(state.checkoutIntents[0].razorpayPaymentId, 'pay_mock_payment_123');
    assert.equal(state.subscriptions.length, 1);
    assert.equal(state.invoices.length, 1);
    assert.equal(state.financialTransactions.length, 1);
    assert.equal(state.couponRedemptions.length, 1);
    assert.equal(state.coupons[0].redemptionsCount, 1);
  } finally {
    process.env.NODE_ENV = previousNodeEnv;
  }
});

test('verifyRazorpayPayment rejects invalid production signatures before provider fetch', async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousKeyId = process.env.RAZORPAY_KEY_ID;
  const previousKeySecret = process.env.RAZORPAY_KEY_SECRET;
  process.env.NODE_ENV = 'production';
  process.env.RAZORPAY_KEY_ID = 'rzp_test_public';
  process.env.RAZORPAY_KEY_SECRET = 'test_secret';
  try {
    const { models, state } = buildModels();
    const intent = attachIntentForProduction(state);
    let fetchCalled = false;
    const service = new SubscriptionService(models, mockSequelize, {
      fetchPayment: async () => {
        fetchCalled = true;
        return {};
      }
    });

    await assert.rejects(
      service.verifyRazorpayPayment(MEMBER_USER_ID, intent.razorpayOrderId, 'pay_valid_123', '0'.repeat(64)),
      /Invalid Razorpay signature verification/
    );
    assert.equal(fetchCalled, false);
  } finally {
    process.env.NODE_ENV = previousNodeEnv;
    process.env.RAZORPAY_KEY_ID = previousKeyId;
    process.env.RAZORPAY_KEY_SECRET = previousKeySecret;
  }
});

test('valid Razorpay webhook persists event and finalizes captured payment once', async () => {
  const previousSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  process.env.RAZORPAY_WEBHOOK_SECRET = 'webhook_test_secret';
  try {
    const { models, state } = buildModels();
    const service = new SubscriptionService(models, mockSequelize, capturedClient);
    const order = await service.createRazorpayOrder(MEMBER_USER_ID, STANDARD_PLAN_ID, null);
    const payload = {
      id: 'evt_payment_captured_1',
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: 'pay_webhook_1',
            order_id: order.id,
            amount: 149900,
            currency: 'INR',
            status: 'captured',
          }
        }
      }
    };
    const raw = Buffer.from(JSON.stringify(payload));
    const signature = crypto.createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET).update(raw).digest('hex');
    const webhook = new RazorpayWebhookService(models, mockSequelize);

    const first = await webhook.process(raw, signature, 'req_1');
    const duplicate = await webhook.process(raw, signature, 'req_2');

    assert.equal(first.status, 'processed');
    assert.equal(duplicate.status, 'duplicate');
    assert.equal(state.providerEvents.length, 1);
    assert.equal(state.providerEvents[0].processingStatus, 'PROCESSED');
    assert.equal(state.payments[0].status, 'captured');
    assert.equal(state.checkoutIntents[0].status, 'paid');
    assert.equal(state.subscriptions.length, 1);
    assert.equal(state.invoices.length, 1);
    assert.equal(state.financialTransactions.length, 1);
  } finally {
    process.env.RAZORPAY_WEBHOOK_SECRET = previousSecret;
  }
});

test('Razorpay webhook rejects invalid signatures and ignores unknown valid events', async () => {
  const previousSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  process.env.RAZORPAY_WEBHOOK_SECRET = 'webhook_test_secret';
  try {
    const { models, state } = buildModels();
    const webhook = new RazorpayWebhookService(models, mockSequelize);
    const raw = Buffer.from(JSON.stringify({ id: 'evt_unknown_1', event: 'unknown.event', payload: {} }));
    const validSignature = crypto.createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET).update(raw).digest('hex');

    await assert.rejects(
      webhook.process(raw, '0'.repeat(64), 'req_bad'),
      /Invalid Razorpay webhook signature/
    );

    const ignored = await webhook.process(raw, validSignature, 'req_good');
    assert.equal(ignored.status, 'ignored');
    assert.equal(state.providerEvents.length, 1);
    assert.equal(state.providerEvents[0].processingStatus, 'IGNORED');
  } finally {
    process.env.RAZORPAY_WEBHOOK_SECRET = previousSecret;
  }
});

function attachIntentForProduction(state) {
  const intent = attachSave({
    id: 'checkout_1',
    userId: MEMBER_USER_ID,
    centerId: 'center_1',
    subscriptionPlanId: STANDARD_PLAN_ID,
    couponId: null,
    razorpayOrderId: 'order_valid_123',
    razorpayPaymentId: null,
    expectedAmountMinor: 149900,
    currency: 'INR',
    purpose: 'subscription_purchase',
    status: 'order_created',
    receipt: 'dgs_sub_checkout_1',
    expiresAt: new Date(Date.now() + 60_000),
  });
  state.checkoutIntents.push(intent);
  state.payments.push(attachSave({
    id: 'payment_1',
    userId: MEMBER_USER_ID,
    checkoutIntentId: intent.id,
    amount: '1499.00',
    amountMinor: 149900,
    currency: 'INR',
    status: 'pending',
    razorpayOrderId: intent.razorpayOrderId,
  }));
  return intent;
}
