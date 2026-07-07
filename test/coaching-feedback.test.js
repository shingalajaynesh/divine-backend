import assert from 'node:assert/strict';
import test from 'node:test';
import { graphql } from 'graphql';
import schema from '../src/gql/schema/index.js';

const MOTHER_USER_ID = 'm0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01';
const COACH_USER_ID = 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a02';
const PROGRESS_ID = 'p0eebc99-9c0b-4ef8-bb6d-6bb9bd380a03';

test('Advanced activity engine tracks details and updates coaching feedback correctly', async () => {
  const saveDetailsMutation = `
    mutation SaveDailyActivityDetails($input: DailyActivityDetailsInput!) {
      saveDailyActivityDetails(input: $input) {
        id
        pqCompleted
        pqDurationMins
        pqNotes
        pqEvidence
      }
    }
  `;

  const submitFeedbackMutation = `
    mutation SubmitCoachingFeedback($progressId: ID!, $quotient: String!, $feedback: String!) {
      submitCoachingFeedback(progressId: $progressId, quotient: $quotient, feedback: $feedback) {
        id
        pqFeedback
      }
    }
  `;

  // Mock DB Models
  const mockProgressInstance = {
    id: PROGRESS_ID,
    userId: MOTHER_USER_ID,
    dayNumber: 15,
    pqCompleted: true,
    iqCompleted: false,
    eqCompleted: false,
    sqCompleted: false,
    pqDurationMins: 20,
    pqNotes: 'Did breathing exercises',
    pqEvidence: 'https://breathing-session.jpg',
    pqFeedback: null,
    save: async () => {},
    update: async (fields) => {
      Object.assign(mockProgressInstance, fields);
      return mockProgressInstance;
    }
  };

  const lmp20DaysAgo = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000);
  const mockModels = {
    DailyProgress: {
      findOne: async () => mockProgressInstance,
      findByPk: async () => mockProgressInstance
    },
    User: {
      findByPk: async () => ({ id: MOTHER_USER_ID, lmpDate: lmp20DaysAgo })
    }
  };

  // Mock Transaction
  const mockTransaction = {
    LOCK: { UPDATE: 'mock-lock-update' }
  };
  const mockSequelize = {
    transaction: async (cb) => cb(mockTransaction)
  };

  // 1. Mother logs advanced PQ details (Duration, Notes, Evidence)
  const resultSave = await graphql({
    schema,
    source: saveDetailsMutation,
    contextValue: {
      viewer: { id: MOTHER_USER_ID, lmpDate: lmp20DaysAgo, role: { roleType: 'MOTHER' } },
      models: mockModels,
      sequelize: mockSequelize
    },
    variableValues: {
      input: {
        dayNumber: 15,
        quotient: 'PQ',
        durationMins: 20,
        notes: 'Did breathing exercises',
        evidence: 'https://breathing-session.jpg'
      }
    }
  });

  assert.equal(resultSave.errors, undefined);
  assert.equal(resultSave.data.saveDailyActivityDetails.pqCompleted, true);
  assert.equal(resultSave.data.saveDailyActivityDetails.pqDurationMins, 20);
  assert.equal(resultSave.data.saveDailyActivityDetails.pqNotes, 'Did breathing exercises');
  assert.equal(resultSave.data.saveDailyActivityDetails.pqEvidence, 'https://breathing-session.jpg');

  // 2. Coach submits feedback successfully
  const resultFeedback = await graphql({
    schema,
    source: submitFeedbackMutation,
    contextValue: {
      viewer: { id: COACH_USER_ID, role: { roleType: 'GUIDE' } },
      models: mockModels,
      sequelize: mockSequelize
    },
    variableValues: {
      progressId: PROGRESS_ID,
      quotient: 'PQ',
      feedback: 'Excellent breathing technique observed!'
    }
  });

  assert.equal(resultFeedback.errors, undefined);
  assert.equal(resultFeedback.data.submitCoachingFeedback.pqFeedback, 'Excellent breathing technique observed!');

  // 3. Mother fails to submit feedback (returns Unauthorized)
  const resultUnauthorized = await graphql({
    schema,
    source: submitFeedbackMutation,
    contextValue: {
      viewer: { id: MOTHER_USER_ID, role: { roleType: 'MOTHER' } },
      models: mockModels,
      sequelize: mockSequelize
    },
    variableValues: {
      progressId: PROGRESS_ID,
      quotient: 'PQ',
      feedback: 'Self feedback'
    }
  });

  assert.equal(resultUnauthorized.errors?.[0]?.message, 'Unauthorized');
});
