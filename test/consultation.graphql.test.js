import assert from 'node:assert/strict';
import test from 'node:test';
import { graphql } from 'graphql';
import schema from '../src/gql/schema/index.js';
import { ConsultationService } from '../src/modules/consultation/consultation.service.js';

const VALID_USER_ID = 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33';
const VALID_EXPERT_ID = 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44';
const VALID_BOOKING_ID = 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a55';

test('prescription queries require authentication', async () => {
  const query = '{ getPrescriptionSummary { id caseNotes followUpTasks } }';
  const result = await graphql({ schema, source: query, contextValue: {} });
  assert.equal(result.errors?.[0]?.extensions?.code, 'UNAUTHENTICATED');
});

test('ConsultationService submits notes and follow-up tasks', async () => {
  let savedNotes = null;
  let savedTasks = null;

  const models = {
    ConsultationBooking: {
      findOne: async ({ where }) => {
        if (where.id === VALID_BOOKING_ID && where.expertId === VALID_EXPERT_ID) {
          return {
            id: VALID_BOOKING_ID,
            expertId: VALID_EXPERT_ID,
            caseNotes: null,
            followUpTasks: null,
            save: async function() {
              savedNotes = this.caseNotes;
              savedTasks = this.followUpTasks;
            }
          };
        }
        return null;
      },
      findAll: async ({ where }) => {
        if (where.userId === VALID_USER_ID) {
          return [
            {
              id: VALID_BOOKING_ID,
              userId: VALID_USER_ID,
              caseNotes: 'Take iron supplements',
              followUpTasks: '["drink water"]'
            }
          ];
        }
        return [];
      }
    }
  };

  const service = new ConsultationService(models, {});

  // 1. Submit notes successfully
  await service.submitCaseNotes(VALID_EXPERT_ID, {
    bookingId: VALID_BOOKING_ID,
    caseNotes: 'Maternal health normal. Suggested light yoga.',
    followUpTasks: ['light yoga daily', 'check BP weekly']
  });
  assert.equal(savedNotes, 'Maternal health normal. Suggested light yoga.');
  assert.equal(savedTasks, '["light yoga daily","check BP weekly"]');

  // 2. Fetch prescription summary
  const summary = await service.getPrescriptionSummary(VALID_USER_ID);
  assert.equal(summary.length, 1);
  assert.equal(summary[0].caseNotes, 'Take iron supplements');
});
