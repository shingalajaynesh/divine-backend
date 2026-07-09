import assert from 'node:assert/strict';
import test from 'node:test';
import { WellnessService } from '../src/modules/wellness/wellness.service.js';

const VALID_USER_ID = 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a99';

test('WellnessService alerts logic triggers notifications on out-of-range metrics', async () => {
  let createdNotification = null;

  const mockModels = {
    VitalsLog: {
      create: async (input) => {
        return { id: 'log-id-123', ...input };
      }
    },
    User: {
      findByPk: async (id) => {
        if (id === VALID_USER_ID) {
          return { id: VALID_USER_ID, centerId: 'center-uuid-456' };
        }
        return null;
      }
    },
    Notification: {
      create: async (input) => {
        createdNotification = input;
        return { id: input.id, ...input };
      }
    }
  };

  const service = new WellnessService(mockModels, {});

  // 1. Log normal vitals (No notification should be dispatched)
  createdNotification = null;
  await service.logVitals(VALID_USER_ID, {
    weight: 64.5,
    systolicBp: 120,
    diastolicBp: 80,
    kickCount: 12,
    bloodSugar: 95.0,
    symptoms: ['Nausea', 'Backache']
  });
  assert.equal(createdNotification, null);

  // 2. Log high BP (Systolic BP >= 140)
  createdNotification = null;
  await service.logVitals(VALID_USER_ID, {
    systolicBp: 142,
    diastolicBp: 88,
    symptoms: []
  });
  assert.notEqual(createdNotification, null);
  assert.equal(createdNotification.userId, VALID_USER_ID);
  assert.equal(createdNotification.centerId, 'center-uuid-456');
  assert.equal(createdNotification.kind, 'wellness_alert');
  assert.match(createdNotification.body, /High Blood Pressure/);

  // 3. Log low kick counts (< 10 kicks in 2h)
  createdNotification = null;
  await service.logVitals(VALID_USER_ID, {
    kickCount: 8,
    symptoms: []
  });
  assert.notEqual(createdNotification, null);
  assert.match(createdNotification.body, /Low Fetal Movement/);

  // 4. Log high blood sugar (>= 140 mg/dL)
  createdNotification = null;
  await service.logVitals(VALID_USER_ID, {
    bloodSugar: 145.5,
    symptoms: []
  });
  assert.notEqual(createdNotification, null);
  assert.match(createdNotification.body, /High Blood Sugar/);

  // 5. Log severe high-risk symptoms
  createdNotification = null;
  await service.logVitals(VALID_USER_ID, {
    symptoms: ['Swelling', 'Bleeding']
  });
  assert.notEqual(createdNotification, null);
  assert.match(createdNotification.body, /Severe Symptoms: Swelling, Bleeding/);
});
