import { authenticate } from '../permissions/index.js';
import { DevOpsService } from '../../../modules/platform/devops.service.js';

export const devopsResolvers = {
  DatabaseBackup: {
    timestamp: (parent) => new Date(parent.timestamp).toISOString()
  },

  Query: {
    getEnvironmentStatus: authenticate(async (parent, args, context) => {
      const service = new DevOpsService(context.models);
      return service.getEnvironmentStatus(context.viewer);
    }),

    getBackupHistory: authenticate(async (parent, args, context) => {
      const service = new DevOpsService(context.models);
      return service.getBackupHistory(context.viewer);
    })
  },

  Mutation: {
    triggerBackupDrill: authenticate(async (parent, args, context) => {
      const service = new DevOpsService(context.models);
      return service.triggerBackupDrill(context.viewer);
    }),

    triggerRestoreDrill: authenticate(async (parent, { backupId }, context) => {
      const service = new DevOpsService(context.models);
      return service.triggerRestoreDrill(context.viewer, backupId);
    })
  }
};
