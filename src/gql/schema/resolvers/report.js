import { authenticate } from '../permissions/index.js';
import { ReportService } from '../../../modules/report/report.service.js';

export const reportResolvers = {
  ReportTemplate: {
    filters: (parent) => parent.filters ? JSON.stringify(parent.filters) : null,
    widgets: (parent) => JSON.stringify(parent.widgets),
    createdAt: (parent) => new Date(parent.createdAt).toISOString(),
    updatedAt: (parent) => new Date(parent.updatedAt).toISOString()
  },

  Query: {
    getReportTemplates: authenticate(async (parent, { role }, context) => {
      const service = new ReportService(context.models, context.sequelize);
      return service.getReportTemplates(role);
    }),

    getReportData: authenticate(async (parent, { templateId, filters }, context) => {
      const service = new ReportService(context.models, context.sequelize);
      return service.getReportData(context.viewer, templateId, filters);
    })
  },

  Mutation: {
    createReportTemplate: authenticate(async (parent, args, context) => {
      const service = new ReportService(context.models, context.sequelize);
      return service.createReportTemplate(context.viewer, args);
    }),

    deleteReportTemplate: authenticate(async (parent, { id }, context) => {
      const service = new ReportService(context.models, context.sequelize);
      return service.deleteReportTemplate(context.viewer, id);
    })
  }
};
