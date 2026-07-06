import { authenticate } from '../permissions/index.js';

export const notificationResolvers = {
  Query: {
    myNotifications: authenticate((parent, args, context) => context.notificationManager.inbox(args)),
    myNotificationPreferences: authenticate((parent, args, context) => context.notificationManager.preferences()),
    myReminderSchedules: authenticate((parent, args, context) => context.notificationManager.reminderSchedules()),
  },
  Mutation: {
    setNotificationStatus: authenticate((parent, args, context) => context.notificationManager.setNotificationStatus(args.id, args.status)),
    markAllNotificationsRead: authenticate((parent, args, context) => context.notificationManager.markAllRead()),
    updateNotificationPreferences: authenticate((parent, args, context) => context.notificationManager.updatePreferences(args.input)),
    saveReminderSchedule: authenticate((parent, args, context) => context.notificationManager.saveReminder(args.input)),
    deleteReminderSchedule: authenticate((parent, args, context) => context.notificationManager.deleteReminder(args.id)),
  },
};
