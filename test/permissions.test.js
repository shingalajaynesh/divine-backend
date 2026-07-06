import test from 'node:test';
import assert from 'node:assert/strict';
import {
  authenticate,
  authorizeRoles,
  authorizeSelfOrRoles,
} from '../src/gql/schema/permissions/index.js';

test('authentication guard rejects missing viewers', async () => {
  await assert.rejects(() => authenticate(async () => true)(null, {}, {}, {}), {
    extensions: { code: 'UNAUTHENTICATED' },
  });
});

test('role and ownership guards allow only authorized viewers', async () => {
  const next = async () => 'allowed';
  const staffContext = { viewer: { id: 'staff-1', role: { roleType: 'STAFF' } } };
  const motherContext = { viewer: { id: 'mother-1', role: { roleType: 'MOTHER' } } };

  assert.equal(await authorizeRoles(['STAFF'], next)(null, {}, staffContext, {}), 'allowed');
  await assert.rejects(() => authorizeRoles(['ADMIN'], next)(null, {}, staffContext, {}));
  assert.equal(
    await authorizeSelfOrRoles((args) => args.id, ['ADMIN'], next)(
      null,
      { id: 'mother-1' },
      motherContext,
      {},
    ),
    'allowed',
  );
  await assert.rejects(() =>
    authorizeSelfOrRoles((args) => args.id, ['ADMIN'], next)(
      null,
      { id: 'another-user' },
      motherContext,
      {},
    ),
  );
});
