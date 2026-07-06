import assert from 'node:assert/strict';
import test from 'node:test';
import { graphql } from 'graphql';
import schema from '../src/gql/schema/index.js';
import { LiveClassService } from '../src/modules/liveClass/liveClass.service.js';

const VALID_USER_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const VALID_CLASS_ID = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22';

test('live class queries require authentication', async () => {
  const query = '{ getLiveClassesDetailed { id titleEn titleHi instructor booked } }';
  const result = await graphql({ schema, source: query, contextValue: {} });
  assert.equal(result.errors?.[0]?.extensions?.code, 'UNAUTHENTICATED');
});

test('LiveClassService books classes, saves feedback, and updates replay URLs', async () => {
  let createdBookingInput = null;
  let updatedBooking = null;
  let updatedReplayClass = null;
  const testBookings = [];

  const models = {
    LiveClass: {
      findAll: async () => [
        {
          id: VALID_CLASS_ID,
          titleEn: 'Garbh Sanskar Yoga',
          titleHi: 'गर्भ संस्कार योग',
          instructor: 'Dr. Pooja',
          startTime: new Date('2026-07-10T10:00:00Z'),
          durationMins: 45,
          videoCallUrl: 'https://meet.google.com/abc-defg-hij',
          replayUrl: null
        }
      ],
      findByPk: async (id) => {
        if (id === VALID_CLASS_ID) {
          return {
            id: VALID_CLASS_ID,
            replayUrl: null,
            save: async () => { updatedReplayClass = VALID_CLASS_ID; }
          };
        }
        return null;
      }
    },
    LiveClassBooking: {
      findAll: async () => testBookings,
      findOne: async ({ where }) => {
        const found = testBookings.find(b => b.userId === where.userId && b.liveClassId === where.liveClassId);
        if (found) {
          return {
            ...found,
            save: async function() {
              found.feedbackScore = this.feedbackScore;
              found.feedbackNotes = this.feedbackNotes;
              found.attended = this.attended;
              updatedBooking = 'booking-1';
            }
          };
        }
        return null;
      },
      create: async (input) => {
        const item = { id: 'booking-1', ...input };
        testBookings.push(item);
        createdBookingInput = item;
        return item;
      }
    }
  };

  const service = new LiveClassService(models, {});

  // 1. Get classes detailed list
  const classes = await service.getLiveClasses(VALID_USER_ID);
  assert.equal(classes.length, 1);
  assert.equal(classes[0].booked, false);

  // 2. Book live class seat
  await service.bookLiveClass(VALID_USER_ID, VALID_CLASS_ID);
  assert.equal(createdBookingInput.userId, VALID_USER_ID);
  assert.equal(createdBookingInput.liveClassId, VALID_CLASS_ID);

  // 3. Submit live class feedback
  await service.submitLiveClassFeedback(VALID_USER_ID, {
    liveClassId: VALID_CLASS_ID,
    feedbackScore: 5,
    feedbackNotes: 'Amazing session!'
  });
  assert.equal(updatedBooking, 'booking-1');

  // 4. Update replay URL
  await service.updateReplayUrl(VALID_CLASS_ID, 'https://youtube.com/watch?v=123');
  assert.equal(updatedReplayClass, VALID_CLASS_ID);
});
