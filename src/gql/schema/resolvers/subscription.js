import { authenticate } from '../permissions/index.js';
import { SubscriptionService } from '../../../modules/subscription/subscription.service.js';

export const subscriptionResolvers = {
  UserSubscription: {
    trialStartDate: (parent) => {
      if (!parent.trialStartDate) return null;
      const d = typeof parent.trialStartDate === 'string' ? new Date(parent.trialStartDate) : parent.trialStartDate;
      return d.toISOString();
    },
    trialEndDate: (parent) => {
      if (!parent.trialEndDate) return null;
      const d = typeof parent.trialEndDate === 'string' ? new Date(parent.trialEndDate) : parent.trialEndDate;
      return d.toISOString();
    },
    currentPeriodStartDate: (parent) => {
      const d = typeof parent.currentPeriodStartDate === 'string' ? new Date(parent.currentPeriodStartDate) : parent.currentPeriodStartDate;
      return d.toISOString();
    },
    currentPeriodEndDate: (parent) => {
      const d = typeof parent.currentPeriodEndDate === 'string' ? new Date(parent.currentPeriodEndDate) : parent.currentPeriodEndDate;
      return d.toISOString();
    },
    cancelledAt: (parent) => {
      if (!parent.cancelledAt) return null;
      const d = typeof parent.cancelledAt === 'string' ? new Date(parent.cancelledAt) : parent.cancelledAt;
      return d.toISOString();
    }
  },

  Coupon: {
    validFrom: (parent) => {
      const d = typeof parent.validFrom === 'string' ? new Date(parent.validFrom) : parent.validFrom;
      return d.toISOString();
    },
    validUntil: (parent) => {
      const d = typeof parent.validUntil === 'string' ? new Date(parent.validUntil) : parent.validUntil;
      return d.toISOString();
    }
  },

  Query: {
    getPlans: authenticate(async (parent, args, context) => {
      const service = new SubscriptionService(context.models, context.sequelize);
      return service.getPlans();
    }),

    getMySubscription: authenticate(async (parent, args, context) => {
      const service = new SubscriptionService(context.models, context.sequelize);
      return service.getSubscription(context.viewer.id);
    }),

    validateCoupon: authenticate(async (parent, { code }, context) => {
      const service = new SubscriptionService(context.models, context.sequelize);
      return service.validateCoupon(code);
    })
  },

  Mutation: {
    startTrial: authenticate(async (parent, { planId }, context) => {
      const service = new SubscriptionService(context.models, context.sequelize);
      return service.startTrial(context.viewer.id, planId);
    }),

    subscribeToPlan: authenticate(async (parent, { planId, couponCode }, context) => {
      const service = new SubscriptionService(context.models, context.sequelize);
      return service.subscribe(context.viewer.id, planId, couponCode);
    }),

    cancelSubscription: authenticate(async (parent, args, context) => {
      const service = new SubscriptionService(context.models, context.sequelize);
      return service.cancelSubscription(context.viewer.id);
    })
  }
};
