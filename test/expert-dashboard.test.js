import assert from 'node:assert/strict';
import test from 'node:test';
import { graphql } from 'graphql';
import schema from '../src/gql/schema/index.js';

const GUIDE_USER_ID = 'g0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01';
const MEMBER_USER_ID = 'm0eebc99-9c0b-4ef8-bb6d-6bb9bd380a02';
const BOOKING_ID = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a03';
const SCHEDULE_ID = 's0eebc99-9c0b-4ef8-bb6d-6bb9bd380a04';

test('Expert dashboard GQL queries filter appropriately for GUIDE role', async () => {
  const getConsultsQuery = `
    query {
      getMyConsultations {
        id
        status
        expert {
          id
        }
      }
    }
  `;

  const mockModels = {
    ConsultationBooking: {
      findAll: async ({ where }) => {
        // Ensure where clause matches expertId for GUIDE
        assert.equal(where.expertId, GUIDE_USER_ID);
        return [
          { id: BOOKING_ID, expertId: GUIDE_USER_ID, userId: MEMBER_USER_ID, status: 'confirmed' }
        ];
      }
    },
    User: {
      findByPk: async (id) => ({
        id,
        displayName: 'Test User',
        emailAddress: 'test@example.com',
        isActive: true,
        language: 'en',
        subscriptionStatus: 'active',
        shareVitalsWithPartner: false,
        shareReportsWithPartner: false
      })
    }
  };

  const result = await graphql({
    schema,
    source: getConsultsQuery,
    contextValue: {
      viewer: { id: GUIDE_USER_ID, role: { roleType: 'GUIDE' } },
      models: mockModels
    }
  });

  assert.equal(result.errors, undefined);
  assert.equal(result.data.getMyConsultations[0].id, BOOKING_ID);
});

test('Expert schedule CRUD operations for slot configurations', async () => {
  let createdSchedule = null;
  let deletedSchedule = false;

  const mockModels = {
    ExpertSchedule: {
      create: async (input) => {
        createdSchedule = input;
        return { id: SCHEDULE_ID, ...input };
      },
      findByPk: async (id) => {
        if (id !== SCHEDULE_ID) return null;
        return {
          id: SCHEDULE_ID,
          expertId: GUIDE_USER_ID,
          destroy: async () => {
            deletedSchedule = true;
            return true;
          }
        };
      }
    },
    User: {
      findByPk: async (id) => ({
        id,
        displayName: 'Expert Guide',
        emailAddress: 'expert@divine.org',
        isActive: true,
        language: 'en',
        subscriptionStatus: 'active',
        shareVitalsWithPartner: false,
        shareReportsWithPartner: false
      })
    }
  };

  // 1. Create schedule slot
  const createScheduleMutation = `
    mutation {
      createExpertSchedule(dayOfWeek: 2, startTime: "09:00", endTime: "12:00", slotDurationMins: 30) {
        id
        dayOfWeek
        startTime
        endTime
      }
    }
  `;

  const createResult = await graphql({
    schema,
    source: createScheduleMutation,
    contextValue: {
      viewer: { id: GUIDE_USER_ID, role: { roleType: 'GUIDE' } },
      models: mockModels
    }
  });

  assert.equal(createResult.errors, undefined);
  assert.equal(createdSchedule.dayOfWeek, 2);
  assert.equal(createdSchedule.startTime, '09:00');
  assert.equal(createdSchedule.endTime, '12:00');

  // 2. Delete schedule slot
  const deleteScheduleMutation = `
    mutation {
      deleteExpertSchedule(id: "${SCHEDULE_ID}")
    }
  `;

  const deleteResult = await graphql({
    schema,
    source: deleteScheduleMutation,
    contextValue: {
      viewer: { id: GUIDE_USER_ID, role: { roleType: 'GUIDE' } },
      models: mockModels
    }
  });

  assert.equal(deleteResult.errors, undefined);
  assert.equal(deleteResult.data.deleteExpertSchedule, true);
  assert.equal(deletedSchedule, true);
});

test('Expert updates status of a consultation booking', async () => {
  let updatedBooking = null;

  const mockModels = {
    ConsultationBooking: {
      findByPk: async (id) => {
        if (id !== BOOKING_ID) return null;
        return {
          id: BOOKING_ID,
          expertId: GUIDE_USER_ID,
          status: 'confirmed',
          save: async function() {
            updatedBooking = this;
            return this;
          }
        };
      }
    },
    User: {
      findByPk: async (id) => ({
        id,
        displayName: 'User',
        emailAddress: 'user@example.com',
        isActive: true,
        language: 'en',
        subscriptionStatus: 'active',
        shareVitalsWithPartner: false,
        shareReportsWithPartner: false
      })
    }
  };

  const updateStatusMutation = `
    mutation {
      updateConsultationStatus(bookingId: "${BOOKING_ID}", status: "completed") {
        id
        status
      }
    }
  `;

  const result = await graphql({
    schema,
    source: updateStatusMutation,
    contextValue: {
      viewer: { id: GUIDE_USER_ID, role: { roleType: 'GUIDE' } },
      models: mockModels
    }
  });

  assert.equal(result.errors, undefined);
  assert.equal(updatedBooking.status, 'completed');
});
