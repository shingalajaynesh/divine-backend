import { authenticate } from '../permissions/index.js';
import { FinanceService } from '../../../modules/finance/finance.service.js';

export const financeResolvers = {
  FinancialTransaction: {
    reconciledAt: (parent) => parent.reconciledAt ? new Date(parent.reconciledAt).toISOString() : null,
    createdAt: (parent) => new Date(parent.createdAt).toISOString(),
    updatedAt: (parent) => new Date(parent.updatedAt).toISOString(),

    user: async (parent, args, context) => {
      if (parent.user) return parent.user;
      if (!parent.userId) return null;
      return context.models.User.findByPk(parent.userId);
    },
    center: async (parent, args, context) => {
      if (parent.center) return parent.center;
      if (!parent.centerId) return null;
      return context.models.Center.findByPk(parent.centerId);
    },
    payment: async (parent, args, context) => {
      if (parent.payment) return parent.payment;
      if (!parent.paymentId) return null;
      return context.models.Payment.findByPk(parent.paymentId);
    },
    invoice: async (parent, args, context) => {
      if (parent.invoice) return parent.invoice;
      if (!parent.invoiceId) return null;
      return context.models.Invoice.findByPk(parent.invoiceId);
    }
  },

  Query: {
    getFinancialReport: authenticate(async (parent, { startDate, endDate, centerId }, context) => {
      if (context.viewer.role?.roleType !== 'ADMIN' && context.viewer.role?.roleType !== 'STAFF') {
        throw new Error('Unauthorized access');
      }
      const service = new FinanceService(context.models, context.sequelize);
      return service.getFinancialReport(startDate, endDate, centerId);
    }),

    getFinancialTransactions: authenticate(async (parent, { centerId, type }, context) => {
      if (context.viewer.role?.roleType !== 'ADMIN' && context.viewer.role?.roleType !== 'STAFF') {
        throw new Error('Unauthorized access');
      }
      const service = new FinanceService(context.models, context.sequelize);
      return service.getFinancialTransactions(centerId, type);
    })
  },

  Mutation: {
    reconcileTransaction: authenticate(async (parent, { transactionId, notes }, context) => {
      const service = new FinanceService(context.models, context.sequelize);
      return service.reconcileTransaction(context.viewer, transactionId, notes);
    }),

    refundTransaction: authenticate(async (parent, { paymentId, refundAmount, reason }, context) => {
      const service = new FinanceService(context.models, context.sequelize);
      return service.refundTransaction(context.viewer, paymentId, refundAmount, reason);
    })
  }
};
