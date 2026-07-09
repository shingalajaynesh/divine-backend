import { authenticate } from '../permissions/index.js';
import { ReportScheduleService } from '../../../modules/report/reportSchedule.service.js';

export const reportScheduleResolvers = {
  ReportSchedule: {
    nextRunAt: (parent) => new Date(parent.nextRunAt).toISOString(),
    createdAt: (parent) => new Date(parent.createdAt).toISOString(),
    template: async (parent, args, context) => {
      if (parent.template) return parent.template;
      return context.models.ReportTemplate.findByPk(parent.templateId);
    }
  },

  Query: {
    getReportSchedules: authenticate(async (parent, args, context) => {
      if (context.viewer.role?.roleType !== 'ADMIN' && context.viewer.role?.roleType !== 'STAFF') {
        throw new Error('Unauthorized access');
      }
      const service = new ReportScheduleService(context.models, context.sequelize);
      return service.getReportSchedules();
    })
  },

  Mutation: {
    shareReportTemplate: authenticate(async (parent, { templateId, roles }, context) => {
      const service = new ReportScheduleService(context.models, context.sequelize);
      return service.shareReportTemplate(context.viewer, templateId, roles);
    }),

    createReportSchedule: authenticate(async (parent, args, context) => {
      const service = new ReportScheduleService(context.models, context.sequelize);
      return service.createReportSchedule(context.viewer, args);
    }),

    deleteReportSchedule: authenticate(async (parent, { id }, context) => {
      const service = new ReportScheduleService(context.models, context.sequelize);
      return service.deleteReportSchedule(context.viewer, id);
    }),

    processScheduledReports: authenticate(async (parent, args, context) => {
      if (context.viewer.role?.roleType !== 'ADMIN' && context.viewer.role?.roleType !== 'STAFF') {
        throw new Error('Unauthorized access');
      }
      const service = new ReportScheduleService(context.models, context.sequelize);
      const dispatches = await service.processScheduledReports();
      return JSON.stringify(dispatches);
    })
  }
};
