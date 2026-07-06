import { authenticate } from '../permissions/index.js';

export const vitalsResolvers = {
  Query: {
    getMyVitals: authenticate(async (parent, args, context) => {
      const { vitalsManager } = context;
      return await vitalsManager.getVitalsHistory(context.viewer.id);
    }),
  },

  Mutation: {
    logVitals: authenticate(async (parent, args, context) => {
      const { vitalsManager } = context;
      return await vitalsManager.logVitals(context.viewer.id, args);
    }),
  }
};
