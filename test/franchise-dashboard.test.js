import assert from 'node:assert/strict';
import test from 'node:test';
import { graphql } from 'graphql';
import schema from '../src/gql/schema/index.js';

const FRANCHISE_USER_ID = 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01';
const MEMBER_USER_ID = 'm0eebc99-9c0b-4ef8-bb6d-6bb9bd380a02';

test('Franchise dashboard GQL queries enforce authorized FRANCHISE_ADMIN viewer role permissions', async () => {
  const getFranchiseQuery = `
    query {
      getFranchiseMetrics {
        centersCount
        totalMothersCount
        averageStaffResponsePercent
        slaAlertsCount
      }
    }
  `;

  // 1. Should reject non-authorized role (mother)
  const resultMother = await graphql({
    schema,
    source: getFranchiseQuery,
    contextValue: {
      viewer: { id: MEMBER_USER_ID, role: { roleType: 'MOTHER' } }
    }
  });
  assert.equal(resultMother.errors?.[0]?.message, 'Unauthorized');

  // 2. Should succeed for franchise admin / administrator
  const mockModels = {
    Center: {
      findAll: async () => [
        { id: 'c-1', name: 'Center North', isActive: true },
        { id: 'c-2', name: 'Center South', isActive: true }
      ]
    },
    User: {
      count: async () => 15,
      findAll: async () => []
    },
    UserSubscription: {
      count: async () => 8
    },
    SupportTicket: {
      count: async () => 1
    },
    StaffTask: {
      count: async () => 4
    }
  };

  const resultFranchise = await graphql({
    schema,
    source: getFranchiseQuery,
    contextValue: {
      viewer: { id: FRANCHISE_USER_ID, role: { roleType: 'FRANCHISE_ADMIN' } },
      models: mockModels
    }
  });

  assert.equal(resultFranchise.errors, undefined);
  assert.equal(resultFranchise.data.getFranchiseMetrics.centersCount, 2);
  assert.equal(resultFranchise.data.getFranchiseMetrics.totalMothersCount, 15);
  assert.equal(resultFranchise.data.getFranchiseMetrics.slaAlertsCount, 1);
});
