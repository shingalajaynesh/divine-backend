import { v4 as uuidv4 } from 'uuid';

export class ReportService {
  constructor(models, sequelize) {
    this.models = models;
    this.sequelize = sequelize;
  }

  // 1. Create a Saved Report Template
  async createReportTemplate(viewer, { title, description, role, filters, widgets }) {
    if (viewer.role?.roleType !== 'ADMIN' && viewer.role?.roleType !== 'STAFF') {
      throw new Error('Unauthorized access');
    }

    return this.models.ReportTemplate.create({
      id: uuidv4(),
      title,
      description,
      role,
      filters: typeof filters === 'string' ? JSON.parse(filters) : filters,
      widgets: typeof widgets === 'string' ? JSON.parse(widgets) : widgets,
      createdBy: viewer.id
    });
  }

  // 2. Fetch Templates
  async getReportTemplates(role) {
    const where = {};
    if (role) where.role = role;
    return this.models.ReportTemplate.findAll({
      where,
      order: [['createdAt', 'DESC']]
    });
  }

  // 3. Delete Template
  async deleteReportTemplate(viewer, id) {
    if (viewer.role?.roleType !== 'ADMIN' && viewer.role?.roleType !== 'STAFF') {
      throw new Error('Unauthorized access');
    }

    const template = await this.models.ReportTemplate.findByPk(id);
    if (!template) throw new Error('Report template not found');

    await template.destroy();
    return true;
  }

  // 4. Compile Dashboard Metrics dynamically
  async getReportData(viewer, templateId, customFilters) {
    const template = await this.models.ReportTemplate.findByPk(templateId);
    if (!template) throw new Error('Report template not found');

    const role = template.role;
    const parsedFilters = typeof customFilters === 'string' ? JSON.parse(customFilters) : (customFilters || template.filters || {});
    const centerId = parsedFilters.centerId || viewer.centerId || null;

    const data = {};

    if (role === 'MOTHER') {
      // Aggregate maternal indicators (uses viewer userId if no specific user is passed)
      const targetUserId = parsedFilters.userId || viewer.id;
      
      const vitalsCount = await this.models.VitalsLog.count({ where: { userId: targetUserId } });
      const bookmarksCount = await this.models.ContentBookmark.count({ where: { userId: targetUserId } });
      const progressCount = await this.models.ActivityProgress.count({ where: { userId: targetUserId } });

      data.metrics = JSON.stringify({
        vitalsCount,
        bookmarksCount,
        progressCount,
        streakDays: 5, // mock streak
        trimester: 'Trimester 2'
      });
    }

    else if (role === 'PARTNER') {
      const targetUserId = parsedFilters.userId || viewer.id;
      const partnerActivitiesCount = await this.models.PartnerActivityLog?.count({ where: { userId: targetUserId } }) || 0;
      const sensoryActivitiesCount = await this.models.SensoryActivityLog?.count({ where: { userId: targetUserId } }) || 0;

      data.metrics = JSON.stringify({
        partnerActivitiesCount,
        sensoryActivitiesCount,
        checklistsCompleted: partnerActivitiesCount,
        status: 'Highly Engaged'
      });
    }

    else if (role === 'CENTER') {
      // Aggregate Center specific metrics
      const activeMothers = await this.models.User.count({
        where: { centerId, subscriptionStatus: ['standard', 'premium'] }
      });

      const upcomingAppointments = await this.models.Appointment?.count({
        where: { centerId, status: 'scheduled' }
      }) || 0;

      const counselingCallsCount = await this.models.CounselingCall?.count({
        include: [{
          model: this.models.CounselingLead,
          as: 'lead',
          where: { centerId }
        }]
      }) || 0;

      // Sum of local center payment revenue
      const centerTxs = await this.models.FinancialTransaction.findAll({
        where: { centerId, type: 'payment' }
      });
      const localRevenue = centerTxs.reduce((sum, tx) => sum + parseFloat(tx.amount), 0.0);

      data.metrics = JSON.stringify({
        activeMothers,
        upcomingAppointments,
        counselingCallsCount,
        localRevenue,
        centerId
      });
    }

    else if (role === 'FRANCHISE') {
      // Franchise level totals (aggregates across centers)
      const centers = await this.models.Center.findAll();
      const centerRevenueBreakdown = [];
      let totalFranchiseRevenue = 0;

      for (const center of centers) {
        const txs = await this.models.FinancialTransaction.findAll({
          where: { centerId: center.id, type: 'payment' }
        });
        const revenue = txs.reduce((sum, tx) => sum + parseFloat(tx.amount), 0.0);
        totalFranchiseRevenue += revenue;
        centerRevenueBreakdown.push({
          centerId: center.id,
          name: center.name,
          revenue
        });
      }

      const totalLeads = await this.models.CounselingLead?.count() || 0;
      const convertedLeads = await this.models.CounselingLead?.count({ where: { status: 'converted' } }) || 0;

      data.metrics = JSON.stringify({
        totalFranchiseRevenue,
        centerRevenueBreakdown,
        leadsConversionRate: totalLeads > 0 ? (convertedLeads / totalLeads) * 100 : 0.0,
        activeCentersCount: centers.length
      });
    }

    else if (role === 'STAFF') {
      // Staff analytics
      const tasksCompleted = await this.models.StaffTask?.count({
        where: { assignedTo: viewer.id, status: 'completed' }
      }) || 0;

      const pendingTickets = await this.models.SupportTicket?.count({
        where: { assignedTo: viewer.id, status: 'open' }
      }) || 0;

      data.metrics = JSON.stringify({
        tasksCompleted,
        pendingTickets,
        counselingCallsAssigned: 8, // mock
        satisfactionRating: 4.8
      });
    }

    else if (role === 'PLATFORM') {
      // Global metrics
      const totalUsers = await this.models.User.count();
      const premiumUsers = await this.models.User.count({ where: { subscriptionStatus: 'premium' } });
      const storeRevenueTxs = await this.models.Payment.findAll({ where: { status: 'succeeded' } });
      const grossRevenue = storeRevenueTxs.reduce((sum, pay) => sum + parseFloat(pay.amount), 0.0);

      data.metrics = JSON.stringify({
        totalUsers,
        premiumUsers,
        premiumConversionRatio: totalUsers > 0 ? (premiumUsers / totalUsers) * 100 : 0.0,
        grossRevenue,
        serverUptime: '99.98%'
      });
    }

    return {
      templateId,
      metrics: data.metrics
    };
  }
}
