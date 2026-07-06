import test from 'node:test';
import assert from 'node:assert/strict';
import { graphql } from 'graphql';
import schema from '../src/gql/schema/index.js';

test('streak and achievement queries require authentication', async () => {
  const result1 = await graphql({
    schema,
    source: `
      query GetStreak {
        myStreak { currentStreak longestStreak }
      }
    `,
    contextValue: {},
  });
  assert.equal(result1.errors?.[0]?.extensions?.code, 'UNAUTHENTICATED');

  const result2 = await graphql({
    schema,
    source: `
      query GetAchievements {
        myAchievements { badgeKey }
      }
    `,
    contextValue: {},
  });
  assert.equal(result2.errors?.[0]?.extensions?.code, 'UNAUTHENTICATED');
});

test('myWeeklyReport query requires authentication', async () => {
  const result = await graphql({
    schema,
    source: `
      query GetWeekly {
        myWeeklyReport(weekNumber: 2) { weekNumber completedDaysCount }
      }
    `,
    contextValue: {},
  });
  assert.equal(result.errors?.[0]?.extensions?.code, 'UNAUTHENTICATED');
});

test('returns empty streak and achievements initially', async () => {
  let findStreakCalled = false;
  let findAchievementsCalled = false;

  const result = await graphql({
    schema,
    source: `
      query GetStreakAndAchievements {
        myStreak { currentStreak longestStreak }
        myAchievements { badgeKey }
      }
    `,
    contextValue: {
      viewer: { id: 'mother-1' },
      models: {
        UserStreak: {
          findOne: async ({ where }) => {
            findStreakCalled = true;
            assert.equal(where.userId, 'mother-1');
            return null; // Return null to simulate default initial state creation
          },
          create: async (data) => {
            return {
              id: 'streak-1',
              userId: 'mother-1',
              currentStreak: 0,
              longestStreak: 0,
              lastCompletedDate: null
            };
          }
        },
        UserAchievement: {
          findAll: async ({ where }) => {
            findAchievementsCalled = true;
            assert.equal(where.userId, 'mother-1');
            return [];
          }
        }
      },
      sequelize: {},
    },
  });

  assert.equal(result.errors, undefined);
  assert.equal(findStreakCalled, true);
  assert.equal(findAchievementsCalled, true);
  assert.equal(result.data.myStreak.currentStreak, 0);
  assert.equal(result.data.myAchievements.length, 0);
});

test('myWeeklyReport gathers durations and reflections correctly', async () => {
  let findAllCalled = false;

  const result = await graphql({
    schema,
    source: `
      query GetWeeklyReport {
        myWeeklyReport(weekNumber: 2) {
          weekNumber
          completedDaysCount
          totalWeekDurationMins
          days {
            dayNumber
            completed
            totalDurationMins
            reflections
          }
        }
      }
    `,
    contextValue: {
      viewer: { id: 'mother-1' },
      models: {
        Sequelize: { Op: { between: 'between' } },
        DailyProgress: {
          findAll: async ({ where }) => {
            findAllCalled = true;
            assert.equal(where.userId, 'mother-1');
            assert.deepEqual(where.dayNumber.between, [8, 14]);
            return [
              {
                dayNumber: 9,
                pqCompleted: true,
                iqCompleted: true,
                eqCompleted: true,
                sqCompleted: true,
                pqDurationMins: 10,
                iqDurationMins: 15,
                eqDurationMins: 20,
                sqDurationMins: 5,
                pqNotes: 'Good yoga',
                iqNotes: 'Read article',
                eqNotes: null,
                sqNotes: 'Peaceful'
              }
            ];
          }
        }
      },
      sequelize: {},
    },
  });

  assert.equal(result.errors, undefined);
  assert.equal(findAllCalled, true);
  assert.equal(result.data.myWeeklyReport.weekNumber, 2);
  assert.equal(result.data.myWeeklyReport.completedDaysCount, 1);
  assert.equal(result.data.myWeeklyReport.totalWeekDurationMins, 50);
  
  const day9 = result.data.myWeeklyReport.days.find(d => d.dayNumber === 9);
  assert.equal(day9.completed, true);
  assert.equal(day9.totalDurationMins, 50);
  assert.deepEqual(day9.reflections, ['Good yoga', 'Read article', 'Peaceful']);
});
