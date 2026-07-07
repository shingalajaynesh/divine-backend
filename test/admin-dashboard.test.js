import assert from 'node:assert/strict';
import test from 'node:test';
import { graphql } from 'graphql';
import schema from '../src/gql/schema/index.js';

const ADMIN_USER_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01';
const STAFF_USER_ID = 's0eebc99-9c0b-4ef8-bb6d-6bb9bd380a02';
const MEMBER_USER_ID = 'm0eebc99-9c0b-4ef8-bb6d-6bb9bd380a03';
const CENTER_ID = 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a04';

test('Center admin GQL queries enforce authorized ADMIN viewer role permissions', async () => {
  const getKpisQuery = `
    query {
      getCenterKpis {
        totalMothers
        activeStaff
        premiumEnrollments
        slaBreachedTickets
      }
    }
  `;

  // 1. Should reject non-admin (staff) user
  const resultStaff = await graphql({
    schema,
    source: getKpisQuery,
    contextValue: {
      viewer: { id: STAFF_USER_ID, centerId: CENTER_ID, role: { roleType: 'STAFF' } }
    }
  });
  assert.equal(resultStaff.errors?.[0]?.message, 'Unauthorized');

  // 2. Should succeed for admin user
  const mockModels = {
    User: {
      count: async ({ where }) => {
        assert.equal(where.centerId, CENTER_ID);
        // Returns total count based on query params
        return 10;
      },
      findAll: async ({ where }) => {
        assert.equal(where.centerId, CENTER_ID);
        return [
          { 
            id: STAFF_USER_ID, 
            displayName: 'Nurse Alice', 
            emailAddress: 'alice@example.com',
            createdAt: new Date()
          }
        ];
      }
    },
    UserSubscription: {
      count: async () => 5
    },
    SupportTicket: {
      count: async () => 2,
      findAll: async () => [
        { id: 't-1', subject: 'App crashed', priority: 'high', slaBreached: true, createdAt: new Date() }
      ]
    },
    StaffTask: {
      count: async ({ where }) => {
        if (where.completed === false) return 3;
        return 7;
      }
    }
  };

  const resultAdmin = await graphql({
    schema,
    source: getKpisQuery,
    contextValue: {
      viewer: { id: ADMIN_USER_ID, centerId: CENTER_ID, role: { roleType: 'ADMIN' } },
      models: mockModels
    }
  });

  assert.equal(resultAdmin.errors, undefined);
  assert.equal(resultAdmin.data.getCenterKpis.totalMothers, 10);
  assert.equal(resultAdmin.data.getCenterKpis.activeStaff, 10);
  assert.equal(resultAdmin.data.getCenterKpis.premiumEnrollments, 5);
  assert.equal(resultAdmin.data.getCenterKpis.slaBreachedTickets, 2);
});
