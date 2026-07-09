import assert from 'node:assert/strict';
import test from 'node:test';
import { graphql } from 'graphql';
import schema from '../src/gql/schema/index.js';

const SUPER_ADMIN_USER_ID = 'sa0eebc9-9c0b-4ef8-bb6d-6bb9bd380a01';
const MEMBER_USER_ID = 'm0eebc99-9c0b-4ef8-bb6d-6bb9bd380a02';

test('Super Admin control tower GQL queries and mutations enforce role authorizations', async () => {
  const getSuperAdminQuery = `
    query {
      getSuperAdminMetrics {
        totalUsersCount
        totalCentersCount
        systemStatus
        activeAlertsCount
        approvalsQueueCount
      }
    }
  `;

  // 1. Should reject non-authorized role (mother)
  const resultMother = await graphql({
    schema,
    source: getSuperAdminQuery,
    contextValue: {
      viewer: { id: MEMBER_USER_ID, role: { roleType: 'MOTHER' } }
    }
  });
  assert.equal(resultMother.errors?.[0]?.message, 'Unauthorized');

  const resultAdmin = await graphql({
    schema,
    source: getSuperAdminQuery,
    contextValue: {
      viewer: { id: 'admin-user-1', role: { roleType: 'ADMIN' } }
    }
  });
  assert.equal(resultAdmin.errors?.[0]?.message, 'Unauthorized');

  // 2. Should succeed for super admin viewer context
  const mockModels = {
    User: {
      count: async () => 150
    },
    Center: {
      count: async (args = {}) => {
        const { where } = args;
        if (where && where.isActive === false) return 3;
        return 8;
      },
      findAll: async () => [
        { id: 'c-1', name: 'Center North', isActive: false },
        { id: 'c-2', name: 'Center South', isActive: true }
      ],
      findByPk: async () => ({
        id: 'c-1',
        isActive: false,
        save: async () => {}
      })
    },
    SupportTicket: {
      count: async () => 5
    },
    AdminAuditLog: {
      findAll: async () => []
    },
    Role: {
      findByPk: async () => ({
        id: 'r-1',
        permissions: 'old',
        save: async () => {}
      })
    }
  };

  const resultSuperAdmin = await graphql({
    schema,
    source: getSuperAdminQuery,
    contextValue: {
      viewer: { id: SUPER_ADMIN_USER_ID, role: { roleType: 'SUPER_ADMIN' } },
      models: mockModels
    }
  });

  assert.equal(resultSuperAdmin.errors, undefined);
  assert.equal(resultSuperAdmin.data.getSuperAdminMetrics.totalUsersCount, 150);
  assert.equal(resultSuperAdmin.data.getSuperAdminMetrics.totalCentersCount, 8);
  assert.equal(resultSuperAdmin.data.getSuperAdminMetrics.approvalsQueueCount, 3);

  const getCentersQuery = `
    query {
      getCenters {
        id
        name
        isActive
      }
    }
  `;

  const resultCenters = await graphql({
    schema,
    source: getCentersQuery,
    contextValue: {
      viewer: { id: SUPER_ADMIN_USER_ID, role: { roleType: 'SUPER_ADMIN' } },
      models: mockModels
    }
  });

  assert.equal(resultCenters.errors, undefined);
  assert.equal(resultCenters.data.getCenters.length, 2);
  assert.equal(resultCenters.data.getCenters[0].name, 'Center North');

  // 3. Mutation: updateRolePermissions
  const updatePermissionsMutation = `
    mutation {
      updateRolePermissions(roleId: "r-1", permissions: "new") {
        id
        permissions
      }
    }
  `;

  const resultMutation1 = await graphql({
    schema,
    source: updatePermissionsMutation,
    contextValue: {
      viewer: { id: SUPER_ADMIN_USER_ID, role: { roleType: 'SUPER_ADMIN' } },
      models: mockModels
    }
  });

  assert.equal(resultMutation1.errors, undefined);
  assert.equal(resultMutation1.data.updateRolePermissions.permissions, 'new');

  // 4. Mutation: approveCenter
  const approveCenterMutation = `
    mutation {
      approveCenter(centerId: "c-1", approved: true) {
        id
        isActive
      }
    }
  `;

  const resultMutation2 = await graphql({
    schema,
    source: approveCenterMutation,
    contextValue: {
      viewer: { id: SUPER_ADMIN_USER_ID, role: { roleType: 'SUPER_ADMIN' } },
      models: mockModels
    }
  });

  assert.equal(resultMutation2.errors, undefined);
  assert.equal(resultMutation2.data.approveCenter.isActive, true);
});
