import { authenticate } from '../permissions/index.js';

export const liveClassResolvers = {
  LiveClass: {
    title: (parent, args, context) => {
      const lang = context.viewer?.language || 'en';
      return lang === 'hi' ? parent.titleHi : parent.titleEn;
    },
    isBooked: async (parent, args, context) => {
      if (!context.viewer) return false;
      const count = await parent.countAttendees({ where: { id: context.viewer.id } });
      return count > 0;
    },
    startTime: (parent) => parent.startTime.toISOString()
  },

  Query: {
    getLiveClasses: authenticate(async (parent, args, context) => {
      return await context.models.LiveClass.findAll({
        order: [['startTime', 'ASC']]
      });
    }),
  },

  Mutation: {
    bookLiveClass: authenticate(async (parent, args, context) => {
      const liveClass = await context.models.LiveClass.findByPk(args.classId);
      if (!liveClass) throw new Error('Live class not found');
      await liveClass.addAttendee(context.viewer);
      return liveClass;
    }),
  }
};
