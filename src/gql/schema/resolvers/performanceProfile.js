import { authenticate } from '../permissions/index.js';
import { PerformanceProfileService } from '../../../modules/platform/performanceProfile.service.js';

export const performanceProfileResolvers = {
  SlowQueryRecord: {
    timestamp: (parent) => new Date(parent.timestamp).toISOString()
  },

  Query: {
    getSlowQueriesReport: authenticate(async (parent, { thresholdMs }, context) => {
      const service = new PerformanceProfileService(context.models);
      return service.getSlowQueriesReport(context.viewer, thresholdMs || 50);
    }),

    runDatabaseIndexDiagnostic: authenticate(async (parent, args, context) => {
      const service = new PerformanceProfileService(context.models);
      return service.runDatabaseIndexDiagnostic(context.viewer);
    })
  },

  Mutation: {
    clearSlowQueryLogs: authenticate(async (parent, args, context) => {
      const service = new PerformanceProfileService(context.models);
      return service.clearSlowQueryLogs(context.viewer);
    })
  }
};
