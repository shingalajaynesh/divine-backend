import assert from 'node:assert/strict';
import test from 'node:test';
import { graphql } from 'graphql';
import schema from '../src/gql/schema/index.js';

test('Monthly reporting aggregates completed days count and durations correctly', async () => {
  const monthlyReportQuery = `
    query GetMonthlyReport($monthNumber: Int!) {
      myMonthlyReport(monthNumber: $monthNumber) {
        monthNumber
        completedDaysCount
        totalMonthDurationMins
        weeks {
          weekNumber
          completedDaysCount
          totalWeekDurationMins
        }
      }
    }
  `;

  const mockModels = {
    DailyProgress: {
      findAll: async ({ where }) => {
        // Mock progress entries: return 2 days checked per week
        const dayStart = where.dayNumber[Symbol.for('between')][0];
        return [
          { dayNumber: dayStart, pqCompleted: true, iqCompleted: true, eqCompleted: true, sqCompleted: true, pqDurationMins: 10, iqDurationMins: 10, eqDurationMins: 10, sqDurationMins: 10 },
          { dayNumber: dayStart + 1, pqCompleted: true, iqCompleted: true, eqCompleted: true, sqCompleted: true, pqDurationMins: 5, iqDurationMins: 5, eqDurationMins: 5, sqDurationMins: 5 }
        ];
      }
    },
    Sequelize: {
      Op: {
        between: Symbol.for('between')
      }
    }
  };

  const result = await graphql({
    schema,
    source: monthlyReportQuery,
    contextValue: {
      viewer: { id: 'user-id-123' },
      models: mockModels,
      sequelize: {}
    },
    variableValues: {
      monthNumber: 1
    }
  });

  assert.equal(result.errors, undefined);
  assert.equal(result.data.myMonthlyReport.monthNumber, 1);
  // 2 days per week * 4 weeks = 8 days
  assert.equal(result.data.myMonthlyReport.completedDaysCount, 8);
  // (40 mins + 20 mins) * 4 weeks = 240 mins
  assert.equal(result.data.myMonthlyReport.totalMonthDurationMins, 240);
  assert.equal(result.data.myMonthlyReport.weeks.length, 4);
});
