import { authenticate } from '../permissions/index.js';
import { Op } from 'sequelize';

export const adminResolvers = {
  Query: {
    getCenterKpis: authenticate(async (parent, args, context) => {
      const { models } = context;
      const role = context.viewer.role?.roleType;

      if (role !== 'ADMIN') {
        throw new Error('Unauthorized');
      }

      const centerId = context.viewer.centerId;

      // 1. Total active mothers count
      const totalMothers = await models.User.count({
        where: { centerId, isActive: true },
        include: [{
          model: models.Role,
          as: 'role',
          where: { roleType: 'MOTHER' }
        }]
      });

      // 2. Active staff members count (STAFF and GUIDE roles)
      const activeStaff = await models.User.count({
        where: { centerId, isActive: true },
        include: [{
          model: models.Role,
          as: 'role',
          where: { roleType: { [Op.in]: ['STAFF', 'GUIDE'] } }
        }]
      });

      // 3. Premium enrollments count
      const premiumEnrollments = await models.UserSubscription.count({
        where: { status: 'active' },
        include: [{
          model: models.User,
          as: 'user',
          where: { centerId }
        }]
      });

      // 4. SLA breached support tickets
      const now = new Date();
      const slaBreachedTickets = await models.SupportTicket.count({
        where: {
          status: { [Op.ne]: 'resolved' },
          [Op.or]: [
            { slaBreached: true },
            { slaExpiresAt: { [Op.lt]: now } }
          ]
        },
        include: [{
          model: models.User,
          as: 'user',
          where: { centerId }
        }]
      });

      // 5. Enrollment Trends (last 4 weeks)
      const fourWeeksAgo = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);
      const usersLast4Weeks = await models.User.findAll({
        where: {
          centerId,
          createdAt: { [Op.gte]: fourWeeksAgo }
        },
        include: [{
          model: models.Role,
          as: 'role',
          where: { roleType: 'MOTHER' }
        }],
        order: [['createdAt', 'ASC']]
      });

      const enrollmentTrend = [];
      for (let i = 3; i >= 0; i--) {
        const start = new Date(now.getTime() - (i + 1) * 7 * 24 * 60 * 60 * 1000);
        const end = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
        const count = usersLast4Weeks.filter(u => {
          const createdTime = new Date(u.createdAt).getTime();
          return createdTime >= start.getTime() && createdTime < end.getTime();
        }).length;

        enrollmentTrend.push({
          weekLabel: `Week -${i}`,
          count
        });
      }

      // 6. Staff Health & Task Metrics
      const staffUsers = await models.User.findAll({
        where: { centerId, isActive: true },
        include: [{
          model: models.Role,
          as: 'role',
          where: { roleType: { [Op.in]: ['STAFF', 'GUIDE'] } }
        }]
      });

      const staffHealth = [];
      for (const staff of staffUsers) {
        const pendingTasksCount = await models.StaffTask.count({
          where: { staffId: staff.id, completed: false }
        });
        const completedTasksCount = await models.StaffTask.count({
          where: { staffId: staff.id, completed: true }
        });
        staffHealth.push({
          staffId: staff.id,
          displayName: staff.displayName,
          email: staff.emailAddress || staff.email || '',
          pendingTasksCount,
          completedTasksCount
        });
      }

      // 7. Escalated tickets (High priority or SLA breached, unresolved)
      const escalatedTickets = await models.SupportTicket.findAll({
        where: {
          status: { [Op.ne]: 'resolved' },
          [Op.or]: [
            { priority: 'high' },
            { slaBreached: true },
            { slaExpiresAt: { [Op.lt]: now } }
          ]
        },
        include: [{
          model: models.User,
          as: 'user',
          where: { centerId }
        }],
        order: [['createdAt', 'DESC']],
        limit: 5
      });

      return {
        totalMothers,
        activeStaff,
        premiumEnrollments,
        slaBreachedTickets,
        enrollmentTrend,
        staffHealth,
        escalatedTickets
      };
    })
  }
};
