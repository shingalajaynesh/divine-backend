import assert from 'node:assert/strict';
import test from 'node:test';
import { graphql } from 'graphql';
import schema from '../src/gql/schema/index.js';

const MOTHER_USER_ID = 'm0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01';
const PARTNER_USER_ID = 'p0eebc99-9c0b-4ef8-bb6d-6bb9bd380a02';
const LOG_ID = 'l0eebc99-9c0b-4ef8-bb6d-6bb9bd380a03';

test('Partner involvement system assigns tasks, submits responses, and tracks streaks correctly', async () => {
  const assignTaskMutation = `
    mutation AssignPartnerTask($dayNumber: Int!, $title: String!, $description: String) {
      assignPartnerTask(dayNumber: $dayNumber, title: $title, description: $description) {
        id
        assignedTaskTitle
        assignedTaskDesc
        partnerAcknowledged
      }
    }
  `;

  const submitResponseMutation = `
    mutation SubmitPartnerResponse($dayNumber: Int!, $response: String!, $familyNotes: String) {
      submitPartnerResponse(dayNumber: $dayNumber, response: $response, familyNotes: $familyNotes) {
        id
        partnerResponse
        familyNotes
        partnerAcknowledged
      }
    }
  `;

  const partnerStreakQuery = `
    query MyPartnerStreak {
      myPartnerStreak {
        currentStreak
        longestStreak
      }
    }
  `;

  // Mock DB Models
  const mockLogInstance = {
    id: LOG_ID,
    userId: PARTNER_USER_ID,
    dayNumber: 12,
    partnerAcknowledged: false,
    assignedTaskTitle: null,
    assignedTaskDesc: null,
    partnerResponse: null,
    familyNotes: null,
    completedAt: null,
    update: async (fields) => {
      Object.assign(mockLogInstance, fields);
      return mockLogInstance;
    }
  };

  const mockModels = {
    PartnerActivity: {
      findOne: async () => ({ id: 'act-1', dayNumber: 12, titleEn: 'Rub feet', descriptionEn: 'Give mother a 10m foot massage' })
    },
    PartnerActivityLog: {
      findOne: async () => mockLogInstance,
      create: async (data) => {
        Object.assign(mockLogInstance, data);
        return mockLogInstance;
      },
      findAll: async () => [
        { completedAt: new Date(Date.now() - 24 * 60 * 60 * 1000), partnerAcknowledged: true },
        { completedAt: new Date(), partnerAcknowledged: true }
      ]
    }
  };

  const mockTransaction = {
    LOCK: { UPDATE: 'mock-lock-update' }
  };
  const mockSequelize = {
    transaction: async (cb) => cb(mockTransaction)
  };

  // 1. Mother assigns a custom task to the partner
  const resultAssign = await graphql({
    schema,
    source: assignTaskMutation,
    contextValue: {
      viewer: { id: MOTHER_USER_ID, partnerId: PARTNER_USER_ID, role: { roleType: 'MOTHER' } },
      models: mockModels,
      sequelize: mockSequelize
    },
    variableValues: {
      dayNumber: 12,
      title: 'Make Raspberry Leaf Tea',
      description: 'Prepare one warm cup'
    }
  });

  assert.equal(resultAssign.errors, undefined);
  assert.equal(resultAssign.data.assignPartnerTask.assignedTaskTitle, 'Make Raspberry Leaf Tea');
  assert.equal(resultAssign.data.assignPartnerTask.assignedTaskDesc, 'Prepare one warm cup');
  assert.equal(resultAssign.data.assignPartnerTask.partnerAcknowledged, false);

  // 2. Partner submits task response
  const resultResponse = await graphql({
    schema,
    source: submitResponseMutation,
    contextValue: {
      viewer: { id: PARTNER_USER_ID, partnerId: MOTHER_USER_ID, role: { roleType: 'PARTNER' } },
      models: mockModels,
      sequelize: mockSequelize
    },
    variableValues: {
      dayNumber: 12,
      response: 'Made and served the tea with honey!',
      familyNotes: 'Daughter helped boil the water'
    }
  });

  assert.equal(resultResponse.errors, undefined);
  assert.equal(resultResponse.data.submitPartnerResponse.partnerResponse, 'Made and served the tea with honey!');
  assert.equal(resultResponse.data.submitPartnerResponse.familyNotes, 'Daughter helped boil the water');
  assert.equal(resultResponse.data.submitPartnerResponse.partnerAcknowledged, true);

  // 3. Query Partner Streak
  const resultStreak = await graphql({
    schema,
    source: partnerStreakQuery,
    contextValue: {
      viewer: { id: PARTNER_USER_ID, partnerId: MOTHER_USER_ID, role: { roleType: 'PARTNER' } },
      models: mockModels,
      sequelize: mockSequelize
    }
  });

  assert.equal(resultStreak.errors, undefined);
  assert.equal(resultStreak.data.myPartnerStreak.currentStreak, 2);
  assert.equal(resultStreak.data.myPartnerStreak.longestStreak, 2);
});
