import test from 'node:test';
import assert from 'node:assert/strict';
import { graphql } from 'graphql';
import schema from '../src/gql/schema/index.js';

test('sensory queries require authentication', async () => {
  const result = await graphql({
    schema,
    source: `
      query GetSensoryActivity {
        getSensoryActivity(dayNumber: 15) { title description }
      }
    `,
    contextValue: {},
  });
  assert.equal(result.errors?.[0]?.extensions?.code, 'UNAUTHENTICATED');
});

test('sensory mutations require authentication', async () => {
  const result = await graphql({
    schema,
    source: `
      mutation ToggleSensory {
        toggleSensoryActivity(dayNumber: 15) { id completed }
      }
    `,
    contextValue: {},
  });
  assert.equal(result.errors?.[0]?.extensions?.code, 'UNAUTHENTICATED');
});

test('toggleSensoryActivity rejects future day updates', async () => {
  const tenDaysAgo = new Date();
  tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
  const lmpDateStr = tenDaysAgo.toISOString().split('T')[0];

  const result = await graphql({
    schema,
    source: `
      mutation ToggleFutureSensory {
        toggleSensoryActivity(dayNumber: 25) { id completed }
      }
    `,
    contextValue: {
      viewer: {
        id: 'mother-1',
        lmpDate: lmpDateStr,
        dueDate: null,
      },
      models: {},
      sequelize: {},
    },
  });

  assert.ok(result.errors);
  assert.match(result.errors[0].message, /Cannot complete sensory activities for future days/);
});

test('toggleSensoryActivity toggles state and returns record', async () => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const lmpDateStr = thirtyDaysAgo.toISOString().split('T')[0];

  let findActivityCalled = false;
  let findLogCalled = false;
  let createLogCalled = false;

  const result = await graphql({
    schema,
    source: `
      mutation TogglePastSensory {
        toggleSensoryActivity(dayNumber: 10) {
          id
          dayNumber
          completed
        }
      }
    `,
    contextValue: {
      viewer: {
        id: 'mother-1',
        lmpDate: lmpDateStr,
        dueDate: null,
      },
      models: {
        SensoryActivity: {
          findOne: async ({ where }) => {
            findActivityCalled = true;
            assert.equal(where.dayNumber, 10);
            return {
              id: 'sensory-act-10',
              dayNumber: 10,
              senseType: 'TOUCH',
              titleEn: 'Sample Title'
            };
          }
        },
        SensoryActivityLog: {
          findOne: async ({ where }) => {
            findLogCalled = true;
            assert.equal(where.userId, 'mother-1');
            assert.equal(where.dayNumber, 10);
            return null; // Simulate first time logging
          },
          create: async (data) => {
            createLogCalled = true;
            assert.equal(data.userId, 'mother-1');
            assert.equal(data.dayNumber, 10);
            assert.equal(data.completed, true);
            return {
              id: 'log-10',
              userId: 'mother-1',
              dayNumber: 10,
              completed: true,
              completedAt: new Date()
            };
          }
        }
      },
      sequelize: {
        transaction: async (cb) => cb({ LOCK: { UPDATE: 'UPDATE' } })
      },
    },
  });

  assert.equal(result.errors, undefined);
  assert.equal(findActivityCalled, true);
  assert.equal(findLogCalled, true);
  assert.equal(createLogCalled, true);
  assert.equal(result.data.toggleSensoryActivity.completed, true);
});
