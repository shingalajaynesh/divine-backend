import { authenticate } from '../permissions/index.js';
import { NotificationCampaignService } from '../../../modules/notification/notification.service.js';
import { ReminderRulesService } from '../../../modules/notification/reminderRules.service.js';

export const notificationResolvers = {
  NotificationDelivery: {
    notification: async (parent, args, context) => {
      return await context.models.Notification.findByPk(parent.notificationId);
    }
  },

  ReminderRule: {
    triggerCondition: (parent) => {
      return JSON.stringify(parent.triggerCondition || {});
    }
  },

  Query: {
    myNotifications: authenticate((parent, args, context) => context.notificationManager.inbox(args)),
    myNotificationPreferences: authenticate((parent, args, context) => context.notificationManager.preferences()),
    myReminderSchedules: authenticate((parent, args, context) => context.notificationManager.reminderSchedules()),
    getNotificationDeliveriesReport: authenticate(async (parent, { limit }, context) => {
      const service = new NotificationCampaignService(context.models, context.sequelize);
      return service.getDeliveriesReport(context.viewer, limit);
    }),
    getCampaignPerformance: authenticate(async (parent, { notificationId }, context) => {
      const service = new NotificationCampaignService(context.models, context.sequelize);
      return service.getCampaignPerformance(context.viewer, notificationId);
    }),
    getReminderRules: authenticate(async (parent, args, context) => {
      const service = new ReminderRulesService(context.models, context.sequelize);
      return service.getReminderRules(context.viewer);
    }),
  },
  Mutation: {
    setNotificationStatus: authenticate((parent, args, context) => context.notificationManager.setNotificationStatus(args.id, args.status)),
    markAllNotificationsRead: authenticate((parent, args, context) => context.notificationManager.markAllRead()),
    updateNotificationPreferences: authenticate((parent, args, context) => context.notificationManager.updatePreferences(args.input)),
    saveReminderSchedule: authenticate((parent, args, context) => context.notificationManager.saveReminder(args.input)),
    deleteReminderSchedule: authenticate((parent, args, context) => context.notificationManager.deleteReminder(args.id)),
    dispatchDailyReminders: authenticate(async (parent, args, context) => {
      const { ReminderOrchestrator } = await import('../../../services/reminderOrchestrator.js');
      const orchestrator = new ReminderOrchestrator(context.models);
      return orchestrator.orchestrateDailyReminders(context.viewer.centerId);
    }),
    createNotificationCampaign: authenticate(async (parent, args, context) => {
      const service = new NotificationCampaignService(context.models, context.sequelize);
      return service.createCampaign(context.viewer, args);
    }),
    triggerCampaignDispatched: authenticate(async (parent, { notificationId }, context) => {
      const service = new NotificationCampaignService(context.models, context.sequelize);
      return service.triggerCampaignDispatched(context.viewer, notificationId);
    }),
    createReminderRule: authenticate(async (parent, args, context) => {
      const service = new ReminderRulesService(context.models, context.sequelize);
      return service.createReminderRule(context.viewer, {
        ...args,
        triggerCondition: JSON.parse(args.triggerConditionJson)
      });
    }),
    updateReminderRule: authenticate(async (parent, args, context) => {
      const service = new ReminderRulesService(context.models, context.sequelize);
      const { id, ...updateFields } = args;
      if (args.triggerConditionJson) {
        updateFields.triggerCondition = JSON.parse(args.triggerConditionJson);
        delete updateFields.triggerConditionJson;
      }
      return service.updateReminderRule(context.viewer, id, updateFields);
    }),
    deleteReminderRule: authenticate(async (parent, { id }, context) => {
      const service = new ReminderRulesService(context.models, context.sequelize);
      return service.deleteReminderRule(context.viewer, id);
    }),
    runReminderRulesEngine: authenticate(async (parent, args, context) => {
      const service = new ReminderRulesService(context.models, context.sequelize);
      return service.runReminderRulesEngine(context.viewer);
    }),
  },
};
