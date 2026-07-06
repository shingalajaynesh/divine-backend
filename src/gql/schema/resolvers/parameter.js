import { authenticate } from '../permissions/index.js';

export const parameterResolvers = {
  Query: {
    getParameterConfig: authenticate(async (parent, args, context) => {
      const { parameterManager } = context;
      return await parameterManager.getParameter(args.key, context.viewer.centerId);
    }),
  },

  Mutation: {
    setSystemParameter: authenticate(async (parent, args, context) => {
      if (context.viewer.role?.roleType !== 'ADMIN') {
        throw new Error('Unauthorized. Admin privilege required.');
      }
      const { parameterManager } = context;
      return await parameterManager.setParameter(args.key, args.value, context.viewer.centerId);
    }),
  }
};
