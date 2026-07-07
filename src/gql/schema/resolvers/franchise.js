import { authenticate } from '../permissions/index.js';
import { Op } from 'sequelize';

export const franchiseResolvers = {
  Query: {
    getFranchiseMetrics: authenticate(async (parent, args, context) => {
      const { models } = context;
      const role = context.viewer.role?.roleType;

      if (role !== 'FRANCHISE_ADMIN' && role !== 'ADMIN') {
        throw new Error('Unauthorized');
      }

      const centers = await models.Center.findAll({ where: { isActive: true } });
      const centersCount = centers.length;

      // 1. Total mothers count in database
      const totalMothersCount = await models.User.count({
        where: { isActive: true },
        include: [{
          model: models.Role,
          as: 'role',
          where: { roleType: 'MOTHER' }
        }]
      });

      // 2. SLA alert tickets count across all centers
      const now = new Date();
      const slaAlertsCount = await models.SupportTicket.count({
        where: {
          status: { [Op.ne]: 'resolved' },
          [Op.or]: [
            { slaBreached: true },
            { slaExpiresAt: { [Op.lt]: now } }
          ]
        }
      });

      // 3. Compile center rankings & benchmarking
      const rankingPoints = [];
      let totalStaffResponseSum = 0;

      for (const center of centers) {
        // Registered mothers
        const mothersCount = await models.User.count({
          where: { centerId: center.id, isActive: true },
          include: [{
            model: models.Role,
            as: 'role',
            where: { roleType: 'MOTHER' }
          }]
        });

        // Subscriptions count
        const activeSubscriptionsCount = await models.UserSubscription.count({
          where: { status: 'active' },
          include: [{
            model: models.User,
            as: 'user',
            where: { centerId: center.id }
          }]
        });

        // Staff tasks completion stats
        const staffList = await models.User.findAll({
          where: { centerId: center.id, isActive: true },
          include: [{
            model: models.Role,
            as: 'role',
            where: { roleType: { [Op.in]: ['STAFF', 'GUIDE'] } }
          }]
        });

        let totalCompleted = 0;
        let totalPending = 0;
        for (const staff of staffList) {
          const c = await models.StaffTask.count({ where: { staffId: staff.id, completed: true } });
          const p = await models.StaffTask.count({ where: { staffId: staff.id, completed: false } });
          totalCompleted += c;
          totalPending += p;
        }

        const totalTasks = totalCompleted + totalPending;
        const staffResponsePercent = totalTasks > 0 ? (totalCompleted / totalTasks) * 100 : 100.0;
        totalStaffResponseSum += staffResponsePercent;

        rankingPoints.push({
          centerId: center.id,
          centerName: center.name,
          mothersCount,
          activeSubscriptionsCount,
          staffResponsePercent: parseFloat(staffResponsePercent.toFixed(1))
        });
      }

      // Sort by mothersCount DESC to rank them
      rankingPoints.sort((a, b) => b.mothersCount - a.mothersCount);
      const centerRankings = rankingPoints.map((point, index) => ({
        ...point,
        rank: index + 1
      }));

      const averageStaffResponsePercent = centersCount > 0 
        ? parseFloat((totalStaffResponseSum / centersCount).toFixed(1))
        : 100.0;

      // 4. Monthly Center Growth comparisons (last 3 months)
      const centerGrowthStats = [];
      for (const center of centers) {
        const months = [];
        for (let i = 2; i >= 0; i--) {
          const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
          const monthLabel = start.toLocaleString('default', { month: 'short' });

          const count = await models.User.count({
            where: {
              centerId: center.id,
              createdAt: { [Op.gte]: start, [Op.lt]: end }
            },
            include: [{
              model: models.Role,
              as: 'role',
              where: { roleType: 'MOTHER' }
            }]
          });

          months.push({
            monthLabel,
            count
          });
        }

        centerGrowthStats.push({
          centerName: center.name,
          months
        });
      }

      return {
        centersCount,
        totalMothersCount,
        averageStaffResponsePercent,
        slaAlertsCount,
        centerRankings,
        centerGrowthStats
      };
    })
  }
};
