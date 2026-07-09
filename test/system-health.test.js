import assert from 'node:assert/strict';
import test from 'node:test';
import { SystemHealthService } from '../src/modules/platform/systemHealth.service.js';

const VIEWER_ADMIN = { id: 'admin_1', role: { roleType: 'ADMIN' } };
const VIEWER_MOTHER = { id: 'mother_1', role: { roleType: 'MOTHER' } };

test('SystemHealthService - Resource diagnostics, telemetry recording, and audit logs exporter', async () => {
  const mockMetrics = [];
  const mockAuditLogs = [
    { id: 'l1', userId: 'user_1', action: 'create', targetType: 'Product', targetId: 'p1', createdAt: new Date() },
    { id: 'l2', userId: 'user_2', action: 'error', targetType: 'Payment', targetId: 'pay1', createdAt: new Date() }
  ];

  const mockModels = {
    SystemMetric: {
      create: async (input) => {
        const row = { ...input, createdAt: new Date(), updatedAt: new Date() };
        mockMetrics.push(row);
        return row;
      },
      findAll: async (options) => {
        return mockMetrics.filter(m => m.metricType === options.where.metricType);
      }
    },
    AdminAuditLog: {
      count: async (options) => {
        if (options?.where?.action === 'error') {
          return mockAuditLogs.filter(l => l.action === 'error').length;
        }
        return mockAuditLogs.length;
      },
      findAll: async () => mockAuditLogs
    }
  };

  const service = new SystemHealthService(mockModels);

  // 1. Diagnostics
  await assert.rejects(
    service.getServerDiagnostics(VIEWER_MOTHER),
    /Unauthorized access/
  );

  const diag = await service.getServerDiagnostics(VIEWER_ADMIN);
  assert.ok(diag.cpuLoad > 0);
  assert.ok(diag.freeMem > 0);
  assert.ok(diag.processMemory > 0);
  assert.ok(diag.uptimeSeconds >= 0);
  assert.equal(diag.errorCount, 1);

  // 2. Metrics logging
  const logged = await service.logSystemMetric('latency', 45.2);
  assert.equal(logged.metricType, 'latency');
  assert.equal(logged.value, 45.2);
  assert.equal(mockMetrics.length, 1);

  const history = await service.getSystemMetricsHistory(VIEWER_ADMIN, 'latency');
  assert.equal(history.length, 1);
  assert.equal(history[0].value, 45.2);

  // 3. Export Logs
  await assert.rejects(
    service.exportSystemLogs(VIEWER_MOTHER),
    /Unauthorized access/
  );

  const csv = await service.exportSystemLogs(VIEWER_ADMIN);
  assert.ok(csv.startsWith('Timestamp,User,Action,TargetType,TargetId'));
  assert.ok(csv.includes('error'));
  assert.ok(csv.includes('Payment'));
});
