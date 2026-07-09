import assert from 'node:assert/strict';
import test from 'node:test';
import { graphql } from 'graphql';
import schema from '../src/gql/schema/index.js';

test('Counseling Pipeline Lead-to-Member Conversion, Schedulers, and Dashboards', async () => {
  // GQL signatures
  const createLeadMutation = `
    mutation CreateLead($name: String!, $email: String, $phone: String!, $source: String) {
      createCounselingLead(name: $name, email: $email, phone: $phone, source: $source) {
        id
        name
        status
        source
      }
    }
  `;

  const getLeadsQuery = `
    query GetLeads($status: String, $assignedToMe: Boolean) {
      getCounselingLeads(status: $status, assignedToMe: $assignedToMe) {
        id
        name
        status
        phone
      }
    }
  `;

  const getLeadDetailsQuery = `
    query GetLeadDetails($id: ID!) {
      getCounselingLeadDetails(id: $id) {
        id
        name
        status
        calls {
          id
          scheduledAt
          status
        }
      }
    }
  `;

  const assignLeadMutation = `
    mutation AssignLead($id: ID!, $counselorId: ID!) {
      assignCounselingLead(id: $id, counselorId: $counselorId) {
        id
        assignedTo
      }
    }
  `;

  const updateLeadStatusMutation = `
    mutation UpdateStatus($id: ID!, $status: String!) {
      updateCounselingLeadStatus(id: $id, status: $status) {
        id
        status
      }
    }
  `;

  const scheduleCallMutation = `
    mutation ScheduleCall($leadId: ID!, $scheduledAt: String!) {
      scheduleCounselingCall(leadId: $leadId, scheduledAt: $scheduledAt) {
        id
        scheduledAt
        status
      }
    }
  `;

  const logCallOutcomeMutation = `
    mutation LogOutcome($callId: ID!, $status: String!, $durationMinutes: Int, $outcome: String, $notes: String) {
      logCounselingCallOutcome(callId: $callId, status: $status, durationMinutes: $durationMinutes, outcome: $outcome, notes: $notes) {
        id
        status
        outcome
      }
    }
  `;

  const convertLeadToMemberMutation = `
    mutation ConvertLead($leadId: ID!, $centerId: ID!) {
      convertLeadToMember(leadId: $leadId, centerId: $centerId) {
        id
        displayName
        emailAddress
        mobileNo
      }
    }
  `;

  const getDashboardStatsQuery = `
    query GetStats {
      getCounselingDashboardStats {
        totalLeadsCount
        newLeadsCount
        contactedLeadsCount
        scheduledLeadsCount
        convertedLeadsCount
        lostLeadsCount
        conversionRate
      }
    }
  `;

  // Mocks stores
  const leadsStore = [];
  const callsStore = [];
  const usersStore = [];

  const mockModels = {
    CounselingLead: {
      create: async (input) => {
        const lead = {
          id: 'b1111111-1111-4111-8111-111111111111',
          name: input.name,
          email: input.email || null,
          phone: input.phone,
          source: input.source || 'web',
          status: 'new',
          assignedTo: null,
          convertedUserId: null,
          convertedAt: null,
          nextFollowUp: null,
          createdAt: new Date(),
          save: async function() { return this; }
        };
        leadsStore.push(lead);
        return lead;
      },
      findAll: async (options = {}) => {
        let results = [...leadsStore];
        if (options.where?.status) {
          results = results.filter(l => l.status === options.where.status);
        }
        if (options.where?.assignedTo) {
          results = results.filter(l => l.assignedTo === options.where.assignedTo);
        }
        return results.map(l => {
          l.calls = callsStore.filter(c => c.leadId === l.id);
          return l;
        });
      },
      findByPk: async (id) => {
        const lead = leadsStore.find(l => l.id === id);
        if (!lead) return null;
        lead.calls = callsStore.filter(c => c.leadId === lead.id);
        return lead;
      }
    },
    CounselingCall: {
      create: async (input) => {
        const call = {
          id: '33333333-3333-4333-8333-333333333333',
          leadId: input.leadId,
          scheduledAt: new Date(input.scheduledAt),
          status: input.status,
          counselorId: input.counselorId,
          durationMinutes: null,
          outcome: null,
          notes: null,
          createdAt: new Date(),
          save: async function() { return this; }
        };
        callsStore.push(call);
        return call;
      },
      findAll: async (options = {}) => {
        if (options.where?.leadId) {
          return callsStore.filter(c => c.leadId === options.where.leadId);
        }
        return callsStore;
      },
      findByPk: async (id) => {
        const call = callsStore.find(c => c.id === id);
        if (!call) return null;
        return call;
      }
    },
    User: {
      findOne: async (options = {}) => {
        if (options.where?.mobileNo) {
          return usersStore.find(u => u.mobileNo === options.where.mobileNo) || null;
        }
        return null;
      },
      create: async (input) => {
        const user = {
          id: '55555555-5555-4555-8555-555555555555',
          displayName: input.displayName,
          emailAddress: input.emailAddress,
          mobileNo: input.mobileNo,
          roleId: input.roleId,
          centerId: input.centerId,
          pregnancyStartDate: input.pregnancyStartDate,
          createdAt: new Date()
        };
        usersStore.push(user);
        return user;
      },
      findByPk: async (id) => {
        if (id === '22222222-2222-4222-8222-222222222222') {
          return { id: '22222222-2222-4222-8222-222222222222', displayName: 'Staff Counselor' };
        }
        return usersStore.find(u => u.id === id) || null;
      }
    },
    Role: {
      findOne: async (options = {}) => {
        if (options.where?.roleType === 'MOTHER') {
          return { id: 'role-mother-id', roleType: 'MOTHER' };
        }
        return null;
      }
    }
  };

  const runQuery = async (source, variables, viewer) => {
    return graphql({
      schema,
      source,
      variableValues: variables,
      contextValue: {
        viewer,
        models: mockModels,
        sequelize: {
          transaction: async (fn) => fn({})
        }
      }
    });
  };

  const staffViewer = { id: '22222222-2222-4222-8222-222222222222', role: { roleType: 'STAFF' }, centerId: '44444444-4444-4444-8444-444444444444' };

  // 1. Create a lead
  const res1 = await runQuery(createLeadMutation, {
    name: 'Kareena Kapoor',
    phone: '+919999777766',
    email: 'kareena@example.com',
    source: 'web'
  }, staffViewer);

  assert.equal(res1.errors, undefined);
  assert.equal(res1.data.createCounselingLead.name, 'Kareena Kapoor');
  assert.equal(res1.data.createCounselingLead.status, 'new');

  // 2. Assign lead
  const leadId = res1.data.createCounselingLead.id;
  const res2 = await runQuery(assignLeadMutation, {
    id: leadId,
    counselorId: '22222222-2222-4222-8222-222222222222'
  }, staffViewer);
  assert.equal(res2.errors, undefined);
  assert.equal(res2.data.assignCounselingLead.assignedTo, '22222222-2222-4222-8222-222222222222');

  // 3. Schedule counseling call
  const res3 = await runQuery(scheduleCallMutation, {
    leadId,
    scheduledAt: '2026-07-15T15:00:00.000Z'
  }, staffViewer);
  assert.equal(res3.errors, undefined);
  assert.equal(res3.data.scheduleCounselingCall.status, 'scheduled');

  // Verify lead stage auto transitioned to scheduled
  const resLeadDetails = await runQuery(getLeadDetailsQuery, { id: leadId }, staffViewer);
  assert.equal(resLeadDetails.data.getCounselingLeadDetails.status, 'scheduled');
  assert.equal(resLeadDetails.data.getCounselingLeadDetails.calls.length, 1);

  // 4. Log call outcome
  const callId = res3.data.scheduleCounselingCall.id;
  const res4 = await runQuery(logCallOutcomeMutation, {
    callId,
    status: 'completed',
    durationMinutes: 20,
    outcome: 'very_interested',
    notes: 'Likes the premium Garbh Sanskar bundle. Asked for discount.'
  }, staffViewer);
  assert.equal(res4.errors, undefined);
  assert.equal(res4.data.logCounselingCallOutcome.status, 'completed');

  // Verify lead stage transitioned to contacted
  const resLeadDetailsAfter = await runQuery(getLeadDetailsQuery, { id: leadId }, staffViewer);
  assert.equal(resLeadDetailsAfter.data.getCounselingLeadDetails.status, 'contacted');

  // 5. Convert lead to Mother Member
  const res5 = await runQuery(convertLeadToMemberMutation, {
    leadId,
    centerId: '44444444-4444-4444-8444-444444444444'
  }, staffViewer);
  assert.equal(res5.errors, undefined);
  assert.equal(res5.data.convertLeadToMember.displayName, 'Kareena Kapoor');
  assert.equal(res5.data.convertLeadToMember.mobileNo, '+919999777766');

  // 6. Verify dashboard stats
  const resStats = await runQuery(getDashboardStatsQuery, {}, staffViewer);
  assert.equal(resStats.errors, undefined);
  assert.equal(resStats.data.getCounselingDashboardStats.totalLeadsCount, 1);
  assert.equal(resStats.data.getCounselingDashboardStats.convertedLeadsCount, 1);
  assert.equal(resStats.data.getCounselingDashboardStats.conversionRate, 100);
});
