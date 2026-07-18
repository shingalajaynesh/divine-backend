import { authenticate } from '../permissions/index.js';
import { SubscriptionService } from '../../../modules/subscription/subscription.service.js';

export const subscriptionResolvers = {
  Invoice: {
    billingDate: (parent) => {
      const d = typeof parent.billingDate === 'string' ? new Date(parent.billingDate) : parent.billingDate;
      return d.toISOString();
    },
    dueDate: (parent) => {
      const d = typeof parent.dueDate === 'string' ? new Date(parent.dueDate) : parent.dueDate;
      return d.toISOString();
    },
    createdAt: (parent) => {
      const d = typeof parent.createdAt === 'string' ? new Date(parent.createdAt) : parent.createdAt;
      return d.toISOString();
    },
    updatedAt: (parent) => {
      const d = typeof parent.updatedAt === 'string' ? new Date(parent.updatedAt) : parent.updatedAt;
      return d.toISOString();
    },
    user: async (parent, args, context) => {
      if (parent.user) return parent.user;
      return context.models.User.findByPk(parent.userId);
    },
    subscription: async (parent, args, context) => {
      if (parent.subscription) return parent.subscription;
      if (!parent.subscriptionId) return null;
      return context.models.UserSubscription.findByPk(parent.subscriptionId, {
        include: [{ model: context.models.SubscriptionPlan, as: 'plan' }]
      });
    },
    payment: async (parent, args, context) => {
      if (parent.payment) return parent.payment;
      if (!parent.paymentId) return null;
      return context.models.Payment.findByPk(parent.paymentId);
    }
  },

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
    }),

    getAdminInvoices: authenticate(async (parent, args, context) => {
      if (context.viewer.role?.roleType !== 'ADMIN' && context.viewer.role?.roleType !== 'STAFF') {
        throw new Error('Unauthorized access');
      }
      const service = new SubscriptionService(context.models, context.sequelize);
      return service.getAdminInvoices();
    }),

    getMyInvoices: authenticate(async (parent, args, context) => {
      const service = new SubscriptionService(context.models, context.sequelize);
      return service.getInvoices(context.viewer.id);
    }),

    checkUserEntitlement: authenticate(async (parent, { featureKey }, context) => {
      const service = new SubscriptionService(context.models, context.sequelize);
      return service.checkUserEntitlement(context.viewer.id, featureKey);
    }),

    getCoupons: authenticate(async (parent, args, context) => {
      if (context.viewer.role?.roleType !== 'ADMIN' && context.viewer.role?.roleType !== 'STAFF') {
        throw new Error('Unauthorized access');
      }
      const service = new SubscriptionService(context.models, context.sequelize);
      return service.getCoupons();
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
    }),

    createRazorpayOrder: authenticate(async (parent, { planId, couponCode }, context) => {
      const service = new SubscriptionService(context.models, context.sequelize);
      return service.createRazorpayOrder(context.viewer.id, planId, couponCode);
    }),

    verifyRazorpayPayment: authenticate(async (parent, { razorpayOrderId, razorpayPaymentId, razorpaySignature }, context) => {
      const service = new SubscriptionService(context.models, context.sequelize);
      return service.verifyRazorpayPayment(context.viewer.id, razorpayOrderId, razorpayPaymentId, razorpaySignature);
    }),

    createSubscriptionPlan: authenticate(async (parent, args, context) => {
      const service = new SubscriptionService(context.models, context.sequelize);
      return service.createSubscriptionPlan(context.viewer, args);
    }),

    updateSubscriptionPlan: authenticate(async (parent, { id, ...args }, context) => {
      const service = new SubscriptionService(context.models, context.sequelize);
      return service.updateSubscriptionPlan(context.viewer, id, args);
    }),

    deleteSubscriptionPlan: authenticate(async (parent, { id }, context) => {
      const service = new SubscriptionService(context.models, context.sequelize);
      return service.deleteSubscriptionPlan(context.viewer, id);
    }),

    createCoupon: authenticate(async (parent, args, context) => {
      const service = new SubscriptionService(context.models, context.sequelize);
      return service.createCoupon(context.viewer, args);
    }),

    deleteCoupon: authenticate(async (parent, { id }, context) => {
      const service = new SubscriptionService(context.models, context.sequelize);
      return service.deleteCoupon(context.viewer, id);
    }),

    simulateRenewals: authenticate(async (parent, args, context) => {
      if (context.viewer.role?.roleType !== 'ADMIN' && context.viewer.role?.roleType !== 'STAFF') {
        throw new Error('Unauthorized access');
      }
      const service = new SubscriptionService(context.models, context.sequelize);
      return service.simulateRenewalProcess();
    })
  }
};
