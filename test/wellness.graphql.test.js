import assert from 'node:assert/strict';
import test from 'node:test';
import { graphql } from 'graphql';
import schema from '../src/gql/schema/index.js';
import { WellnessService } from '../src/modules/wellness/wellness.service.js';

const VALID_USER_ID = 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a99';
const VALID_ITEM_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a00';
const VALID_APP_ID = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11';
const VALID_MED_ID = 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c22';

test('wellness queries require authentication', async () => {
  const query = '{ getAppointments { id title } }';
  const result = await graphql({ schema, source: query, contextValue: {} });
  assert.equal(result.errors?.[0]?.extensions?.code, 'UNAUTHENTICATED');
});

test('WellnessService logs vitals, packs bags, schedules visits, and checks pills', async () => {
  let loggedInput = null;
  let addedAppInput = null;
  let addedMedInput = null;
  let addedBagInput = null;
  let toggledBagPacked = null;
  let toggledMedActive = null;
  let deletedAppId = null;

  const models = {
    VitalsLog: {
      create: async (input) => {
        loggedInput = input;
        return { id: 'log-1', ...input };
      }
    },
    Appointment: {
      findAll: async () => [],
      create: async (input) => {
        addedAppInput = input;
        return { id: VALID_APP_ID, ...input };
      },
      destroy: async ({ where }) => {
        deletedAppId = where.id;
        return 1;
      }
    },
    MedicineReminder: {
      findAll: async () => [],
      create: async (input) => {
        addedMedInput = input;
        return { id: VALID_MED_ID, ...input };
      },
      findOne: async () => {
        return {
          id: VALID_MED_ID,
          active: true,
          save: async function() { toggledMedActive = this.active; }
        };
      }
    },
    HospitalBagItem: {
      findAll: async () => [],
      create: async (input) => {
        addedBagInput = input;
        return { id: VALID_ITEM_ID, ...input };
      },
      findOne: async () => {
        return {
          id: VALID_ITEM_ID,
          packed: false,
          save: async function() { toggledBagPacked = this.packed; }
        };
      }
    }
  };

  const service = new WellnessService(models, {});

  // 1. Log daily vitals and symptoms
  await service.logVitals(VALID_USER_ID, {
    weight: 64.5,
    systolicBp: 120,
    diastolicBp: 80,
    kickCount: 10,
    bloodSugar: 95.2,
    symptoms: ['nausea', 'backache']
  });
  assert.equal(loggedInput.weight, 64.5);
  assert.equal(loggedInput.symptoms, '["nausea","backache"]');

  // 2. Schedule doctor visit appointment
  await service.addAppointment(VALID_USER_ID, {
    title: 'Routine Checkup',
    doctorName: 'Dr. Pooja',
    appointmentDate: '2026-07-10T10:00:00Z',
    notes: 'Scan day'
  });
  assert.equal(addedAppInput.title, 'Routine Checkup');
  assert.equal(addedAppInput.doctorName, 'Dr. Pooja');

  // 3. Delete appointment
  await service.deleteAppointment(VALID_USER_ID, VALID_APP_ID);
  assert.equal(deletedAppId, VALID_APP_ID);

  // 4. Add medicine reminder
  await service.addMedicineReminder(VALID_USER_ID, {
    name: 'Iron Tablet',
    dosage: '1 pill',
    timeOfDay: '08:00'
  });
  assert.equal(addedMedInput.name, 'Iron Tablet');
  assert.equal(addedMedInput.timeOfDay, '08:00');

  // 5. Toggle medicine
  await service.toggleMedicineReminder(VALID_USER_ID, VALID_MED_ID, false);
  assert.equal(toggledMedActive, false);

  // 6. Add bag item
  await service.addHospitalBagItem(VALID_USER_ID, {
    itemName: 'Maternity clothes',
    category: 'mother'
  });
  assert.equal(addedBagInput.itemName, 'Maternity clothes');

  // 7. Toggle bag packed
  await service.toggleHospitalBagItem(VALID_USER_ID, VALID_ITEM_ID, true);
  assert.equal(toggledBagPacked, true);
});
