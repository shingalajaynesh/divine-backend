import assert from 'node:assert/strict';
import test from 'node:test';
import { graphql } from 'graphql';
import schema from '../src/gql/schema/index.js';

test('Advanced Support Desk Tickets, WhatsApp Handoff, SLA check, and CSAT Metrics', async () => {
  const getStaffSupportTicketsQuery = `
    query GetStaffSupportTickets($status: String) {
      getStaffSupportTickets(status: $status) {
        id
        subject
        status
        priority
        slaBreached
        user {
          displayName
        }
      }
    }
  `;

  const getCannedRepliesQuery = `
    query GetCannedReplies {
      getCannedReplies {
        id
        title
        content
        category
      }
    }
  `;

  const getSupportDashboardMetricsQuery = `
    query GetSupportDashboardMetrics {
      getSupportDashboardMetrics {
        totalTicketsCount
        resolvedTicketsCount
        pendingTicketsCount
        slaBreachedCount
        averageSatisfactionScore
        satisfactionDistribution {
          score
          count
        }
      }
    }
  `;

  const createCannedReplyMutation = `
    mutation CreateCannedReply($title: String!, $content: String!, $category: String!) {
      createCannedReply(title: $title, content: $content, category: $category) {
        id
        title
        content
      }
    }
  `;

  const addStaffSupportMessageMutation = `
    mutation AddStaffSupportMessage($ticketId: ID!, $message: String!) {
      addStaffSupportMessage(ticketId: $ticketId, message: $message) {
        id
        message
        senderType
      }
    }
  `;

  const updateSupportTicketStatusMutation = `
    mutation UpdateSupportTicketStatus($ticketId: ID!, $status: String!) {
      updateSupportTicketStatus(ticketId: $ticketId, status: $status) {
        id
        status
      }
    }
  `;

  const checkSlaEscalationsMutation = `
    mutation CheckSlaEscalations {
      checkSlaEscalations
    }
  `;

  // Mock data entities
  const mockCanned = {
    id: 'canned-100',
    title: 'Diet Plan Query answer',
    content: 'Please refer to your Diet Planner view.',
    category: 'diet'
  };

  const mockTicket = {
    id: 'da70bc6c-1394-44e8-9898-e5d8236644aa',
    userId: 'user-1',
    subject: 'App lag issue',
    description: 'The app is responding slowly.',
    status: 'open',
    priority: 'medium',
    category: 'technical',
    satisfactionScore: null,
    satisfactionFeedback: null,
    whatsappHandoffRequested: false,
    slaBreached: false,
    slaExpiresAt: new Date(Date.now() - 3600 * 1000), // Expiried 1 hour ago
    createdAt: new Date(),
    save: async function() { return this; }
  };

  const mockModels = {
    Sequelize: {
      Op: {
        notIn: Symbol('notIn'),
        lt: Symbol('lt')
      }
    },
    SupportTicket: {
      findAll: async (options) => {
        return [mockTicket];
      },
      findOne: async (options) => {
        if (options.where?.id === mockTicket.id) return mockTicket;
        return null;
      },
      findByPk: async (id) => {
        if (id === mockTicket.id) return mockTicket;
        return null;
      }
    },
    SupportTicketMessage: {
      create: async (input) => {
        return { id: 'msg-100', ...input };
      }
    },
    CannedReply: {
      create: async (input) => {
        return { id: 'canned-100', ...input };
      },
      findAll: async () => {
        return [mockCanned];
      }
    },
    User: {
      findByPk: async (id) => {
        return { id, displayName: 'Jane Mother', centerId: 'center-1' };
      }
    }
  };

  const { SupportService } = await import('../src/modules/support/support.service.js');

  const runQuery = async (source, variables, viewer) => {
    const service = new SupportService(mockModels, {});
    return graphql({
      schema,
      source,
      variableValues: variables,
      contextValue: { viewer, models: mockModels, sequelize: { transaction: async (fn) => fn({}) }, supportService: service }
    });
  };

  const motherViewer = { id: 'user-1', role: { roleType: 'MOTHER' }, centerId: 'center-1' };
  const staffViewer = { id: 'staff-1', role: { roleType: 'STAFF' }, centerId: 'center-1' };

  // Test Case 1: Create custom canned reply template as staff
  const res1 = await runQuery(createCannedReplyMutation, {
    title: 'Diet Plan Query answer',
    content: 'Please refer to your Diet Planner view.',
    category: 'diet'
  }, staffViewer);
  assert.equal(res1.errors, undefined);
  assert.equal(res1.data.createCannedReply.title, 'Diet Plan Query answer');

  // Test Case 2: Fetch canned replies list
  const res2 = await runQuery(getCannedRepliesQuery, {}, staffViewer);
  assert.equal(res2.errors, undefined);
  assert.equal(res2.data.getCannedReplies.length, 1);
  assert.equal(res2.data.getCannedReplies[0].title, 'Diet Plan Query answer');

  // Test Case 3: Fetch active tickets queue in staff view
  const res3 = await runQuery(getStaffSupportTicketsQuery, { status: 'open' }, staffViewer);
  assert.equal(res3.errors, undefined);
  assert.equal(res3.data.getStaffSupportTickets.length, 1);
  assert.equal(res3.data.getStaffSupportTickets[0].subject, 'App lag issue');

  // Test Case 4: Add response message as support staff
  const res4 = await runQuery(addStaffSupportMessageMutation, {
    ticketId: mockTicket.id,
    message: 'Hello, please clear your mobile cache.'
  }, staffViewer);
  assert.equal(res4.errors, undefined);
  assert.equal(res4.data.addStaffSupportMessage.senderType, 'staff');
  assert.equal(mockTicket.status, 'pending'); // Auto transition to pending

  // Test Case 5: Update support ticket status manually
  const res5 = await runQuery(updateSupportTicketStatusMutation, {
    ticketId: mockTicket.id,
    status: 'resolved'
  }, staffViewer);
  assert.equal(res5.errors, undefined);
  assert.equal(res5.data.updateSupportTicketStatus.status, 'resolved');

  // Test Case 6: Run SLA escalations checker
  const res6 = await runQuery(checkSlaEscalationsMutation, {}, staffViewer);
  assert.equal(res6.errors, undefined);
  assert.equal(res6.data.checkSlaEscalations, true);
  assert.equal(mockTicket.slaBreached, true); // Auto flagged since slaExpiresAt is past and status is not resolved

  // Test Case 7: Fetch CSAT dashboard analytics metrics
  mockTicket.satisfactionScore = 4;
  mockTicket.satisfactionFeedback = 'Good response';
  mockTicket.status = 'resolved';

  const res7 = await runQuery(getSupportDashboardMetricsQuery, {}, staffViewer);
  assert.equal(res7.errors, undefined);
  assert.equal(res7.data.getSupportDashboardMetrics.totalTicketsCount, 1);
  assert.equal(res7.data.getSupportDashboardMetrics.resolvedTicketsCount, 1);
  assert.equal(res7.data.getSupportDashboardMetrics.slaBreachedCount, 1);
  assert.equal(res7.data.getSupportDashboardMetrics.averageSatisfactionScore, 4);
});
