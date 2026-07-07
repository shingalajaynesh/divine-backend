import { Op } from 'sequelize';
import { calculatePregnancyStats } from '../util/pregnancy.js';
import Logger from '../util/logger.js';

const log = new Logger('ReminderOrchestrator');

export class ReminderOrchestrator {
  constructor(models) {
    this.models = models;
  }

  async orchestrateDailyReminders(centerId) {
    log.info(`Starting daily reminder orchestration for center: ${centerId || 'All'}`);

    const userWhere = { isActive: true };
    if (centerId) {
      userWhere.centerId = centerId;
    }

    const users = await this.models.User.findAll({ where: userWhere });
    let totalRemindersSent = 0;
    const reportDetails = [];

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    for (const user of users) {
      const isHi = (user.language || 'en') === 'hi';
      const compiledReminders = [];

      // 1. Unfinished Quotient Tasks for Today
      const stats = calculatePregnancyStats(user.lmpDate, user.dueDate);
      const pregnancyDay = stats.pregnancyDay || 1;

      const progress = await this.models.DailyProgress.findOne({
        where: { userId: user.id, dayNumber: pregnancyDay }
      });

      const missingQuotients = [];
      if (!progress || !progress.pqCompleted) missingQuotients.push(isHi ? 'शारीरिक (PQ)' : 'Physical (PQ)');
      if (!progress || !progress.iqCompleted) missingQuotients.push(isHi ? 'बौद्धिक (IQ)' : 'Intellectual (IQ)');
      if (!progress || !progress.eqCompleted) missingQuotients.push(isHi ? 'भावनात्मक (EQ)' : 'Emotional (EQ)');
      if (!progress || !progress.sqCompleted) missingQuotients.push(isHi ? 'आध्यात्मिक (SQ)' : 'Spiritual (SQ)');

      if (missingQuotients.length > 0) {
        compiledReminders.push({
          title: isHi ? 'अधूरी दैनिक गतिविधियां 🧘‍♀️' : 'Unfinished Daily Activities 🧘‍♀️',
          body: isHi 
            ? `आपकी आज की गतिविधियाँ: ${missingQuotients.join(', ')} कार्य अभी भी लंबित हैं। कृपया इन्हें पूरा करें!`
            : `Your today's activities: ${missingQuotients.join(', ')} tasks are still pending. Complete them now!`,
          actionUrl: '/dashboard'
        });
      }

      // 2. Active Medicine Reminders
      const activeMeds = await this.models.MedicineReminder.findAll({
        where: { userId: user.id, active: true }
      });

      for (const med of activeMeds) {
        compiledReminders.push({
          title: isHi ? '💊 दवा अनुस्मारक' : '💊 Medication Reminder',
          body: isHi
            ? `दवा लेने का समय: ${med.name} (${med.dosage}) - समय: ${med.timeOfDay}`
            : `Time to take: ${med.name} (${med.dosage}) - Scheduled: ${med.timeOfDay}`,
          actionUrl: '/vitals'
        });
      }

      // 3. Booked Live Classes for Today
      const bookings = await this.models.LiveClassBooking.findAll({
        where: { userId: user.id }
      });

      if (bookings.length > 0) {
        const bookedClassIds = bookings.map(b => b.liveClassId);
        const todayClasses = await this.models.LiveClass.findAll({
          where: {
            id: bookedClassIds,
            startTime: { [Op.between]: [todayStart, todayEnd] }
          }
        });

        for (const liveClass of todayClasses) {
          compiledReminders.push({
            title: isHi ? '🎥 लाइव क्लास अलर्ट' : '🎥 Live Class Alert',
            body: isHi
              ? `आपकी लाइव क्लास "${liveClass.titleHi}" आज ${new Date(liveClass.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} पर शुरू होगी।`
              : `Your booked live class "${liveClass.titleEn}" starts today at ${new Date(liveClass.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`,
            actionUrl: '/classes'
          });
        }
      }

      // 4. Save compiled reminders as unread Notifications
      for (const rem of compiledReminders) {
        await this.models.Notification.create({
          userId: user.id,
          centerId: user.centerId,
          kind: 'REMINDER',
          title: rem.title,
          body: rem.body,
          actionUrl: rem.actionUrl,
          status: 'unread',
          scheduledAt: new Date()
        });
        totalRemindersSent++;
      }

      if (compiledReminders.length > 0) {
        reportDetails.push(`Dispatched ${compiledReminders.length} reminders to ${user.displayName || user.emailAddress}`);
      }
    }

    log.info(`Completed daily reminder orchestration. Total notifications created: ${totalRemindersSent}`);
    return {
      success: true,
      remindersSent: totalRemindersSent,
      details: reportDetails
    };
  }
}
