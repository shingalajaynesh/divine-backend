import test from 'node:test';
import assert from 'node:assert/strict';
import { userResolvers } from '../src/gql/schema/resolvers/user.js';

const sampleUser = {
  id: 'user-1',
  emailAddress: 'mother@example.com',
  mobileNo: '+919999999999',
  firebaseUid: 'firebase-uid-1',
};

test('user privacy resolvers hide private fields from unrelated viewers', () => {
  const viewer = { id: 'user-2', role: { roleType: 'MOTHER' } };
  const context = { viewer };

  assert.equal(userResolvers.User.firebaseUid(sampleUser, {}, context), null);
  assert.equal(userResolvers.User.emailAddress(sampleUser, {}, context), null);
  assert.equal(userResolvers.User.mobileNo(sampleUser, {}, context), null);
});

test('user privacy resolvers expose private fields to self and staff roles', () => {
  assert.equal(
    userResolvers.User.emailAddress(sampleUser, {}, { viewer: { id: 'user-1', role: { roleType: 'MOTHER' } } }),
    'mother@example.com'
  );
  assert.equal(
    userResolvers.User.mobileNo(sampleUser, {}, { viewer: { id: 'staff-1', role: { roleType: 'STAFF' } } }),
    '+919999999999'
  );
});

test('payment resolver hides transport session identifiers', () => {
  assert.equal(
    userResolvers.Payment.stripeSessionId({ stripeSessionId: 'sess_123' }),
    null
  );
});
