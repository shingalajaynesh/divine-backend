import { authenticate } from '../permissions/index.js';
import { Op } from 'sequelize';

export const superAdminResolvers = {
  Query: {
    getCenters: authenticate(async (parent, args, context) => {
      const { models } = context;
      const role = context.viewer.role?.roleType;

      if (role !== 'SUPER_ADMIN') {
        throw new Error('Unauthorized');
      }

      return await models.Center.findAll();
    }),

    getSuperAdminMetrics: authenticate(async (parent, args, context) => {
      const { models } = context;
      const role = context.viewer.role?.roleType;

      if (role !== 'SUPER_ADMIN') {
        throw new Error('Unauthorized');
      }

      const totalUsersCount = await models.User.count({ where: { isActive: true } });
      const totalCentersCount = await models.Center.count();
      
      let systemStatus = "UNKNOWN - Telemetry not configured";
      try {
        await context.sequelize.authenticate();
        systemStatus = "DATABASE_CONNECTED";
      } catch (err) {
        systemStatus = `DATABASE_ERROR: ${err.message}`;
      }

      const now = new Date();
      const activeAlertsCount = await models.SupportTicket.count({
        where: {
          status: { [Op.ne]: 'resolved' },
          [Op.or]: [
            { slaBreached: true },
            { slaExpiresAt: { [Op.lt]: now } }
          ]
        }
      });

      const recentAuditLogs = await models.AdminAuditLog.findAll({
        order: [['createdAt', 'DESC']],
        limit: 10
      });

      const approvalsQueueCount = await models.Center.count({
        where: { isActive: false }
      });

      return {
        totalUsersCount,
        totalCentersCount,
        systemStatus,
        activeAlertsCount,
        recentAuditLogs,
        approvalsQueueCount
      };
    })
  },

  Mutation: {
    updateRolePermissions: authenticate(async (parent, args, context) => {
      const { models } = context;
      const roleType = context.viewer.role?.roleType;

      if (roleType !== 'SUPER_ADMIN') {
        throw new Error('Unauthorized');
      }

      const role = await models.Role.findByPk(args.roleId);
      if (!role) {
        throw new Error('Role not found');
      }

      role.permissions = args.permissions;
      await role.save();

      return role;
    }),

    approveCenter: authenticate(async (parent, args, context) => {
      const { models } = context;
      const role = context.viewer.role?.roleType;

      if (role !== 'SUPER_ADMIN') {
        throw new Error('Unauthorized');
      }

      const center = await models.Center.findByPk(args.centerId);
      if (!center) {
        throw new Error('Center not found');
      }

      center.isActive = args.approved;
      await center.save();

      return center;
    })
  }
};
