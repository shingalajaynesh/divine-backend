import test from 'node:test';
import assert from 'node:assert/strict';
import { graphql } from 'graphql';
import schema from '../src/gql/schema/index.js';

test('timeline queries require authentication', async () => {
  const result = await graphql({
    schema,
    source: `
      query GetProgress {
        myDailyProgress(dayNumber: 15) { id dayNumber pqCompleted }
      }
    `,
    contextValue: {},
  });
  assert.equal(result.errors?.[0]?.extensions?.code, 'UNAUTHENTICATED');
});

test('timeline overview query requires authentication', async () => {
  const result = await graphql({
    schema,
    source: `
      query Overview {
        myTimelineOverview(dayNumber: 15) { currentDay selectedDay isLocked }
      }
    `,
    contextValue: {},
  });
  assert.equal(result.errors?.[0]?.extensions?.code, 'UNAUTHENTICATED');
});

test('timeline mutations require authentication', async () => {
  const result = await graphql({
    schema,
    source: `
      mutation Toggle {
        toggleDailyActivity(dayNumber: 15, quotient: "PQ") { id dayNumber pqCompleted }
      }
    `,
    contextValue: {},
  });
  assert.equal(result.errors?.[0]?.extensions?.code, 'UNAUTHENTICATED');
});

test('toggleDailyActivity mutation rejects future days based on catch-up rule', async () => {
  // Let's set lmpDate to 10 days ago, meaning pregnancyDay is 11.
  const tenDaysAgo = new Date();
  tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
  const lmpDateStr = tenDaysAgo.toISOString().split('T')[0];

  const result = await graphql({
    schema,
    source: `
      mutation ToggleFuture {
        toggleDailyActivity(dayNumber: 25, quotient: "PQ") { id dayNumber pqCompleted }
      }
    `,
    contextValue: {
      viewer: {
        id: 'mother-1',
        lmpDate: lmpDateStr,
        dueDate: null,
      },
      models: {
        Sequelize: { Op: { between: 'between' } }
      },
      sequelize: {},
    },
  });

  assert.ok(result.errors);
  assert.match(result.errors[0].message, /Cannot complete activities for future days/);
});

test('toggleDailyActivity mutation updates past daily progress', async () => {
  // Let's set lmpDate to 30 days ago, meaning pregnancyDay is 31.
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const lmpDateStr = thirtyDaysAgo.toISOString().split('T')[0];

  let findOneCalled = false;
  let createCalled = false;

  const result = await graphql({
    schema,
    source: `
      mutation TogglePast {
        toggleDailyActivity(dayNumber: 10, quotient: "PQ") { id dayNumber pqCompleted }
      }
    `,
    contextValue: {
      viewer: {
        id: 'mother-1',
        lmpDate: lmpDateStr,
        dueDate: null,
      },
      models: {
        Sequelize: { Op: { between: 'between' } },
        DailyProgress: {
          findOne: async ({ where }) => {
            findOneCalled = true;
            assert.equal(where.userId, 'mother-1');
            assert.equal(where.dayNumber, 10);
            return null; // Return null so it simulates a new day record creation
          },
          create: async (data) => {
            createCalled = true;
            assert.equal(data.userId, 'mother-1');
            assert.equal(data.dayNumber, 10);
            assert.equal(data.pqCompleted, true);
            return {
              id: 'progress-1',
              userId: 'mother-1',
              dayNumber: 10,
              pqCompleted: true,
              iqCompleted: false,
              eqCompleted: false,
              sqCompleted: false,
              completedAt: null,
              createdAt: new Date(),
              updatedAt: new Date(),
              update: async (updates) => {
                return this;
              }
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
  assert.equal(findOneCalled, true);
  assert.equal(createCalled, true);
  assert.equal(result.data.toggleDailyActivity.dayNumber, 10);
  assert.equal(result.data.toggleDailyActivity.pqCompleted, true);
});

test('timeline overview returns current journey stats and scoped week progress', async () => {
  const sixWeeksAgo = new Date();
  sixWeeksAgo.setDate(sixWeeksAgo.getDate() - 41);
  const lmpDateStr = sixWeeksAgo.toISOString().split('T')[0];

  const result = await graphql({
    schema,
    source: `
      query Overview {
        myTimelineOverview(dayNumber: 12) {
          currentDay
          currentWeek
          currentTrimester
          selectedDay
          selectedWeek
          selectedMonth
          selectedTrimester
          weekStartDay
          weekEndDay
          isLocked
          completedCount
          progressPercent
          days {
            dayNumber
            locked
            completed
            pqCompleted
            iqCompleted
            eqCompleted
            sqCompleted
          }
          selectedProgress {
            dayNumber
            pqCompleted
            iqCompleted
            eqCompleted
            sqCompleted
          }
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
        Sequelize: { Op: { between: 'between' } },
        DailyProgress: {
          findAll: async ({ where }) => {
            assert.equal(where.userId, 'mother-1');
            assert.deepEqual(where.dayNumber.between, [8, 14]);
            return [
              {
                dayNumber: 12,
                pqCompleted: true,
                iqCompleted: true,
                eqCompleted: false,
                sqCompleted: false,
              },
              {
                dayNumber: 10,
                pqCompleted: true,
                iqCompleted: true,
                eqCompleted: true,
                sqCompleted: true,
              },
            ];
          },
          findOne: async () => null,
        }
      },
      sequelize: {},
    },
  });

  assert.equal(result.errors, undefined);
  assert.equal(result.data.myTimelineOverview.selectedDay, 12);
  assert.equal(result.data.myTimelineOverview.selectedWeek, 2);
  assert.equal(result.data.myTimelineOverview.selectedMonth, 1);
  assert.equal(result.data.myTimelineOverview.selectedTrimester, 1);
  assert.equal(result.data.myTimelineOverview.weekStartDay, 8);
  assert.equal(result.data.myTimelineOverview.weekEndDay, 14);
  assert.equal(result.data.myTimelineOverview.isLocked, false);
  assert.equal(result.data.myTimelineOverview.completedCount, 2);
  assert.equal(result.data.myTimelineOverview.progressPercent, 50);
  assert.equal(result.data.myTimelineOverview.days.length, 7);
  assert.equal(result.data.myTimelineOverview.days.find((day) => day.dayNumber === 10).completed, true);
  assert.equal(result.data.myTimelineOverview.selectedProgress.dayNumber, 12);
});

test('saveDailyActivityDetails mutation requires authentication', async () => {
  const result = await graphql({
    schema,
    source: `
      mutation SaveDetails {
        saveDailyActivityDetails(input: { dayNumber: 15, quotient: "PQ", durationMins: 10, notes: "Feeling great!" }) {
          id dayNumber pqCompleted pqDurationMins pqNotes
        }
      }
    `,
    contextValue: {},
  });
  assert.equal(result.errors?.[0]?.extensions?.code, 'UNAUTHENTICATED');
});

test('saveDailyActivityDetails mutation rejects future days', async () => {
  const tenDaysAgo = new Date();
  tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
  const lmpDateStr = tenDaysAgo.toISOString().split('T')[0];

  const result = await graphql({
    schema,
    source: `
      mutation SaveDetailsFuture {
        saveDailyActivityDetails(input: { dayNumber: 25, quotient: "PQ", durationMins: 10, notes: "Feeling great!" }) {
          id dayNumber pqCompleted
        }
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
  assert.match(result.errors[0].message, /Cannot save details for future days/);
});

test('saveDailyActivityDetails mutation updates past daily progress successfully', async () => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const lmpDateStr = thirtyDaysAgo.toISOString().split('T')[0];

  let findOneCalled = false;
  let createCalled = false;

  const result = await graphql({
    schema,
    source: `
      mutation SaveDetailsPast {
        saveDailyActivityDetails(input: { dayNumber: 10, quotient: "PQ", durationMins: 15, evidence: "https://proof.com", notes: "Amazing yoga session" }) {
          id
          dayNumber
          pqCompleted
          pqDurationMins
          pqEvidence
          pqNotes
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
        Sequelize: { Op: { between: 'between' } },
        DailyProgress: {
          findOne: async ({ where }) => {
            findOneCalled = true;
            assert.equal(where.userId, 'mother-1');
            assert.equal(where.dayNumber, 10);
            return null; // Simulate new day record
          },
          create: async (data) => {
            createCalled = true;
            assert.equal(data.userId, 'mother-1');
            assert.equal(data.dayNumber, 10);
            assert.equal(data.pqCompleted, true);
            assert.equal(data.pqDurationMins, 15);
            assert.equal(data.pqEvidence, 'https://proof.com');
            assert.equal(data.pqNotes, 'Amazing yoga session');
            
            return {
              id: 'progress-1',
              userId: 'mother-1',
              dayNumber: 10,
              pqCompleted: true,
              iqCompleted: false,
              eqCompleted: false,
              sqCompleted: false,
              pqDurationMins: 15,
              pqEvidence: 'https://proof.com',
              pqNotes: 'Amazing yoga session',
              completedAt: null,
              createdAt: new Date(),
              updatedAt: new Date(),
              update: async (updates) => {
                return this;
              }
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
  assert.equal(findOneCalled, true);
  assert.equal(createCalled, true);
  assert.equal(result.data.saveDailyActivityDetails.dayNumber, 10);
  assert.equal(result.data.saveDailyActivityDetails.pqCompleted, true);
  assert.equal(result.data.saveDailyActivityDetails.pqDurationMins, 15);
  assert.equal(result.data.saveDailyActivityDetails.pqEvidence, 'https://proof.com');
  assert.equal(result.data.saveDailyActivityDetails.pqNotes, 'Amazing yoga session');
});
