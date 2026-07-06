import assert from 'node:assert/strict';
import test from 'node:test';
import { graphql } from 'graphql';
import schema from '../src/gql/schema/index.js';
import { CrmService } from '../src/modules/crm/crm.service.js';

const ADMIN_USER_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a00';
const MEMBER_USER_ID = 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a99';
const NOTE_ID = 'n0eebc99-9c0b-4ef8-bb6d-6bb9bd380n11';

test('CRM queries reject unauthorized mother viewers', async () => {
  const query = '{ getCrmUsers { id displayName } }';
  // Context has no viewer or viewer role is MOTHER
  const result = await graphql({
    schema,
    source: query,
    contextValue: {
      viewer: { id: MEMBER_USER_ID, role: { roleType: 'MOTHER' } }
    }
  });
  assert.equal(result.errors?.[0]?.message, 'Unauthorized access');
});

test('CrmService reads user directories, adds notes, and logs admin action audits', async () => {
  let userListFetched = false;
  let noteCreated = null;
  let auditCreated = null;

  const models = {
    User: {
      findAll: async () => {
        userListFetched = true;
        return [
          {
            id: MEMBER_USER_ID,
            displayName: 'Alice Member',
            email: 'alice@example.com',
            phone: '9988776655',
            pregnancyDay: 45,
            role: { roleType: 'MOTHER' },
            subscriptions: []
          }
        ];
      }
    },
    CrmNote: {
      create: async (input) => {
        noteCreated = input;
        return { id: NOTE_ID, ...input, createdAt: new Date(), updatedAt: new Date() };
      },
      findAll: async ({ where }) => {
        return [
          {
            id: NOTE_ID,
            userId: where.userId,
            authorId: ADMIN_USER_ID,
            note: 'Regular medical followup done',
            createdAt: new Date(),
            updatedAt: new Date(),
            author: { displayName: 'Staff Nurse' }
          }
        ];
      }
    },
    AdminAuditLog: {
      create: async (input) => {
        auditCreated = input;
        return { id: 'audit-1', ...input, createdAt: new Date() };
      },
      findAll: async () => {
        return [
          {
            id: 'audit-1',
            userId: ADMIN_USER_ID,
            action: 'add_crm_note',
            targetType: 'User',
            targetId: MEMBER_USER_ID,
            payload: JSON.stringify({ note: 'Sample' }),
            createdAt: new Date(),
            user: { displayName: 'Jayne Admin', email: 'admin@divine.org' }
          }
        ];
      }
    }
  };

  const service = new CrmService(models, {});

  // 1. Fetch CRM User List
  const users = await service.getUsersList();
  assert.equal(userListFetched, true);
  assert.equal(users[0].displayName, 'Alice Member');

  // 2. Add CRM Note
  await service.addCrmNote(MEMBER_USER_ID, ADMIN_USER_ID, 'Followup clinical checkup looks normal');
  assert.equal(noteCreated.userId, MEMBER_USER_ID);
  assert.equal(noteCreated.authorId, ADMIN_USER_ID);
  assert.equal(noteCreated.note, 'Followup clinical checkup looks normal');

  // 3. Fetch CRM Notes
  const notes = await service.getCrmNotes(MEMBER_USER_ID);
  assert.equal(notes[0].note, 'Regular medical followup done');

  // 4. Log Admin Audit Action
  await service.logAdminAction(ADMIN_USER_ID, 'add_crm_note', 'User', MEMBER_USER_ID, { note: 'Sample' });
  assert.equal(auditCreated.action, 'add_crm_note');
  assert.equal(auditCreated.userId, ADMIN_USER_ID);

  // 5. Read Audit Logs
  const logs = await service.getAuditLogs();
  assert.equal(logs[0].action, 'add_crm_note');
});
