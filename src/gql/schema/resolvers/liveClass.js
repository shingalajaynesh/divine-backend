import { authenticate } from '../permissions/index.js';
import { LiveClassService } from '../../../modules/liveClass/liveClass.service.js';

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
    startTime: (parent) => {
      const d = typeof parent.startTime === 'string' ? new Date(parent.startTime) : parent.startTime;
      return d.toISOString();
    }
  },

  Query: {
    getLiveClasses: authenticate(async (parent, args, context) => {
      return await context.models.LiveClass.findAll({
        order: [['startTime', 'ASC']]
      });
    }),

    getLiveClassesDetailed: authenticate(async (parent, args, context) => {
      const service = new LiveClassService(context.models, context.sequelize);
      return service.getLiveClasses(context.viewer.id);
    })
  },

  Mutation: {
    bookLiveClass: authenticate(async (parent, args, context) => {
      const liveClass = await context.models.LiveClass.findByPk(args.classId);
      if (!liveClass) throw new Error('Live class not found');
      await liveClass.addAttendee(context.viewer);
      return liveClass;
    }),

    bookLiveClassDetailed: authenticate(async (parent, { liveClassId }, context) => {
      const service = new LiveClassService(context.models, context.sequelize);
      return service.bookLiveClass(context.viewer.id, liveClassId);
    }),

    submitLiveClassFeedback: authenticate(async (parent, { input }, context) => {
      const service = new LiveClassService(context.models, context.sequelize);
      return service.submitLiveClassFeedback(context.viewer.id, input);
    }),

    updateLiveClassReplay: authenticate(async (parent, { liveClassId, replayUrl }, context) => {
      // Check admin/staff authorization
      if (context.viewer.role?.roleType !== 'ADMIN' && context.viewer.role?.roleType !== 'STAFF') {
        throw new Error('Unauthorized');
      }
      const service = new LiveClassService(context.models, context.sequelize);
      return service.updateReplayUrl(liveClassId, replayUrl);
    })
  }
};
