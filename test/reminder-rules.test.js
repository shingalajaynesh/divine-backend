import assert from 'node:assert/strict';
import test from 'node:test';
import { ReminderRulesService } from '../src/modules/notification/reminderRules.service.js';

const VIEWER_STAFF = { id: 'staff-uuid-1', role: { roleType: 'STAFF' } };
const VIEWER_MOTHER = { id: 'mother-uuid-1', role: { roleType: 'MOTHER' } };

test('ReminderRulesService CRUD operations and rules engine execution logic', async () => {
  const mockRules = [];
  const mockNotifications = [];
  const mockDeliveries = [];
  
  // Set up mock users
  const mockUsers = [
    { id: 'user-mother-1', centerId: 'center-100', roleId: 'role-mother-id' },
    { id: 'user-mother-2', centerId: 'center-100', roleId: 'role-mother-id' }
  ];

  // Set up progress logs, sessions, vitals, classes, subscriptions
  const mockProgress = []; // empty, triggers content rule
  const mockSessions = [
    { userId: 'user-mother-1', lastActiveAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000) } // > 3 days inactive, triggers reactivation
  ];
  const mockVitals = [
    { userId: 'user-mother-1', loggedAt: new Date(Date.now() - 36 * 60 * 60 * 1000) } // > 24 hours ago, triggers wellness
  ];
  const mockSubscriptions = [
    { userId: 'user-mother-2', status: 'active', expiresAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) } // expires in 2 days (< 3 days limit), triggers plans
  ];
  const mockClasses = [
    { id: 'class-1', titleEn: 'Prenatal Yoga Session', startTime: new Date(Date.now() + 10 * 60 * 1000) } // starts in 10 minutes (< 15 mins), triggers class
  ];
  const mockBookings = [
    { userId: 'user-mother-1', liveClassId: 'class-1' }
  ];

  const mockModels = {
    ReminderRule: {
      create: async (input) => {
        const row = {
          ...input,
          update: async function(updates) {
            Object.assign(this, updates);
            return this;
          },
          destroy: async function() {
            const idx = mockRules.findIndex(r => r.id === this.id);
            if (idx !== -1) mockRules.splice(idx, 1);
          }
        };
        mockRules.push(row);
        return row;
      },
      findAll: async () => {
        return mockRules;
      },
      findByPk: async (id) => {
        return mockRules.find(r => r.id === id) || null;
      }
    },
    User: {
      findAll: async () => mockUsers,
      findByPk: async (id) => mockUsers.find(u => u.id === id) || null
    },
    Role: {
      findOne: async (options) => {
        if (options.where?.roleType === 'MOTHER') {
          return { id: 'role-mother-id', roleType: 'MOTHER' };
        }
        return null;
      }
    },
    DailyProgress: {
      findOne: async (options) => {
        const userId = options.where?.userId;
        return mockProgress.find(p => p.userId === userId && p.updatedAt > options.where.updatedAt[Object.getOwnPropertySymbols(options.where.updatedAt)[0]]) || null;
      }
    },
    UserSession: {
      findOne: async (options) => {
        const userId = options.where?.userId;
        return mockSessions.find(s => s.userId === userId) || null;
      }
    },
    VitalsLog: {
      findOne: async (options) => {
        const userId = options.where?.userId;
        return mockVitals.find(v => v.userId === userId) || null;
      }
    },
    UserSubscription: {
      findOne: async (options) => {
        const userId = options.where?.userId;
        return mockSubscriptions.find(s => s.userId === userId) || null;
      }
    },
    LiveClass: {
      findAll: async () => mockClasses
    },
    LiveClassBooking: {
      findAll: async (options) => {
        const classId = options.where?.liveClassId;
        return mockBookings.filter(b => b.liveClassId === classId);
      }
    },
    Notification: {
      create: async (input) => {
        const row = { ...input };
        mockNotifications.push(row);
        return row;
      }
    },
    NotificationDelivery: {
      create: async (input) => {
        const row = { ...input };
        mockDeliveries.push(row);
        return row;
      }
    }
  };

  const mockSequelize = {
    transaction: async (fn) => fn({})
  };

  const service = new ReminderRulesService(mockModels, mockSequelize);

  // --- Test Case 1: CRUD & Permissions ---
  await assert.rejects(
    service.getReminderRules(VIEWER_MOTHER),
    /Unauthorized access/
  );

  const createdRule = await service.createReminderRule(VIEWER_STAFF, {
    name: 'Wellness BP Logger',
    ruleType: 'wellness',
    triggerCondition: { hoursSinceVitals: 24 },
    templateTitle: '🩺 Log Vitals',
    templateBody: 'Please log your parameters',
    channels: ['in_app', 'push'],
    enabled: true
  });

  assert.equal(createdRule.name, 'Wellness BP Logger');
  assert.equal(mockRules.length, 1);

  // Update rule
  await service.updateReminderRule(VIEWER_STAFF, createdRule.id, { name: 'Wellness Vitals Updated' });
  assert.equal(mockRules[0].name, 'Wellness Vitals Updated');

  // --- Test Case 2: Run Rules Engine ---
  // Seed the remaining default rules
  await service.createReminderRule(VIEWER_STAFF, {
    name: 'Content Rule',
    ruleType: 'content',
    triggerCondition: { hoursSinceActivity: 12 },
    templateTitle: '🌟 Read Daily Quotient',
    templateBody: 'Keep learning',
    channels: ['in_app'],
    enabled: true
  });

  await service.createReminderRule(VIEWER_STAFF, {
    name: 'Inactivity Reactivation',
    ruleType: 'reactivation',
    triggerCondition: { daysOfInactivity: 3 },
    templateTitle: '🌸 We miss you',
    templateBody: 'Reconnect with baby',
    channels: ['in_app', 'email'],
    enabled: true
  });

  const report = await service.runReminderRulesEngine(VIEWER_STAFF);
  assert.equal(report.success, true);
  assert.equal(report.rulesProcessed, 3);
  // Verify notifications got created for non-compliant mothers
  assert.ok(report.notificationsDispatched > 0);
  assert.ok(mockNotifications.length > 0);
  assert.ok(mockDeliveries.length > 0);

  // --- Test Case 3: Delete Rule ---
  await service.deleteReminderRule(VIEWER_STAFF, createdRule.id);
  assert.equal(mockRules.length, 2);
});
