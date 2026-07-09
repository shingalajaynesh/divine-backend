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
    },
    user: async (parent, args, context) => {
      if (parent.user) return parent.user;
      return await context.models.User.findByPk(parent.userId);
    }
  },

  SupportTicketMessage: {
    createdAt: (parent) => {
      const d = typeof parent.createdAt === 'string' ? new Date(parent.createdAt) : parent.createdAt;
      return d.toISOString();
    },
    sender: async (parent, args, context) => {
      if (parent.sender) return parent.sender;
      return await context.models.User.findByPk(parent.senderId);
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
    }),

    getStaffSupportTickets: authenticate(async (parent, { status }, context) => {
      const isStaff = ['STAFF', 'ADMIN', 'SUPER_ADMIN'].includes(context.viewer.role?.roleType);
      if (!isStaff) throw new Error('Unauthorized');
      
      const service = new SupportService(context.models, context.sequelize);
      return service.getStaffTickets(context.viewer, status);
    }),

    getCannedReplies: authenticate(async (parent, args, context) => {
      const isStaff = ['STAFF', 'ADMIN', 'SUPER_ADMIN'].includes(context.viewer.role?.roleType);
      if (!isStaff) throw new Error('Unauthorized');
      
      const service = new SupportService(context.models, context.sequelize);
      return service.getCannedReplies();
    }),

    getSupportDashboardMetrics: authenticate(async (parent, args, context) => {
      const isStaff = ['STAFF', 'ADMIN', 'SUPER_ADMIN'].includes(context.viewer.role?.roleType);
      if (!isStaff) throw new Error('Unauthorized');
      
      const service = new SupportService(context.models, context.sequelize);
      return service.getSupportDashboardMetrics(context.viewer);
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
    }),

    createCannedReply: authenticate(async (parent, args, context) => {
      const isStaff = ['STAFF', 'ADMIN', 'SUPER_ADMIN'].includes(context.viewer.role?.roleType);
      if (!isStaff) throw new Error('Unauthorized');
      
      const service = new SupportService(context.models, context.sequelize);
      return service.createCannedReply(args);
    }),

    addStaffSupportMessage: authenticate(async (parent, { ticketId, message }, context) => {
      const isStaff = ['STAFF', 'ADMIN', 'SUPER_ADMIN'].includes(context.viewer.role?.roleType);
      if (!isStaff) throw new Error('Unauthorized');
      
      const service = new SupportService(context.models, context.sequelize);
      return service.addMessage(context.viewer.id, { ticketId, message }, 'staff');
    }),

    updateSupportTicketStatus: authenticate(async (parent, { ticketId, status }, context) => {
      const isStaff = ['STAFF', 'ADMIN', 'SUPER_ADMIN'].includes(context.viewer.role?.roleType);
      if (!isStaff) throw new Error('Unauthorized');
      
      const service = new SupportService(context.models, context.sequelize);
      return service.updateTicketStatus(ticketId, status);
    }),

    checkSlaEscalations: authenticate(async (parent, args, context) => {
      const service = new SupportService(context.models, context.sequelize);
      return service.checkSlaEscalations();
    })
  }
};
