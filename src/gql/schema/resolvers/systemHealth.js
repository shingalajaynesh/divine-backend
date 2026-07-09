import { authenticate } from '../permissions/index.js';
import { SystemHealthService } from '../../../modules/platform/systemHealth.service.js';

export const systemHealthResolvers = {
  SystemMetric: {
    timestamp: (parent) => new Date(parent.timestamp).toISOString()
  },

  Query: {
    getServerDiagnostics: authenticate(async (parent, args, context) => {
      const service = new SystemHealthService(context.models);
      return service.getServerDiagnostics(context.viewer);
    }),

    getSystemMetricsHistory: authenticate(async (parent, { metricType }, context) => {
      const service = new SystemHealthService(context.models);
      return service.getSystemMetricsHistory(context.viewer, metricType);
    }),

    exportSystemLogs: authenticate(async (parent, { limit }, context) => {
      const service = new SystemHealthService(context.models);
      return service.exportSystemLogs(context.viewer, limit || 100);
    })
  }
};
