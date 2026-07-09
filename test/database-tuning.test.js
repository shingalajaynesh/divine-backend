import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseTuningService } from '../src/modules/platform/databaseTuning.service.js';

const VIEWER_ADMIN = { id: 'admin_1', role: { roleType: 'ADMIN' } };
const VIEWER_MOTHER = { id: 'mother_1', role: { roleType: 'MOTHER' } };

test('DatabaseTuningService - Replication status, connection pool configurations, and replica failover sequence', async () => {
  const mockReplicationStatus = [];
  const mockSettings = [];

  const mockModels = {
    ReplicationStatus: {
      create: async (input) => {
        const row = { ...input, createdAt: new Date(), updatedAt: new Date() };
        mockReplicationStatus.push(row);
        return row;
      },
      findAll: async () => mockReplicationStatus
    },
    SystemSetting: {
      findOne: async (options) => mockSettings.find(s => s.key === options.where.key) || null,
      upsert: async (input) => {
        const index = mockSettings.findIndex(s => s.key === input.key);
        if (index >= 0) {
          mockSettings[index].value = input.value;
        } else {
          mockSettings.push(input);
        }
        return [input, true];
      }
    }
  };

  const service = new DatabaseTuningService(mockModels);

  // 1. Get database cluster status
  await assert.rejects(
    service.getDatabaseClusterStatus(VIEWER_MOTHER),
    /Unauthorized access/
  );

  const status = await service.getDatabaseClusterStatus(VIEWER_ADMIN);
  assert.equal(status.primaryNodeHealthy, true);
  assert.equal(status.replicaLagMs, 14);
  assert.equal(status.maxPoolSize, 20);

  // 2. Adjust Pool Sizes
  await assert.rejects(
    service.updateConnectionPoolConfig(VIEWER_MOTHER, 50, 15000),
    /Unauthorized access/
  );

  const updated = await service.updateConnectionPoolConfig(VIEWER_ADMIN, 55, 12000);
  assert.equal(updated, true);

  const updatedStatus = await service.getDatabaseClusterStatus(VIEWER_ADMIN);
  assert.equal(updatedStatus.maxPoolSize, 55);

  // 3. Failover Sequence Simulation
  await assert.rejects(
    service.triggerFailoverSimulation(VIEWER_MOTHER),
    /Unauthorized access/
  );

  const failover = await service.triggerFailoverSimulation(VIEWER_ADMIN);
  assert.equal(failover, true);
  assert.equal(mockReplicationStatus.length, 1);
  assert.equal(mockReplicationStatus[0].lagMs, 0);
});
