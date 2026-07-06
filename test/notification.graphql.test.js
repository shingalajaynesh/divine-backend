import assert from 'node:assert/strict';
import test from 'node:test';
import { graphql } from 'graphql';
import schema from '../src/gql/schema/index.js';
import { NotificationManager } from '../src/gql/models/notificationManager.js';

test('notification inbox and preferences require authentication', async () => {
  const inbox = await graphql({ schema, source: '{ myNotifications { unreadCount } }', contextValue: {} });
  const preferences = await graphql({ schema, source: '{ myNotificationPreferences { pushEnabled } }', contextValue: {} });
  assert.equal(inbox.errors?.[0]?.extensions?.code, 'UNAUTHENTICATED');
  assert.equal(preferences.errors?.[0]?.extensions?.code, 'UNAUTHENTICATED');
});

test('inbox queries and read state are scoped to the verified member', async () => {
  let inboxWhere;
  let statusWhere;
  const notification = { readAt: null, update: async (input) => input };
  const models = {
    Notification: {
      findAll: async ({ where }) => { inboxWhere = where; return []; },
      count: async () => 2,
      findOne: async ({ where }) => { statusWhere = where; return notification; },
    },
  };
  const manager = new NotificationManager(models, { id: 'member-verified' }, { info() {}, error() {} });
  assert.equal((await manager.inbox({})).unreadCount, 2);
  assert.equal(inboxWhere.userId, 'member-verified');
  const updated = await manager.setNotificationStatus('notice-1', 'read');
  assert.equal(statusWhere.userId, 'member-verified');
  assert.equal(statusWhere.id, 'notice-1');
  assert.equal(updated.status, 'read');
  assert.ok(updated.readAt instanceof Date);
});

test('preference and reminder writes derive ownership and validate local time', async () => {
  let reminderInput;
  const preference = { update: async (input) => input };
  const models = {
    NotificationPreference: { findOrCreate: async ({ where }) => { assert.equal(where.userId, 'member-verified'); return [preference, true]; } },
    ReminderSchedule: { create: async (input) => { reminderInput = input; return input; } },
  };
  const manager = new NotificationManager(models, { id: 'member-verified' }, { info() {}, error() {} });
  assert.equal((await manager.updatePreferences({ quietStart: '22:00', quietEnd: '07:00', timezone: 'Asia/Kolkata' })).timezone, 'Asia/Kolkata');
  await manager.saveReminder({ label: 'Morning practice', localTime: '08:30', daysOfWeek: [1, 1, 3], channel: 'push' });
  assert.equal(reminderInput.userId, 'member-verified');
  assert.deepEqual(reminderInput.daysOfWeek, [1, 3]);
  await assert.rejects(() => manager.saveReminder({ label: 'Bad time', localTime: '25:00', daysOfWeek: [1] }), /HH:mm/);
});
