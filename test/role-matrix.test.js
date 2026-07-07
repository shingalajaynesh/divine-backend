import assert from 'node:assert/strict';
import test from 'node:test';
import { graphql } from 'graphql';
import schema from '../src/gql/schema/index.js';

const VIEWER_USER_ID = 'v0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01';
const TARGET_USER_ID = 't0eebc99-9c0b-4ef8-bb6d-6bb9bd380a02';

test('Unified role matrix filters private user fields based on custom role template permissions', async () => {
  const getTargetUserQuery = `
    query {
      getUser(id: "${TARGET_USER_ID}") {
        id
        emailAddress
        mobileNo
      }
    }
  `;

  const mockTargetUser = {
    id: TARGET_USER_ID,
    emailAddress: 'target@example.com',
    mobileNo: '1234567890'
  };

  const mockModels = {
    User: {
      findByPk: async (id) => {
        if (id === TARGET_USER_ID) return mockTargetUser;
        return null;
      }
    }
  };

  const mockUserManager = {
    getUserById: async (id) => {
      if (id === TARGET_USER_ID) return mockTargetUser;
      return null;
    }
  };

  // Case 1: Viewer has query-level view permission but no user_private field permission
  const resultUnauthorized = await graphql({
    schema,
    source: getTargetUserQuery,
    contextValue: {
      viewer: { 
        id: VIEWER_USER_ID, 
        role: { 
          roleType: 'CUSTOM_ROLE', 
          permissions: {
            user: { view: true }
          } 
        } 
      },
      log: { info: () => {}, error: () => {} },
      models: mockModels,
      userManager: mockUserManager
    }
  });

  assert.equal(resultUnauthorized.errors, undefined);
  assert.equal(resultUnauthorized.data.getUser.emailAddress, null);
  assert.equal(resultUnauthorized.data.getUser.mobileNo, null);

  // Case 2: Viewer has query-level view permission AND user_private.read field permission
  const resultAuthorized = await graphql({
    schema,
    source: getTargetUserQuery,
    contextValue: {
      viewer: { 
        id: VIEWER_USER_ID, 
        role: { 
          roleType: 'CUSTOM_ROLE', 
          permissions: {
            user: { view: true },
            user_private: { read: true }
          }
        } 
      },
      log: { info: () => {}, error: () => {} },
      models: mockModels,
      userManager: mockUserManager
    }
  });

  assert.equal(resultAuthorized.errors, undefined);
  assert.equal(resultAuthorized.data.getUser.emailAddress, 'target@example.com');
  assert.equal(resultAuthorized.data.getUser.mobileNo, '1234567890');
});
