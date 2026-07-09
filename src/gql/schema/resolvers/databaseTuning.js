import { authenticate } from '../permissions/index.js';
import { DatabaseTuningService } from '../../../modules/platform/databaseTuning.service.js';

export const databaseTuningResolvers = {
  Query: {
    getDatabaseClusterStatus: authenticate(async (parent, args, context) => {
      const service = new DatabaseTuningService(context.models);
      return service.getDatabaseClusterStatus(context.viewer);
    })
  },

  Mutation: {
    updateConnectionPoolConfig: authenticate(async (parent, { maxConnections, idleTimeoutMs }, context) => {
      const service = new DatabaseTuningService(context.models);
      return service.updateConnectionPoolConfig(context.viewer, maxConnections, idleTimeoutMs);
    }),

    triggerFailoverSimulation: authenticate(async (parent, args, context) => {
      const service = new DatabaseTuningService(context.models);
      return service.triggerFailoverSimulation(context.viewer);
    })
  }
};
