import assert from 'node:assert/strict';
import test from 'node:test';
import { SubscriptionService } from '../src/modules/subscription/subscription.service.js';

const MEMBER_USER_ID = 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a99';
const PLAN_ID = '27a5b3a4-e910-410a-86fe-2d5d71eb5aa5';

test('createRazorpayOrder creates a payment log and verify upgrades subscription', async () => {
  let paymentCreated = null;
  let paymentUpdated = null;
  let subCreated = null;
  let userUpdated = null;

  const mockTransaction = async (callback) => callback({});

  const models = {
    SubscriptionPlan: {
      findByPk: async (pk) => {
        if (pk === PLAN_ID) {
          return { id: PLAN_ID, price: 2999.00, billingPeriod: 'yearly', name: 'Premium Plan' };
        }
        return null;
      }
    },
    Coupon: {
      findOne: async () => null
    },
    Payment: {
      create: async (data) => {
        paymentCreated = data;
        return data;
      },
      findOne: async () => {
        return {
          id: 'pay_1',
          razorpayOrderId: 'order_1',
          status: 'pending',
          save: async function() {
            paymentUpdated = this;
          }
        };
      }
    },
    UserSubscription: {
      findOne: async () => null,
      create: async (data) => {
        subCreated = data;
        return data;
      }
    },
    User: {
      findByPk: async (pk) => {
        if (pk === MEMBER_USER_ID) {
          return {
            id: MEMBER_USER_ID,
            subscriptionStatus: 'free',
            save: async function() {
              userUpdated = this;
            }
          };
        }
        return null;
      }
    }
  };

  const service = new SubscriptionService(models, { transaction: mockTransaction });

  // 1. Create order
  const order = await service.createRazorpayOrder(MEMBER_USER_ID, PLAN_ID, null);
  assert.ok(order.id);
  assert.equal(order.amount, 299900); // 2999 INR in paise
  assert.equal(paymentCreated.amount, 2999.00);

  // 2. Verify payment
  const sub = await service.verifyRazorpayPayment(
    MEMBER_USER_ID,
    PLAN_ID,
    order.id,
    'pay_payment_id_123',
    'mock_signature'
  );

  assert.equal(paymentUpdated.status, 'succeeded');
  assert.equal(subCreated.planId, PLAN_ID);
  assert.equal(userUpdated.subscriptionStatus, 'premium');
});
