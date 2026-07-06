import { authenticate, authorizeRoles } from '../permissions/index.js';

export const contentResolvers = {
  DailyContent: {
    title: (parent, args, context) => {
      const lang = context.viewer?.language || 'en';
      return lang === 'hi' ? parent.titleHi : parent.titleEn;
    },
    body: (parent, args, context) => {
      const lang = context.viewer?.language || 'en';
      return lang === 'hi' ? parent.bodyHi : parent.bodyEn;
    }
  },

  BabyDevelopment: {
    size: (parent, args, context) => {
      const lang = context.viewer?.language || 'en';
      return lang === 'hi' ? parent.sizeHi : parent.sizeEn;
    },
    milestone: (parent, args, context) => {
      const lang = context.viewer?.language || 'en';
      return lang === 'hi' ? parent.milestoneHi : parent.milestoneEn;
    }
  },

  Query: {
    getDailyContent: authenticate(async (parent, args, context) => {
      return await context.models.DailyContent.findOne({
        where: { dayNumber: args.dayNumber }
      });
    }),

    getContentLibrary: authenticate(async (parent, args, context) => {
      return await context.models.DailyContent.findAll({
        where: { category: args.category },
        order: [['dayNumber', 'ASC']]
      });
    }),

    getBabyDevelopment: authenticate(async (parent, args, context) => {
      return await context.models.BabyDevelopment.findOne({
        where: { weekNumber: args.weekNumber }
      });
    }),

    getGuidedAudioSessions: authenticate(async (parent, args, context) => {
      return await context.models.DailyContent.findAll({
        where: { category: ['mantra', 'music'] },
        order: [['dayNumber', 'ASC']]
      });
    }),
  },

  Mutation: {
    adminAddContent: authenticate(authorizeRoles(['ADMIN'], async (parent, args, context) => {
      return await context.models.DailyContent.create(args);
    })),
  }
};
