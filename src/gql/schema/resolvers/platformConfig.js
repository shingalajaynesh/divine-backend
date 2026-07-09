import { authenticate } from '../permissions/index.js';
import { PlatformConfigService } from '../../../modules/platform/platformConfig.service.js';

export const platformConfigResolvers = {
  SystemSetting: {
    updatedAt: (parent) => new Date(parent.updatedAt).toISOString()
  },
  FeatureFlag: {
    rules: (parent) => parent.rules ? JSON.stringify(parent.rules) : null,
    updatedAt: (parent) => new Date(parent.updatedAt).toISOString()
  },
  LocaleString: {
    updatedAt: (parent) => new Date(parent.updatedAt).toISOString()
  },

  Query: {
    getSystemSettings: authenticate(async (parent, args, context) => {
      if (context.viewer.role?.roleType !== 'ADMIN' && context.viewer.role?.roleType !== 'STAFF') {
        throw new Error('Unauthorized access');
      }
      const service = new PlatformConfigService(context.models);
      return service.getSystemSettings();
    }),

    getFeatureFlags: authenticate(async (parent, args, context) => {
      if (context.viewer.role?.roleType !== 'ADMIN' && context.viewer.role?.roleType !== 'STAFF') {
        throw new Error('Unauthorized access');
      }
      const service = new PlatformConfigService(context.models);
      return service.getFeatureFlags();
    }),

    getLocaleStrings: async (parent, { lang }, context) => {
      const service = new PlatformConfigService(context.models);
      return service.getLocaleStrings(lang);
    },

    checkFeatureFlag: async (parent, { name }, context) => {
      const service = new PlatformConfigService(context.models);
      return service.checkFeatureFlag(context.viewer, name);
    }
  },

  Mutation: {
    updateSystemSetting: authenticate(async (parent, args, context) => {
      const service = new PlatformConfigService(context.models);
      return service.updateSystemSetting(context.viewer, args);
    }),

    updateFeatureFlag: authenticate(async (parent, args, context) => {
      const service = new PlatformConfigService(context.models);
      return service.updateFeatureFlag(context.viewer, args);
    }),

    upsertLocaleString: authenticate(async (parent, args, context) => {
      const service = new PlatformConfigService(context.models);
      return service.upsertLocaleString(context.viewer, args);
    })
  }
};
