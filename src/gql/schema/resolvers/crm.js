import { authenticate } from '../permissions/index.js';
import { CrmService } from '../../../modules/crm/crm.service.js';

export const crmResolvers = {
  CrmUser: {
    pregnancyStartDate: (parent) => {
      if (!parent.pregnancyStartDate) return null;
      const d = typeof parent.pregnancyStartDate === 'string' ? new Date(parent.pregnancyStartDate) : parent.pregnancyStartDate;
      return d.toISOString();
    }
  },

  CrmNote: {
    createdAt: (parent) => {
      const d = typeof parent.createdAt === 'string' ? new Date(parent.createdAt) : parent.createdAt;
      return d.toISOString();
    },
    updatedAt: (parent) => {
      const d = typeof parent.updatedAt === 'string' ? new Date(parent.updatedAt) : parent.updatedAt;
      return d.toISOString();
    }
  },

  AdminAuditLog: {
    createdAt: (parent) => {
      const d = typeof parent.createdAt === 'string' ? new Date(parent.createdAt) : parent.createdAt;
      return d.toISOString();
    },
    payload: (parent) => {
      if (!parent.payload) return null;
      if (typeof parent.payload === 'string') return parent.payload;
      return JSON.stringify(parent.payload);
    }
  },

  Query: {
    getCrmUsers: authenticate(async (parent, args, context) => {
      if (context.viewer.role?.roleType !== 'ADMIN' && context.viewer.role?.roleType !== 'STAFF') {
        throw new Error('Unauthorized access');
      }
      const service = new CrmService(context.models, context.sequelize);
      return service.getUsersList();
    }),

    getCrmNotes: authenticate(async (parent, { userId }, context) => {
      if (context.viewer.role?.roleType !== 'ADMIN' && context.viewer.role?.roleType !== 'STAFF') {
        throw new Error('Unauthorized access');
      }
      const service = new CrmService(context.models, context.sequelize);
      return service.getCrmNotes(userId);
    }),

    getAuditLogs: authenticate(async (parent, args, context) => {
      if (context.viewer.role?.roleType !== 'ADMIN' && context.viewer.role?.roleType !== 'STAFF') {
        throw new Error('Unauthorized access');
      }
      const service = new CrmService(context.models, context.sequelize);
      return service.getAuditLogs();
    })
  },

  Mutation: {
    addCrmNote: authenticate(async (parent, { userId, note }, context) => {
      if (context.viewer.role?.roleType !== 'ADMIN' && context.viewer.role?.roleType !== 'STAFF') {
        throw new Error('Unauthorized access');
      }
      const service = new CrmService(context.models, context.sequelize);
      
      // Auto-log note adding audit action
      await service.logAdminAction(
        context.viewer.id,
        'add_crm_note',
        'User',
        userId,
        { note: note.substring(0, 50) }
      );

      return service.addCrmNote(userId, context.viewer.id, note);
    }),

    logAdminAction: authenticate(async (parent, { action, targetType, targetId, payload }, context) => {
      if (context.viewer.role?.roleType !== 'ADMIN' && context.viewer.role?.roleType !== 'STAFF') {
        throw new Error('Unauthorized access');
      }
      const service = new CrmService(context.models, context.sequelize);
      let jsonPayload = null;
      if (payload) {
        try {
          jsonPayload = JSON.parse(payload);
        } catch {
          jsonPayload = { raw: payload };
        }
      }
      return service.logAdminAction(context.viewer.id, action, targetType, targetId, jsonPayload);
    })
  }
};
