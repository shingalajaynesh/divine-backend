import assert from 'node:assert/strict';
import test from 'node:test';
import { graphql } from 'graphql';
import schema from '../src/gql/schema/index.js';

test('Live classes advanced management scheduling, filtering, and reminders', async () => {
  const getClassesQuery = `
    query GetLiveClassesDetailed {
      getLiveClassesDetailed {
        id
        titleEn
        titleHi
        seriesTitle
        batchName
        centerId
      }
    }
  `;

  const createClassMutation = `
    mutation CreateLiveClass($titleEn: String!, $titleHi: String!, $instructor: String!, $startTime: String!, $durationMins: Int!, $videoCallUrl: String!, $seriesTitle: String, $batchName: String, $centerId: ID) {
      createLiveClass(titleEn: $titleEn, titleHi: $titleHi, instructor: $instructor, startTime: $startTime, durationMins: $durationMins, videoCallUrl: $videoCallUrl, seriesTitle: $seriesTitle, batchName: $batchName, centerId: $centerId) {
        id
        titleEn
        seriesTitle
        batchName
        centerId
      }
    }
  `;

  const sendReminderMutation = `
    mutation SendLiveClassReminder($classId: ID!) {
      sendLiveClassReminder(classId: $classId)
    }
  `;

  // Mock DB Store
  const mockClasses = [
    {
      id: 'class-global',
      titleEn: 'Global Meditation Session',
      titleHi: 'वैश्विक ध्यान सत्र',
      instructor: 'Guru Dev',
      startTime: new Date('2026-07-09T10:00:00Z'),
      durationMins: 45,
      videoCallUrl: 'https://meet.google.com/global',
      centerId: null,
      seriesTitle: 'Mindfulness Series',
      batchName: 'Morning Cohort'
    },
    {
      id: 'class-centerA',
      titleEn: 'Yoga for Center A',
      titleHi: 'सेंटर ए योग',
      instructor: 'Sita Ram',
      startTime: new Date('2026-07-09T11:00:00Z'),
      durationMins: 60,
      videoCallUrl: 'https://meet.google.com/centerA',
      centerId: 'center-A',
      seriesTitle: 'Physical Yoga',
      batchName: 'Evening Cohort'
    }
  ];

  const mockBookings = [
    { userId: 'user-1', liveClassId: 'class-global', attended: false, user: { id: 'user-1', language: 'en' } }
  ];

  const createdClasses = [];
  const createdNotifications = [];
  const createdDeliveries = [];

  const mockModels = {
    LiveClass: {
      findAll: async (options) => {
        let results = [...mockClasses, ...createdClasses];
        if (options?.where) {
          const w = options.where;
          // Mimic Op.or filter logic for centerId
          if (w[Symbol.for('or')]) {
            const orConditions = w[Symbol.for('or')];
            const centerMatch = orConditions.find(c => c.centerId !== undefined)?.centerId;
            results = results.filter(item => item.centerId === centerMatch || item.centerId === null);
          }
        }
        return results.map(item => ({
          ...item,
          reload: async () => item
        }));
      },
      findByPk: async (id) => {
        return [...mockClasses, ...createdClasses].find(c => c.id === id);
      },
      create: async (data) => {
        const newClass = { id: `class-${Date.now()}`, ...data };
        createdClasses.push(newClass);
        return newClass;
      }
    },
    LiveClassBooking: {
      findAll: async (options) => {
        return mockBookings.filter(b => b.liveClassId === options.where?.liveClassId);
      }
    },
    Notification: {
      create: async (data) => {
        const notif = { id: `notif-${Date.now()}`, ...data };
        createdNotifications.push(notif);
        return notif;
      }
    },
    NotificationDelivery: {
      create: async (data) => {
        const deliv = { id: `deliv-${Date.now()}`, ...data };
        createdDeliveries.push(deliv);
        return deliv;
      }
    },
    Sequelize: {
      Op: {
        or: Symbol.for('or')
      }
    }
  };

  const { LiveClassService } = await import('../src/modules/liveClass/liveClass.service.js');

  const runQuery = async (source, variables, viewer) => {
    const service = new LiveClassService(mockModels, {});
    return graphql({
      schema,
      source,
      variableValues: variables,
      contextValue: { viewer, models: mockModels, sequelize: {}, liveClassService: service }
    });
  };

  // Test Case 1: Mother viewer (center-A) only retrieves global + center-A classes
  const motherViewer = { id: 'user-1', role: { roleType: 'MOTHER' }, centerId: 'center-A' };
  const res1 = await runQuery(getClassesQuery, {}, motherViewer);
  assert.equal(res1.errors, undefined);
  const classes1 = res1.data.getLiveClassesDetailed;
  // Should return both class-global and class-centerA
  assert.equal(classes1.length, 2);
  assert.ok(classes1.find(c => c.id === 'class-global'));
  assert.ok(classes1.find(c => c.id === 'class-centerA'));

  // Test Case 2: Mother viewer (center-B) only retrieves global classes (since center-B has no specific class)
  const motherBViewer = { id: 'user-2', role: { roleType: 'MOTHER' }, centerId: 'center-B' };
  const res2 = await runQuery(getClassesQuery, {}, motherBViewer);
  assert.equal(res2.errors, undefined);
  const classes2 = res2.data.getLiveClassesDetailed;
  assert.equal(classes2.length, 1);
  assert.equal(classes2[0].id, 'class-global');

  // Test Case 3: Mother trying to create a live class is rejected
  const res3 = await runQuery(createClassMutation, {
    titleEn: 'Yoga Flow',
    titleHi: 'योग सत्र',
    instructor: 'Trainer',
    startTime: '2026-07-09T18:00:00Z',
    durationMins: 60,
    videoCallUrl: 'https://zoom.us/j/123'
  }, motherViewer);
  assert.ok(res3.errors && res3.errors.length > 0);
  assert.match(res3.errors[0].message, /Unauthorized|You do not have permission/);

  // Test Case 4: Staff creates a live class successfully (scoped to their center)
  const staffViewer = { id: 'staff-1', role: { roleType: 'STAFF' }, centerId: 'center-A' };
  const res4 = await runQuery(createClassMutation, {
    titleEn: 'Staff Guided Meditation',
    titleHi: 'स्टाफ ध्यान',
    instructor: 'Care Team',
    startTime: '2026-07-09T20:00:00Z',
    durationMins: 30,
    videoCallUrl: 'https://zoom.us/j/456',
    seriesTitle: 'Care Series',
    batchName: 'Trimester 2 Batch'
  }, staffViewer);
  assert.equal(res4.errors, undefined);
  const newClass = res4.data.createLiveClass;
  assert.equal(newClass.titleEn, 'Staff Guided Meditation');
  assert.equal(newClass.seriesTitle, 'Care Series');
  assert.equal(newClass.batchName, 'Trimester 2 Batch');
  assert.equal(newClass.centerId, 'center-A');

  // Test Case 5: Staff dispatches bookings reminders, dispatches notifications
  const res5 = await runQuery(sendReminderMutation, { classId: 'class-global' }, staffViewer);
  assert.equal(res5.errors, undefined);
  assert.equal(res5.data.sendLiveClassReminder, true);
  // Ensure notification is logged
  assert.equal(createdNotifications.length, 1);
  assert.equal(createdNotifications[0].userId, 'user-1');
  assert.equal(createdNotifications[0].title, 'Live Class Reminder');
  // Ensure delivery is tracked
  assert.equal(createdDeliveries.length, 1);
  assert.equal(createdDeliveries[0].userId, 'user-1');
  assert.equal(createdDeliveries[0].channel, 'in_app');
});
