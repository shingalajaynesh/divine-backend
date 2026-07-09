import { v4 as uuidv4 } from 'uuid';
import { Op } from 'sequelize';

export class ReminderRulesService {
  constructor(models, sequelize) {
    this.models = models;
    this.sequelize = sequelize;
  }

  // --- CRUD Operations for Admin/Staff console ---

  async getReminderRules(viewer) {
    if (viewer.role?.roleType !== 'ADMIN' && viewer.role?.roleType !== 'STAFF') {
      throw new Error('Unauthorized access');
    }
    return this.models.ReminderRule.findAll({ order: [['createdAt', 'DESC']] });
  }

  async createReminderRule(viewer, input) {
    if (viewer.role?.roleType !== 'ADMIN' && viewer.role?.roleType !== 'STAFF') {
      throw new Error('Unauthorized access');
    }

    const { name, ruleType, triggerCondition, templateTitle, templateBody, channels, enabled } = input;

    if (!name || !name.trim()) throw new Error('Rule name is required');
    if (!ruleType) throw new Error('Rule type is required');
    if (!templateTitle || !templateTitle.trim()) throw new Error('Template title is required');
    if (!templateBody || !templateBody.trim()) throw new Error('Template body is required');

    return this.models.ReminderRule.create({
      id: uuidv4(),
      name: name.trim(),
      ruleType,
      triggerCondition: triggerCondition || {},
      templateTitle: templateTitle.trim(),
      templateBody: templateBody.trim(),
      channels: channels || ['in_app'],
      enabled: enabled ?? true
    });
  }

  async updateReminderRule(viewer, id, input) {
    if (viewer.role?.roleType !== 'ADMIN' && viewer.role?.roleType !== 'STAFF') {
      throw new Error('Unauthorized access');
    }

    const rule = await this.models.ReminderRule.findByPk(id);
    if (!rule) throw new Error('Reminder rule not found');

    return rule.update(input);
  }

  async deleteReminderRule(viewer, id) {
    if (viewer.role?.roleType !== 'ADMIN' && viewer.role?.roleType !== 'STAFF') {
      throw new Error('Unauthorized access');
    }

    const rule = await this.models.ReminderRule.findByPk(id);
    if (!rule) throw new Error('Reminder rule not found');

    await rule.destroy();
    return true;
  }

  // --- Rules Engine Processing ---

  async runReminderRulesEngine(viewer) {
    if (viewer.role?.roleType !== 'ADMIN' && viewer.role?.roleType !== 'STAFF') {
      throw new Error('Unauthorized access');
    }

    const activeRules = await this.models.ReminderRule.findAll({ where: { enabled: true } });
    let totalNotificationsCreated = 0;

    // Get all mother users to run rules against
    const motherRole = await this.models.Role.findOne({ where: { roleType: 'MOTHER' } });
    const mothers = await this.models.User.findAll({
      where: motherRole ? { roleId: motherRole.id } : {}
    });

    for (const rule of activeRules) {
      const condition = rule.triggerCondition || {};

      if (rule.ruleType === 'content') {
        // Content reminder rule: e.g. hasn't logged daily content progress in last X hours
        const hours = condition.hoursSinceActivity || 12;
        const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);

        for (const mother of mothers) {
          // Check if mother has updated progress recently
          const progress = await this.models.DailyProgress.findOne({
            where: {
              userId: mother.id,
              updatedAt: { [Op.gt]: cutoff }
            }
          });

          if (!progress) {
            await this.dispatchRuleReminder(mother, rule);
            totalNotificationsCreated++;
          }
        }
      } 
      else if (rule.ruleType === 'classes') {
        // Classes reminder rule: booked live class starting in X minutes
        const mins = condition.minutesBeforeClass || 15;
        const now = new Date();
        const futureLimit = new Date(now.getTime() + mins * 60 * 1000);

        // Find classes starting soon
        const classes = await this.models.LiveClass.findAll({
          where: {
            startTime: {
              [Op.between]: [now, futureLimit]
            }
          }
        });

        for (const cls of classes) {
          // Find booked bookings
          const bookings = await this.models.LiveClassBooking.findAll({
            where: { liveClassId: cls.id }
          });

          for (const booking of bookings) {
            const mother = await this.models.User.findByPk(booking.userId);
            if (mother) {
              await this.dispatchRuleReminder(mother, rule, `Class: ${cls.titleEn || cls.titleHi}`);
              totalNotificationsCreated++;
            }
          }
        }
      }
      else if (rule.ruleType === 'wellness') {
        // Wellness vitals reminder rule: latest vitals logs logged more than X hours ago
        const hours = condition.hoursSinceVitals || 24;
        const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);

        for (const mother of mothers) {
          const latestLog = await this.models.VitalsLog.findOne({
            where: { userId: mother.id },
            order: [['loggedAt', 'DESC']]
          });

          if (!latestLog || new Date(latestLog.loggedAt) < cutoff) {
            await this.dispatchRuleReminder(mother, rule);
            totalNotificationsCreated++;
          }
        }
      }
      else if (rule.ruleType === 'plans') {
        // Plan expiry reminder rule: plan expires in X days
        const days = condition.daysBeforeExpiry || 3;
        const now = new Date();
        const futureLimit = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

        for (const mother of mothers) {
          const sub = await this.models.UserSubscription.findOne({
            where: {
              userId: mother.id,
              status: 'active',
              expiresAt: {
                [Op.between]: [now, futureLimit]
              }
            }
          });

          if (sub) {
            await this.dispatchRuleReminder(mother, rule);
            totalNotificationsCreated++;
          }
        }
      }
      else if (rule.ruleType === 'reactivation') {
        // Engagement reactivation rule: inactive for X days
        const days = condition.daysOfInactivity || 3;
        const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        for (const mother of mothers) {
          const latestSession = await this.models.UserSession.findOne({
            where: { userId: mother.id },
            order: [['lastActiveAt', 'DESC']]
          });

          if (!latestSession || new Date(latestSession.lastActiveAt) < cutoff) {
            await this.dispatchRuleReminder(mother, rule);
            totalNotificationsCreated++;
          }
        }
      }
    }

    return {
      success: true,
      rulesProcessed: activeRules.length,
      notificationsDispatched: totalNotificationsCreated
    };
  }

  async dispatchRuleReminder(user, rule, extraContext = '') {
    const title = rule.templateTitle;
    const body = extraContext ? `${rule.templateBody} (${extraContext})` : rule.templateBody;

    await this.sequelize.transaction(async (t) => {
      const notification = await this.models.Notification.create({
        id: uuidv4(),
        userId: user.id,
        centerId: user.centerId || null,
        kind: 'rules_reminder',
        title,
        body,
        status: 'unread',
        createdAt: new Date(),
        updatedAt: new Date()
      }, { transaction: t });

      for (const channel of rule.channels || ['in_app']) {
        await this.models.NotificationDelivery.create({
          id: uuidv4(),
          notificationId: notification.id,
          channel,
          status: 'queued',
          attempts: 0
        }, { transaction: t });
      }
    });
  }
}
