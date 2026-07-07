import { authenticate } from '../permissions/index.js';

export const vitalsResolvers = {
  Query: {
    getMyVitals: authenticate(async (parent, args, context) => {
      const { vitalsManager } = context;
      let targetUserId = context.viewer.id;

      if (context.viewer.role?.roleType === 'PARTNER') {
        if (!context.viewer.partnerId) {
          return [];
        }
        const mother = await context.models.User.findByPk(context.viewer.partnerId);
        if (!mother || !mother.shareVitalsWithPartner) {
          return [];
        }
        targetUserId = mother.id;
      }

      return await vitalsManager.getVitalsHistory(targetUserId);
    }),
  },

  Mutation: {
    logVitals: authenticate(async (parent, args, context) => {
      const { vitalsManager } = context;
      return await vitalsManager.logVitals(context.viewer.id, args);
    }),
  }
};
