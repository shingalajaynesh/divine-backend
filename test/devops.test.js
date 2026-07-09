import assert from 'node:assert/strict';
import test from 'node:test';
import { DevOpsService } from '../src/modules/platform/devops.service.js';

const VIEWER_ADMIN = { id: 'admin_1', role: { roleType: 'ADMIN' } };
const VIEWER_MOTHER = { id: 'mother_1', role: { roleType: 'MOTHER' } };

test('DevOpsService - Observability parameters, backups tracking, and restore drills checks', async () => {
  const mockBackups = [];

  const mockModels = {
    DatabaseBackup: {
      create: async (input) => {
        const row = { ...input, createdAt: new Date(), updatedAt: new Date() };
        mockBackups.push(row);
        return row;
      },
      findAll: async () => mockBackups,
      findByPk: async (id) => mockBackups.find(b => b.id === id) || null
    }
  };

  const service = new DevOpsService(mockModels);

  // 1. Environment status check
  await assert.rejects(
    service.getEnvironmentStatus(VIEWER_MOTHER),
    /Unauthorized access/
  );

  const env = await service.getEnvironmentStatus(VIEWER_ADMIN);
  assert.equal(env.releaseVersion, 'v1.4.0-stable');
  assert.ok(env.envMode);

  // 2. Trigger Backup Snapshot Drill
  await assert.rejects(
    service.triggerBackupDrill(VIEWER_MOTHER),
    /Unauthorized access/
  );

  const bk = await service.triggerBackupDrill(VIEWER_ADMIN);
  assert.ok(bk.fileName.startsWith('db_backup_snapshot_'));
  assert.ok(bk.backupSize > 0);
  assert.equal(bk.status, 'SUCCESS');
  assert.equal(mockBackups.length, 1);

  // 3. Backup History logs
  const list = await service.getBackupHistory(VIEWER_ADMIN);
  assert.equal(list.length, 1);
  assert.equal(list[0].id, bk.id);

  // 4. Restore Drill
  await assert.rejects(
    service.triggerRestoreDrill(VIEWER_MOTHER, bk.id),
    /Unauthorized access/
  );

  const success = await service.triggerRestoreDrill(VIEWER_ADMIN, bk.id);
  assert.equal(success, true);

  // Restore non-existent backup
  await assert.rejects(
    service.triggerRestoreDrill(VIEWER_ADMIN, 'fake-uuid'),
    /Backup snapshot not found/
  );
});
