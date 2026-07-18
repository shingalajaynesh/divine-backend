import assert from 'node:assert/strict';
import test from 'node:test';
import { graphql } from 'graphql';
import schema from '../src/gql/schema/index.js';
import { SubscriptionService } from '../src/modules/subscription/subscription.service.js';

const VALID_USER_ID = 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a99';
const VALID_PLAN_ID = '17a5b3a4-e910-410a-86fe-2d5d71eb5aa4';
const VALID_COUPON_CODE = 'GARBH50';

test('subscription queries require authentication', async () => {
  const query = '{ getPlans { id name price } }';
  const result = await graphql({ schema, source: query, contextValue: {} });
  assert.equal(result.errors?.[0]?.extensions?.code, 'UNAUTHENTICATED');
});

test('SubscriptionService manages plans, trials, coupons validation, and blocks direct upgrades', async () => {
  let plansFetched = false;
  let subCreated = null;
  let subUpdated = null;
  let couponFound = null;
  let couponRedemptions = 0;

  const mockTransaction = async (callback) => callback({});

  const models = {
    SubscriptionPlan: {
      findAll: async () => {
        plansFetched = true;
        return [{ id: VALID_PLAN_ID, name: 'Standard Plan', price: 1499.00, trialDays: 7, billingPeriod: 'yearly' }];
      },
      findByPk: async (id) => {
        return { id: VALID_PLAN_ID, name: 'Standard Plan', price: 1499.00, trialDays: 7, billingPeriod: 'yearly' };
      }
    },
    UserSubscription: {
      findOne: async () => subCreated,
      create: async (input) => {
        subCreated = input;
        return { id: 'sub-1', ...input };
      }
    },
    Payment: {
      create: async (input) => {
        return { id: 'payment-1', ...input };
      }
    },
    Invoice: {
      create: async (input) => {
        return { id: 'invoice-1', ...input };
      }
    },
    User: {
      findByPk: async (id) => {
        return {
          id,
          subscriptionStatus: 'free',
          save: async function() {}
        };
      }
    },
    FinancialTransaction: {
      create: async (input) => {
        return { id: 'transaction-1', ...input };
      }
    },
    Coupon: {
      findOne: async ({ where }) => {
        if (where.code === VALID_COUPON_CODE) {
          couponFound = {
            id: 'coupon-1',
            code: VALID_COUPON_CODE,
            discountPercent: 50,
            validFrom: new Date(Date.now() - 10000),
            validUntil: new Date(Date.now() + 10000),
            maxRedemptions: 100,
            redemptionsCount: couponRedemptions,
            save: function() { couponRedemptions = this.redemptionsCount; }
          };
          return couponFound;
        }
        return null;
      }
    }
  };

  const service = new SubscriptionService(models, { transaction: mockTransaction });

  // 1. Get Plans
  const plans = await service.getPlans();
  assert.equal(plansFetched, true);
  assert.equal(plans[0].name, 'Standard Plan');

  // 2. Start free trial
  const trial = await service.startTrial(VALID_USER_ID, VALID_PLAN_ID);
  assert.equal(trial.status, 'trialing');
  assert.ok(trial.trialEndDate instanceof Date);

  // 3. Validate Promo Coupon
  const validCoupon = await service.validateCoupon(VALID_COUPON_CODE);
  assert.equal(validCoupon.code, VALID_COUPON_CODE);
  assert.equal(validCoupon.discountPercent, 50);

  // 4. Direct paid subscription activation is blocked; Razorpay checkout must be used.
  subCreated = {
    id: 'sub-1',
    status: 'trialing',
    save: async function() { subUpdated = this; }
  };
  await assert.rejects(
    service.subscribe(VALID_USER_ID, VALID_PLAN_ID, VALID_COUPON_CODE),
    /Direct paid subscription activation is disabled/
  );
  assert.equal(subUpdated, null);
  assert.equal(couponRedemptions, 0);
});
