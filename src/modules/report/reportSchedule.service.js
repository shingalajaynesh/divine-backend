import { v4 as uuidv4 } from 'uuid';
import { ReportService } from './report.service.js';

export class ReportScheduleService {
  constructor(models, sequelize) {
    this.models = models;
    this.sequelize = sequelize;
  }

  // 1. Configure report schedule
  async createReportSchedule(viewer, { templateId, frequency, recipientEmails }) {
    if (viewer.role?.roleType !== 'ADMIN' && viewer.role?.roleType !== 'STAFF') {
      throw new Error('Unauthorized access');
    }

    const template = await this.models.ReportTemplate.findByPk(templateId);
    if (!template) throw new Error('Report template not found');

    const nextRun = new Date();
    if (frequency === 'daily') nextRun.setDate(nextRun.getDate() + 1);
    else if (frequency === 'weekly') nextRun.setDate(nextRun.getDate() + 7);
    else if (frequency === 'monthly') nextRun.setMonth(nextRun.getMonth() + 1);
    else throw new Error('Invalid frequency selected');

    return this.models.ReportSchedule.create({
      id: uuidv4(),
      templateId,
      frequency,
      recipientEmails: recipientEmails.trim(),
      nextRunAt: nextRun,
      isActive: true,
      createdBy: viewer.id
    });
  }

  // 2. Fetch schedules
  async getReportSchedules() {
    return this.models.ReportSchedule.findAll({
      include: [{ model: this.models.ReportTemplate, as: 'template' }],
      order: [['createdAt', 'DESC']]
    });
  }

  // 3. Delete schedule
  async deleteReportSchedule(viewer, id) {
    if (viewer.role?.roleType !== 'ADMIN' && viewer.role?.roleType !== 'STAFF') {
      throw new Error('Unauthorized access');
    }

    const schedule = await this.models.ReportSchedule.findByPk(id);
    if (!schedule) throw new Error('Report schedule not found');

    await schedule.destroy();
    return true;
  }

  // 4. Share report dashboard with specific role levels
  async shareReportTemplate(viewer, templateId, roles) {
    if (viewer.role?.roleType !== 'ADMIN' && viewer.role?.roleType !== 'STAFF') {
      throw new Error('Unauthorized access');
    }

    const template = await this.models.ReportTemplate.findByPk(templateId);
    if (!template) throw new Error('Report template not found');

    template.sharedWithRoles = roles?.trim() || null;
    await template.save();

    return template;
  }

  // 5. Scheduled reports cron dispatcher runner
  async processScheduledReports() {
    const now = new Date();
    const dueSchedules = await this.models.ReportSchedule.findAll({
      where: {
        isActive: true,
        nextRunAt: {
          [this.models.Sequelize.Op.lte]: now
        }
      },
      include: [{ model: this.models.ReportTemplate, as: 'template' }]
    });

    const reportService = new ReportService(this.models, this.sequelize);
    const dispatches = [];

    for (const sched of dueSchedules) {
      // Run report aggregation
      const reportData = await reportService.getReportData(
        { id: sched.createdBy, centerId: null }, // Mock viewer
        sched.templateId,
        sched.template?.filters || '{}'
      );

      // Increment next run date
      const nextRun = new Date(sched.nextRunAt);
      if (sched.frequency === 'daily') nextRun.setDate(nextRun.getDate() + 1);
      else if (sched.frequency === 'weekly') nextRun.setDate(nextRun.getDate() + 7);
      else if (sched.frequency === 'monthly') nextRun.setMonth(nextRun.getMonth() + 1);

      sched.nextRunAt = nextRun;
      await sched.save();

      dispatches.push({
        scheduleId: sched.id,
        templateTitle: sched.template?.title,
        recipientEmails: sched.recipientEmails,
        metrics: reportData.metrics,
        dispatchedAt: new Date()
      });
    }

    return dispatches;
  }
}
