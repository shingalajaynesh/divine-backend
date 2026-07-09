import { authenticate } from '../permissions/index.js';
import { SpecialEventService } from '../../../modules/specialEvent/specialEvent.service.js';

export const specialEventResolvers = {
  EventRegistration: {
    user: async (parent, args, context) => {
      if (parent.user) return parent.user;
      return await context.models.User.findByPk(parent.userId);
    },
    event: async (parent, args, context) => {
      return await context.models.SpecialEvent.findByPk(parent.eventId);
    }
  },

  Query: {
    getSpecialEvents: authenticate(async (parent, { eventType }, context) => {
      const service = new SpecialEventService(context.models, context.sequelize);
      return service.getSpecialEvents(context.viewer, eventType);
    }),
    getEventAttendees: authenticate(async (parent, { eventId }, context) => {
      const service = new SpecialEventService(context.models, context.sequelize);
      return service.getEventAttendees(context.viewer, eventId);
    })
  },

  Mutation: {
    createSpecialEvent: authenticate(async (parent, args, context) => {
      const service = new SpecialEventService(context.models, context.sequelize);
      return service.createSpecialEvent(context.viewer, args);
    }),
    updateSpecialEvent: authenticate(async (parent, args, context) => {
      const service = new SpecialEventService(context.models, context.sequelize);
      const { id, ...input } = args;
      return service.updateSpecialEvent(context.viewer, id, input);
    }),
    deleteSpecialEvent: authenticate(async (parent, { id }, context) => {
      const service = new SpecialEventService(context.models, context.sequelize);
      return service.deleteSpecialEvent(context.viewer, id);
    }),
    registerForEvent: authenticate(async (parent, { eventId }, context) => {
      const service = new SpecialEventService(context.models, context.sequelize);
      return service.registerForEvent(context.viewer, eventId);
    }),
    checkInToEvent: authenticate(async (parent, { registrationId }, context) => {
      const service = new SpecialEventService(context.models, context.sequelize);
      return service.checkInToEvent(context.viewer, registrationId);
    }),
    submitEventFeedback: authenticate(async (parent, { eventId, rating, feedbackText }, context) => {
      const service = new SpecialEventService(context.models, context.sequelize);
      return service.submitEventFeedback(context.viewer, eventId, rating, feedbackText);
    })
  }
};
