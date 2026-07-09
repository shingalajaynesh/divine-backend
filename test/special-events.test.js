import assert from 'node:assert/strict';
import test from 'node:test';
import { SpecialEventService } from '../src/modules/specialEvent/specialEvent.service.js';

const VIEWER_STAFF = { id: 'staff-uuid-1', role: { roleType: 'STAFF' } };
const VIEWER_MOTHER = { id: 'mother-uuid-1', role: { roleType: 'MOTHER' } };
const OTHER_MOTHER = { id: 'mother-uuid-2', role: { roleType: 'MOTHER' } };

test('SpecialEventService CRUD operations, registration limits, check-in, and feedback', async () => {
  const mockEvents = [];
  const mockRegistrations = [];
  
  const mockUsers = [
    { id: 'mother-uuid-1', displayName: 'Jane Doe', emailAddress: 'jane@example.com', mobileNo: '9999999999' },
    { id: 'mother-uuid-2', displayName: 'Sara Smith', emailAddress: 'sara@example.com', mobileNo: '8888888888' }
  ];

  const mockModels = {
    SpecialEvent: {
      create: async (input) => {
        const row = {
          ...input,
          update: async function(updates) {
            Object.assign(this, updates);
            return this;
          },
          destroy: async function() {
            const idx = mockEvents.findIndex(e => e.id === this.id);
            if (idx !== -1) mockEvents.splice(idx, 1);
          }
        };
        mockEvents.push(row);
        return row;
      },
      findByPk: async (id) => {
        return mockEvents.find(e => e.id === id) || null;
      },
      findAll: async () => {
        return mockEvents;
      }
    },
    EventRegistration: {
      create: async (input) => {
        const row = {
          ...input,
          update: async function(updates) {
            Object.assign(this, updates);
            return this;
          }
        };
        mockRegistrations.push(row);
        return row;
      },
      findByPk: async (id) => {
        return mockRegistrations.find(r => r.id === id) || null;
      },
      findOne: async (options) => {
        const { eventId, userId } = options.where;
        return mockRegistrations.find(r => r.eventId === eventId && r.userId === userId) || null;
      },
      count: async (options) => {
        return mockRegistrations.filter(r => r.eventId === options.where.eventId).length;
      },
      findAll: async (options) => {
        const { eventId } = options.where;
        return mockRegistrations
          .filter(r => r.eventId === eventId)
          .map(r => {
            const u = mockUsers.find(user => user.id === r.userId);
            return { ...r, user: u };
          });
      }
    },
    User: {
      findByPk: async (id) => mockUsers.find(u => u.id === id) || null
    }
  };

  const mockSequelize = {};
  const service = new SpecialEventService(mockModels, mockSequelize);

  // --- Test Case 1: CRUD & Permissions ---
  await assert.rejects(
    service.createSpecialEvent(VIEWER_MOTHER, {
      title: 'Workshop',
      description: 'Desc',
      eventType: 'workshop',
      eventDate: '2026-08-01T10:00:00Z',
      durationMinutes: 60
    }),
    /Unauthorized access/
  );

  const event = await service.createSpecialEvent(VIEWER_STAFF, {
    title: 'Garbh Sanskar Intro',
    description: 'Introductory seminar',
    eventType: 'seminar',
    eventDate: '2026-08-01T10:00:00Z',
    durationMinutes: 90,
    speakerName: 'Dr. Anita',
    location: 'Zoom',
    maxRegistrations: 1 // capacity 1
  });

  assert.equal(event.title, 'Garbh Sanskar Intro');
  assert.equal(mockEvents.length, 1);

  // Update event
  await service.updateSpecialEvent(VIEWER_STAFF, event.id, { title: 'Intro Updated' });
  assert.equal(mockEvents[0].title, 'Intro Updated');

  // --- Test Case 2: Capacity Locked Registration ---
  // Mother 1 registers
  const reg1 = await service.registerForEvent(VIEWER_MOTHER, event.id);
  assert.equal(reg1.eventId, event.id);
  assert.equal(reg1.userId, VIEWER_MOTHER.id);
  assert.equal(mockRegistrations.length, 1);

  // Mother 2 attempts to register (capacity full)
  await assert.rejects(
    service.registerForEvent(OTHER_MOTHER, event.id),
    /Event capacity has been fully reached/
  );

  // Mother 1 tries to register again (duplicate check)
  event.maxRegistrations = 5; // relax capacity
  await assert.rejects(
    service.registerForEvent(VIEWER_MOTHER, event.id),
    /You are already registered for this event/
  );

  // --- Test Case 3: Check-in ---
  await assert.rejects(
    service.checkInToEvent(VIEWER_MOTHER, reg1.id),
    /Unauthorized access/
  );

  const updatedReg = await service.checkInToEvent(VIEWER_STAFF, reg1.id);
  assert.equal(updatedReg.checkedIn, true);
  assert.ok(updatedReg.checkedInAt);

  // --- Test Case 4: Feedback Submission ---
  // Must be checkedIn/attended first
  const reg2 = await service.registerForEvent(OTHER_MOTHER, event.id);
  await assert.rejects(
    service.submitEventFeedback(OTHER_MOTHER, event.id, 5, 'Lovely!'),
    /Feedback is only allowed after checking in or attending/
  );

  // Submit feedback for Mother 1 (already checked-in)
  const feedbackResult = await service.submitEventFeedback(VIEWER_MOTHER, event.id, 5, 'Great session!');
  assert.equal(feedbackResult.feedbackRating, 5);
  assert.equal(feedbackResult.feedbackText, 'Great session!');

  // --- Test Case 5: Attendee listings ---
  const attendees = await service.getEventAttendees(VIEWER_STAFF, event.id);
  assert.equal(attendees.length, 2);
  assert.equal(attendees.find(a => a.userId === VIEWER_MOTHER.id).user.displayName, 'Jane Doe');
});
