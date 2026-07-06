import { GraphQLError } from 'graphql';
import {
  authenticate,
  authorizeRoles,
  authorizeSelfOrRoles,
  checkPermissionFor,
} from '../permissions/index.js';
import { calculatePregnancyStats } from '../../../util/pregnancy.js';

export const userResolvers = {
  User: {
    center: async (parent, args, context) => {
      if (parent.center) return parent.center;
      if (!parent.centerId) return null;
      return await context.models.Center.findByPk(parent.centerId);
    },
    role: async (parent, args, context) => {
      if (parent.role) return parent.role;
      if (!parent.roleId) return null;
      return await context.models.Role.findByPk(parent.roleId);
    },
    lmpDate: (parent) => parent.lmpDate,
    dueDate: (parent) => parent.dueDate,
    currentWeek: (parent) => {
      if (!parent.lmpDate && !parent.dueDate) return null;
      const stats = calculatePregnancyStats(parent.lmpDate, parent.dueDate);
      return stats.currentWeek;
    },
    currentTrimester: (parent) => {
      if (!parent.lmpDate && !parent.dueDate) return null;
      const stats = calculatePregnancyStats(parent.lmpDate, parent.dueDate);
      return stats.currentTrimester;
    },
    pregnancyDay: (parent) => {
      if (!parent.lmpDate && !parent.dueDate) return null;
      const stats = calculatePregnancyStats(parent.lmpDate, parent.dueDate);
      return stats.pregnancyDay;
    },
    language: (parent) => parent.language || 'en',
    subscriptionStatus: (parent) => parent.subscriptionStatus || 'free',
  },

  Query: {
    me: authenticate(async (parent, args, context) => {
      return context.viewer;
    }),
    
    getUser: authenticate(checkPermissionFor({ module: 'user', operation: 'view' }, 
      async (parent, args, context) => {
        return await context.userManager.getUserById(args.id);
      }
    )),
    
    getUsers: authenticate(checkPermissionFor({ module: 'user', operation: 'view' },
      async (parent, args, context) => {
        return await context.userManager.getUsersByCenterId(args.isActive);
      }
    )),

    getMyBillingHistory: authenticate(async (parent, args, context) => {
      const { models } = context;
      return await models.Payment.findAll({
        where: { userId: context.viewer.id },
        order: [['createdAt', 'DESC']]
      });
    }),
  },

  Mutation: {
    syncUser: async (parent, args, context) => {
      const { log, authManager } = context;
      if (!context.clerkUserId) {
        throw new GraphQLError('A verified Clerk session is required.', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }
      log.info('Clerk user sync mutation triggered');
      return await authManager.syncClerkUserById(context.clerkUserId);
    },
    
    updateUser: authenticate(authorizeSelfOrRoles((args) => args.id, ['ADMIN'], async (parent, args, context) => {
      const { userManager } = context;
      await userManager.updateUser(args);
      return await userManager.getUserById(args.id);
    })),

    saveOnboarding: authenticate(async (parent, args, context) => {
      const { lmpDate, dueDate, language } = args;
      const user = context.viewer;
      
      let computedLmp = lmpDate;
      let computedDue = dueDate;

      if (lmpDate) {
        const stats = calculatePregnancyStats(lmpDate, null);
        computedDue = stats.dueDate;
      } else if (dueDate) {
        const stats = calculatePregnancyStats(null, dueDate);
        computedLmp = stats.lmpDate;
      }

      user.lmpDate = computedLmp;
      user.dueDate = computedDue;
      user.language = language;
      await user.save();
      return user;
    }),

    createStripeCheckout: authenticate(authorizeRoles(['ADMIN'], async () => {
      throw new GraphQLError('Payments are temporarily unavailable while secure checkout is being configured.', {
        extensions: { code: 'PAYMENTS_NOT_CONFIGURED' },
      });
    })),
  }
};
