import { authenticate } from '../permissions/index.js';
import { SupportService } from '../../../modules/support/support.service.js';

export const supportResolvers = {
  SupportTicket: {
    slaExpiresAt: (parent) => {
      const d = typeof parent.slaExpiresAt === 'string' ? new Date(parent.slaExpiresAt) : parent.slaExpiresAt;
      return d.toISOString();
    },
    createdAt: (parent) => {
      const d = typeof parent.createdAt === 'string' ? new Date(parent.createdAt) : parent.createdAt;
      return d.toISOString();
    }
  },

  SupportTicketMessage: {
    createdAt: (parent) => {
      const d = typeof parent.createdAt === 'string' ? new Date(parent.createdAt) : parent.createdAt;
      return d.toISOString();
    }
  },

  Query: {
    getSupportTickets: authenticate(async (parent, args, context) => {
      const service = new SupportService(context.models, context.sequelize);
      return service.getTickets(context.viewer.id);
    }),

    getSupportTicketDetails: authenticate(async (parent, { id }, context) => {
      const service = new SupportService(context.models, context.sequelize);
      return service.getTicketDetails(context.viewer.id, id);
    })
  },

  Mutation: {
    createSupportTicket: authenticate(async (parent, { input }, context) => {
      const service = new SupportService(context.models, context.sequelize);
      return service.createTicket(context.viewer.id, input);
    }),

    addSupportTicketMessage: authenticate(async (parent, { input }, context) => {
      const service = new SupportService(context.models, context.sequelize);
      return service.addMessage(context.viewer.id, input, 'user');
    }),

    closeSupportTicket: authenticate(async (parent, { input }, context) => {
      const service = new SupportService(context.models, context.sequelize);
      return service.closeTicket(context.viewer.id, input);
    }),

    requestWhatsappHandoff: authenticate(async (parent, { id }, context) => {
      const service = new SupportService(context.models, context.sequelize);
      return service.requestWhatsappHandoff(context.viewer.id, id);
    })
  }
};
