import { authenticate } from '../permissions/index.js';
import { CounselingService } from '../../../modules/counseling/counseling.service.js';

export const counselingResolvers = {
  CounselingLead: {
    nextFollowUp: (parent) => parent.nextFollowUp ? new Date(parent.nextFollowUp).toISOString() : null,
    convertedAt: (parent) => parent.convertedAt ? new Date(parent.convertedAt).toISOString() : null,
    createdAt: (parent) => new Date(parent.createdAt).toISOString(),
    counselor: async (parent, args, context) => {
      if (parent.counselor) return parent.counselor;
      if (!parent.assignedTo) return null;
      return await context.models.User.findByPk(parent.assignedTo);
    },
    convertedUser: async (parent, args, context) => {
      if (parent.convertedUser) return parent.convertedUser;
      if (!parent.convertedUserId) return null;
      return await context.models.User.findByPk(parent.convertedUserId);
    },
    calls: async (parent, args, context) => {
      if (parent.calls) return parent.calls;
      return await context.models.CounselingCall.findAll({
        where: { leadId: parent.id },
        order: [['createdAt', 'DESC']]
      });
    }
  },

  CounselingCall: {
    scheduledAt: (parent) => new Date(parent.scheduledAt).toISOString(),
    createdAt: (parent) => new Date(parent.createdAt).toISOString(),
    counselor: async (parent, args, context) => {
      if (parent.counselor) return parent.counselor;
      return await context.models.User.findByPk(parent.counselorId);
    }
  },

  Query: {
    getCounselingLeads: authenticate(async (parent, { status, assignedToMe }, context) => {
      const isStaff = ['STAFF', 'ADMIN', 'SUPER_ADMIN'].includes(context.viewer.role?.roleType);
      if (!isStaff) throw new Error('Unauthorized');
      
      const service = new CounselingService(context.models, context.sequelize);
      return service.getLeads(context.viewer, status, assignedToMe);
    }),

    getCounselingLeadDetails: authenticate(async (parent, { id }, context) => {
      const isStaff = ['STAFF', 'ADMIN', 'SUPER_ADMIN'].includes(context.viewer.role?.roleType);
      if (!isStaff) throw new Error('Unauthorized');
      
      const service = new CounselingService(context.models, context.sequelize);
      return service.getLeadDetails(id);
    }),

    getCounselingDashboardStats: authenticate(async (parent, args, context) => {
      const isStaff = ['STAFF', 'ADMIN', 'SUPER_ADMIN'].includes(context.viewer.role?.roleType);
      if (!isStaff) throw new Error('Unauthorized');
      
      const service = new CounselingService(context.models, context.sequelize);
      return service.getDashboardStats(context.viewer);
    })
  },

  Mutation: {
    createCounselingLead: authenticate(async (parent, args, context) => {
      const isStaff = ['STAFF', 'ADMIN', 'SUPER_ADMIN'].includes(context.viewer.role?.roleType);
      if (!isStaff) throw new Error('Unauthorized');
      
      const service = new CounselingService(context.models, context.sequelize);
      return service.createLead(args);
    }),

    updateCounselingLeadStatus: authenticate(async (parent, { id, status }, context) => {
      const isStaff = ['STAFF', 'ADMIN', 'SUPER_ADMIN'].includes(context.viewer.role?.roleType);
      if (!isStaff) throw new Error('Unauthorized');
      
      const service = new CounselingService(context.models, context.sequelize);
      return service.updateLeadStatus(id, status);
    }),

    assignCounselingLead: authenticate(async (parent, { id, counselorId }, context) => {
      const isStaff = ['STAFF', 'ADMIN', 'SUPER_ADMIN'].includes(context.viewer.role?.roleType);
      if (!isStaff) throw new Error('Unauthorized');
      
      const service = new CounselingService(context.models, context.sequelize);
      return service.assignLead(id, counselorId);
    }),

    scheduleCounselingCall: authenticate(async (parent, { leadId, scheduledAt }, context) => {
      const isStaff = ['STAFF', 'ADMIN', 'SUPER_ADMIN'].includes(context.viewer.role?.roleType);
      if (!isStaff) throw new Error('Unauthorized');
      
      const service = new CounselingService(context.models, context.sequelize);
      return service.scheduleCall(leadId, scheduledAt, context.viewer.id);
    }),

    logCounselingCallOutcome: authenticate(async (parent, args, context) => {
      const isStaff = ['STAFF', 'ADMIN', 'SUPER_ADMIN'].includes(context.viewer.role?.roleType);
      if (!isStaff) throw new Error('Unauthorized');
      
      const service = new CounselingService(context.models, context.sequelize);
      return service.logCallOutcome(args, context.viewer.id);
    }),

    convertLeadToMember: authenticate(async (parent, { leadId, centerId }, context) => {
      const isStaff = ['STAFF', 'ADMIN', 'SUPER_ADMIN'].includes(context.viewer.role?.roleType);
      if (!isStaff) throw new Error('Unauthorized');
      
      const service = new CounselingService(context.models, context.sequelize);
      return service.convertLeadToMember(leadId, centerId, context.viewer.id);
    })
  }
};
