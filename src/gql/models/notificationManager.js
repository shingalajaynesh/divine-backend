import { GraphQLError } from 'graphql';
import { Op } from 'sequelize';
import { BaseManager } from './baseManager.js';

const inboxStates = new Set(['unread', 'read', 'archived']);
const channels = new Set(['push', 'email', 'whatsapp', 'in_app']);
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export class NotificationManager extends BaseManager {
  async inbox({ status, limit = 30, offset = 0 }) {
    if (status && !inboxStates.has(status)) throw new GraphQLError('Unsupported notification status.', { extensions: { code: 'BAD_USER_INPUT' } });
    const where = { userId: this.viewer.id, ...(status ? { status } : { status: { [Op.ne]: 'archived' } }) };
    const [items, unreadCount] = await Promise.all([
      this.models.Notification.findAll({ where, limit: Math.min(Math.max(limit, 1), 100), offset: Math.max(offset, 0), order: [['createdAt', 'DESC']] }),
      this.models.Notification.count({ where: { userId: this.viewer.id, status: 'unread' } }),
    ]);
    return { items, unreadCount };
  }

  preferences() {
    return this.models.NotificationPreference.findOrCreate({
      where: { userId: this.viewer.id }, defaults: { userId: this.viewer.id },
    }).then(([preference]) => preference);
  }

  async updatePreferences(input) {
    if ((input.quietStart && !timePattern.test(input.quietStart)) || (input.quietEnd && !timePattern.test(input.quietEnd))) throw new GraphQLError('Quiet hours must use HH:mm format.', { extensions: { code: 'BAD_USER_INPUT' } });
    if (input.timezone && (input.timezone.length > 60 || !input.timezone.includes('/'))) throw new GraphQLError('A valid IANA timezone is required.', { extensions: { code: 'BAD_USER_INPUT' } });
    const preference = await this.preferences();
    return preference.update(input);
  }

  reminderSchedules() {
    return this.models.ReminderSchedule.findAll({ where: { userId: this.viewer.id }, order: [['localTime', 'ASC'], ['createdAt', 'ASC']] });
  }

  validateReminder(input) {
    if (!input.label?.trim() || input.label.trim().length > 120) throw new GraphQLError('Reminder label is required.', { extensions: { code: 'BAD_USER_INPUT' } });
    if (!timePattern.test(input.localTime || '')) throw new GraphQLError('Reminder time must use HH:mm format.', { extensions: { code: 'BAD_USER_INPUT' } });
    if (!channels.has(input.channel || 'push')) throw new GraphQLError('Unsupported reminder channel.', { extensions: { code: 'BAD_USER_INPUT' } });
    if (!Array.isArray(input.daysOfWeek) || !input.daysOfWeek.length || input.daysOfWeek.some((day) => !Number.isInteger(day) || day < 0 || day > 6)) throw new GraphQLError('Reminder days must contain values from 0 to 6.', { extensions: { code: 'BAD_USER_INPUT' } });
  }

  async saveReminder(input) {
    this.validateReminder(input);
    const values = { reminderType: input.reminderType || 'daily_activity', label: input.label.trim(), localTime: input.localTime, daysOfWeek: [...new Set(input.daysOfWeek)].sort(), channel: input.channel || 'push', enabled: input.enabled ?? true };
    if (!input.id) return this.models.ReminderSchedule.create({ ...values, userId: this.viewer.id });
    const reminder = await this.models.ReminderSchedule.findOne({ where: { id: input.id, userId: this.viewer.id } });
    if (!reminder) throw new GraphQLError('Reminder not found.', { extensions: { code: 'NOT_FOUND' } });
    return reminder.update(values);
  }

  async deleteReminder(id) {
    return (await this.models.ReminderSchedule.destroy({ where: { id, userId: this.viewer.id } })) > 0;
  }

  async setNotificationStatus(id, status) {
    if (!inboxStates.has(status)) throw new GraphQLError('Unsupported notification status.', { extensions: { code: 'BAD_USER_INPUT' } });
    const notification = await this.models.Notification.findOne({ where: { id, userId: this.viewer.id } });
    if (!notification) throw new GraphQLError('Notification not found.', { extensions: { code: 'NOT_FOUND' } });
    return notification.update({ status, readAt: status === 'read' ? notification.readAt || new Date() : null });
  }

  async markAllRead() {
    await this.models.Notification.update({ status: 'read', readAt: new Date() }, { where: { userId: this.viewer.id, status: 'unread' } });
    return true;
  }
}
