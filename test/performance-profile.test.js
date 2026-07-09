import assert from 'node:assert/strict';
import test from 'node:test';
import { PerformanceProfileService } from '../src/modules/platform/performanceProfile.service.js';

const VIEWER_ADMIN = { id: 'admin_1', role: { roleType: 'ADMIN' } };
const VIEWER_MOTHER = { id: 'mother_1', role: { roleType: 'MOTHER' } };

test('PerformanceProfileService - SQL performance logging, database index diagnostics, and log purger', async () => {
  let mockQueries = [];

  const mockModels = {
    QueryPerformanceAudit: {
      create: async (input) => {
        const row = { ...input, createdAt: new Date(), updatedAt: new Date() };
        mockQueries.push(row);
        return row;
      },
      findAll: async (options) => {
        const threshold = options?.where?.durationMs?.[Symbol.for('gte')] || 0;
        return mockQueries.filter(q => q.durationMs >= threshold);
      },
      destroy: async () => {
        mockQueries = [];
        return true;
      }
    }
  };

  const service = new PerformanceProfileService(mockModels);

  // 1. Slow Query execution logger
  const loggedNone = await service.logQueryExecution('SELECT * FROM users', 30, 50);
  assert.equal(loggedNone, null);
  assert.equal(mockQueries.length, 0);

  const loggedSlow = await service.logQueryExecution('SELECT * FROM daily_contents', 75, 50);
  assert.ok(loggedSlow);
  assert.equal(loggedSlow.durationMs, 75);
  assert.equal(mockQueries.length, 1);

  // 2. Fetch Slow Queries Report
  await assert.rejects(
    service.getSlowQueriesReport(VIEWER_MOTHER, 50),
    /Unauthorized access/
  );

  const report = await service.getSlowQueriesReport(VIEWER_ADMIN, 50);
  assert.equal(report.length, 1);
  assert.equal(report[0].sqlQuery, 'SELECT * FROM daily_contents');

  // Mismatched threshold (no queries >= 100ms)
  const reportHigh = await service.getSlowQueriesReport(VIEWER_ADMIN, 100);
  assert.equal(reportHigh.length, 0);

  // 3. Database Index Diagnostics Scans
  await assert.rejects(
    service.runDatabaseIndexDiagnostic(VIEWER_MOTHER),
    /Unauthorized access/
  );

  const diagnostics = await service.runDatabaseIndexDiagnostic(VIEWER_ADMIN);
  assert.ok(diagnostics.length > 0);
  const mealPlanDiag = diagnostics.find(d => d.table === 'user_meal_plans');
  assert.equal(mealPlanDiag.status, 'WARNING');

  // 4. Purge Logs
  await assert.rejects(
    service.clearSlowQueryLogs(VIEWER_MOTHER),
    /Unauthorized access/
  );

  await service.clearSlowQueryLogs(VIEWER_ADMIN);
  assert.equal(mockQueries.length, 0);
});
