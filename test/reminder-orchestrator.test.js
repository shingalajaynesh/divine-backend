import assert from 'node:assert/strict';
import test from 'node:test';
import { graphql } from 'graphql';
import schema from '../src/gql/schema/index.js';

test('Reminder Orchestration mutation generates daily reminders for unfinished tasks, active meds, and booked classes successfully', async () => {
  const mutation = `
    mutation DispatchDailyReminders {
      dispatchDailyReminders {
        success
        remindersSent
        details
      }
    }
  `;

  const createdNotifications = [];
  const mockModels = {
    User: {
      findAll: async () => [{
        id: 'mother-user-888',
        displayName: 'Aarti Sharma',
        emailAddress: 'aarti@example.com',
        centerId: 'center-100',
        language: 'en',
        lmpDate: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Trimester 1
        dueDate: null
      }]
    },
    DailyProgress: {
      findOne: async () => ({
        userId: 'mother-user-888',
        dayNumber: 41,
        pqCompleted: false, // Pending physical quotient!
        iqCompleted: true,
        eqCompleted: true,
        sqCompleted: true
      })
    },
    MedicineReminder: {
      findAll: async () => [{
        id: 'med-1',
        name: 'Iron Supplement',
        dosage: '1 Tablet',
        timeOfDay: '20:00',
        active: true
      }]
    },
    LiveClassBooking: {
      findAll: async () => [{
        userId: 'mother-user-888',
        liveClassId: 'live-class-123'
      }]
    },
    LiveClass: {
      findAll: async () => [{
        id: 'live-class-123',
        titleEn: 'First Trimester Breathing Exercises',
        titleHi: 'प्रथम तिमाही श्वास व्यायाम',
        startTime: new Date() // Booked for today!
      }]
    },
    Notification: {
      create: async (input) => {
        createdNotifications.push(input);
        return { id: 'notif-999', ...input };
      }
    }
  };

  const result = await graphql({
    schema,
    source: mutation,
    contextValue: {
      viewer: { id: 'admin-1', role: { roleType: 'ADMIN' }, centerId: 'center-100' },
      models: mockModels,
      sequelize: {}
    }
  });

  assert.equal(result.errors, undefined);
  const report = result.data.dispatchDailyReminders;
  assert.equal(report.success, true);
  
  // We expect 3 reminders: 
  // 1. Unfinished activities (pqCompleted is false)
  // 2. Iron supplement (active medicine)
  // 3. First Trimester Breathing Exercises (booked live class today)
  assert.equal(report.remindersSent, 3);
  assert.equal(createdNotifications.length, 3);

  const activitiesNotif = createdNotifications.find(n => n.title.includes('Activities'));
  assert.ok(activitiesNotif);
  assert.ok(activitiesNotif.body.includes('Physical (PQ)'));

  const medNotif = createdNotifications.find(n => n.title.includes('Medication'));
  assert.ok(medNotif);
  assert.ok(medNotif.body.includes('Iron Supplement'));

  const classNotif = createdNotifications.find(n => n.title.includes('Class'));
  assert.ok(classNotif);
  assert.ok(classNotif.body.includes('Breathing Exercises'));
});
