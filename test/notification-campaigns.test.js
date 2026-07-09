import assert from 'node:assert/strict';
import test from 'node:test';
import { NotificationCampaignService } from '../src/modules/notification/notification.service.js';

const VIEWER_STAFF = { id: 'staff-uuid-1', role: { roleType: 'STAFF' } };
const VIEWER_MOTHER = { id: 'mother-uuid-1', role: { roleType: 'MOTHER' } };

test('NotificationCampaignService authorization and campaign creation flow', async () => {
  const mockNotifications = [];
  const mockDeliveries = [];
  const mockUsers = [
    { id: 'user-mother-1', centerId: 'center-100', roleId: 'role-mother-id' },
    { id: 'user-mother-2', centerId: 'center-100', roleId: 'role-mother-id' },
    { id: 'user-mother-3', centerId: 'center-200', roleId: 'role-mother-id' }
  ];

  const mockModels = {
    User: {
      findAll: async (options) => {
        const centerId = options.where?.centerId;
        if (centerId) {
          return mockUsers.filter(u => u.centerId === centerId);
        }
        return mockUsers;
      }
    },
    Role: {
      findOne: async (options) => {
        if (options.where?.roleType === 'MOTHER') {
          return { id: 'role-mother-id', roleType: 'MOTHER' };
        }
        return null;
      }
    },
    Notification: {
      create: async (input) => {
        const row = { ...input };
        mockNotifications.push(row);
        return row;
      },
      findByPk: async (id) => {
        return mockNotifications.find(n => n.id === id) || null;
      }
    },
    NotificationDelivery: {
      create: async (input) => {
        const row = {
          ...input,
          save: async function() {
            const idx = mockDeliveries.findIndex(d => d.id === this.id);
            if (idx !== -1) mockDeliveries[idx] = this;
          }
        };
        mockDeliveries.push(row);
        return row;
      },
      findAll: async (options) => {
        const notificationId = options.where?.notificationId;
        if (notificationId) {
          return mockDeliveries.filter(d => d.notificationId === notificationId);
        }
        return mockDeliveries;
      }
    }
  };

  const mockSequelize = {
    transaction: async (fn) => {
      return fn({});
    }
  };

  const service = new NotificationCampaignService(mockModels, mockSequelize);

  // 1. Authorization: Non-staff/non-admin should throw error
  await assert.rejects(
    service.createCampaign(VIEWER_MOTHER, {
      title: 'Campaign 1',
      body: 'Body 1',
      channels: ['push']
    }),
    /Unauthorized access/
  );

  // 2. Create Campaign targeting center-100 cohort
  const campaignInput = {
    title: 'Yoga Reminder',
    body: 'Morning session at 8 AM',
    channels: ['push', 'in_app'],
    centerId: 'center-100'
  };

  const notifications = await service.createCampaign(VIEWER_STAFF, campaignInput);
  
  // Verify mothers in center-100 were targeted (user-mother-1, user-mother-2)
  assert.equal(notifications.length, 2);
  assert.equal(mockNotifications.length, 2);
  
  // Verify 2 channels for 2 mothers = 4 queued deliveries
  assert.equal(mockDeliveries.length, 4);
  assert.equal(mockDeliveries.every(d => d.status === 'queued'), true);

  // 3. Check Performance metrics for the campaign (initial state)
  const targetNotificationId = notifications[0].id;
  const initialPerformance = await service.getCampaignPerformance(VIEWER_STAFF, targetNotificationId);
  
  assert.equal(initialPerformance.totalTargeted, 2); // 2 deliveries for this notification
  assert.equal(initialPerformance.pendingCount, 2);
  assert.equal(initialPerformance.deliveredCount, 0);

  // 4. Trigger simulated dispatch
  const dispatchResult = await service.triggerCampaignDispatched(VIEWER_STAFF, targetNotificationId);
  assert.equal(dispatchResult, true);

  // 5. Check Performance metrics after dispatch
  const finalPerformance = await service.getCampaignPerformance(VIEWER_STAFF, targetNotificationId);
  assert.equal(finalPerformance.deliveredCount, 2);
  assert.equal(finalPerformance.pendingCount, 0);
  
  // Verify delivery stats channel-wise breakdown
  const pushStat = finalPerformance.channelBreakdown.find(b => b.channel === 'push');
  assert.equal(pushStat.sent, 1);
  assert.equal(pushStat.delivered, 1);
});
