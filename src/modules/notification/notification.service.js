import { v4 as uuidv4 } from 'uuid';
import { Op } from 'sequelize';

export class NotificationCampaignService {
  constructor(models, sequelize) {
    this.models = models;
    this.sequelize = sequelize;
  }

  async createCampaign(viewer, input) {
    // 1. Authorization checks
    if (viewer.role?.roleType !== 'ADMIN' && viewer.role?.roleType !== 'STAFF') {
      throw new Error('Unauthorized access');
    }

    const { title, body, channels, targetUserIds, centerId, scheduledAt } = input;

    if (!title || !title.trim()) throw new Error('Campaign title is required');
    if (!body || !body.trim()) throw new Error('Campaign body is required');
    if (!channels || !channels.length) throw new Error('At least one distribution channel is required');

    // 2. Resolve recipient user IDs
    let userIds = [];
    let users = [];

    if (targetUserIds && targetUserIds.length > 0) {
      users = await this.models.User.findAll({
        where: { id: { [Op.in]: targetUserIds } }
      });
      userIds = users.map(u => u.id);
    } else if (centerId) {
      // Find all mothers in centerId
      const motherRole = await this.models.Role.findOne({ where: { roleType: 'MOTHER' } });
      const whereClause = { centerId };
      if (motherRole) {
        whereClause.roleId = motherRole.id;
      }
      users = await this.models.User.findAll({ where: whereClause });
      userIds = users.map(u => u.id);
    } else {
      // All mothers in system
      const motherRole = await this.models.Role.findOne({ where: { roleType: 'MOTHER' } });
      const whereClause = {};
      if (motherRole) {
        whereClause.roleId = motherRole.id;
      }
      users = await this.models.User.findAll({ where: whereClause });
      userIds = users.map(u => u.id);
    }

    if (userIds.length === 0) {
      throw new Error('No target recipients found for the selected cohort criteria');
    }

    // 3. Create notifications and delivery entries
    const parsedScheduledAt = scheduledAt ? new Date(scheduledAt) : null;

    return this.sequelize.transaction(async (t) => {
      const createdNotifications = [];

      for (const user of users) {
        const notification = await this.models.Notification.create({
          id: uuidv4(),
          userId: user.id,
          centerId: user.centerId || null,
          kind: 'campaign_announcement',
          title,
          body,
          status: 'unread',
          scheduledAt: parsedScheduledAt,
          createdAt: new Date(),
          updatedAt: new Date()
        }, { transaction: t });

        for (const channel of channels) {
          await this.models.NotificationDelivery.create({
            id: uuidv4(),
            notificationId: notification.id,
            channel,
            status: 'queued',
            attempts: 0,
            providerMessageId: null,
            lastAttemptAt: null,
            errorCode: null,
            errorMessage: null
          }, { transaction: t });
        }

        createdNotifications.push(notification);
      }

      return createdNotifications;
    });
  }

  async triggerCampaignDispatched(viewer, notificationId) {
    if (viewer.role?.roleType !== 'ADMIN' && viewer.role?.roleType !== 'STAFF') {
      throw new Error('Unauthorized access');
    }

    const deliveries = await this.models.NotificationDelivery.findAll({
      where: { notificationId }
    });

    if (deliveries.length === 0) {
      return false;
    }

    for (const delivery of deliveries) {
      // Simulate external provider API latency/dispatch
      delivery.status = 'delivered';
      delivery.attempts = 1;
      delivery.providerMessageId = `msg-${delivery.channel}-${uuidv4().substring(0, 8)}`;
      delivery.lastAttemptAt = new Date();
      await delivery.save();
    }

    return true;
  }

  async getDeliveriesReport(viewer, limit = 50, offset = 0) {
    if (viewer.role?.roleType !== 'ADMIN' && viewer.role?.roleType !== 'STAFF') {
      throw new Error('Unauthorized access');
    }

    return this.models.NotificationDelivery.findAll({
      limit: Math.min(Math.max(limit, 1), 100),
      offset: Math.max(offset, 0),
      order: [['createdAt', 'DESC']],
      include: [
        { model: this.models.Notification, as: 'notification' }
      ]
    });
  }

  async getCampaignPerformance(viewer, notificationId) {
    if (viewer.role?.roleType !== 'ADMIN' && viewer.role?.roleType !== 'STAFF') {
      throw new Error('Unauthorized access');
    }

    const deliveries = await this.models.NotificationDelivery.findAll({
      where: { notificationId }
    });

    const totalTargeted = deliveries.length;
    const deliveredCount = deliveries.filter(d => d.status === 'delivered' || d.status === 'sent').length;
    const failedCount = deliveries.filter(d => d.status === 'failed').length;
    const pendingCount = deliveries.filter(d => d.status === 'queued').length;

    // Group breakdown by channel
    const channelsList = ['push', 'email', 'whatsapp', 'in_app'];
    const channelBreakdown = channelsList.map(ch => {
      const chDeliveries = deliveries.filter(d => d.channel === ch);
      const sent = chDeliveries.length;
      const del = chDeliveries.filter(d => d.status === 'delivered' || d.status === 'sent').length;
      const fail = chDeliveries.filter(d => d.status === 'failed').length;
      return {
        channel: ch,
        sent,
        delivered: del,
        failed: fail
      };
    });

    return {
      totalTargeted,
      deliveredCount,
      failedCount,
      pendingCount,
      channelBreakdown
    };
  }
}
