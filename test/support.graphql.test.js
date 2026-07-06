import assert from 'node:assert/strict';
import test from 'node:test';
import { graphql } from 'graphql';
import schema from '../src/gql/schema/index.js';
import { SupportService } from '../src/modules/support/support.service.js';

const VALID_USER_ID = 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a99';
const VALID_TICKET_ID = 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380e22';

test('support queries require authentication', async () => {
  const query = '{ getSupportTickets { id subject } }';
  const result = await graphql({ schema, source: query, contextValue: {} });
  assert.equal(result.errors?.[0]?.extensions?.code, 'UNAUTHENTICATED');
});

test('SupportService creates tickets, computes SLA, records messages and scores', async () => {
  let createdTicket = null;
  let initialMessage = null;
  let replyMessage = null;
  let ticketStatus = 'open';
  let ratingScore = null;
  let ratingFeedback = null;
  let whatsappTriggered = false;

  const mockTransaction = async (callback) => callback({});

  const models = {
    SupportTicket: {
      create: async (input) => {
        createdTicket = input;
        return { id: VALID_TICKET_ID, ...input };
      },
      findOne: async () => {
        return {
          id: VALID_TICKET_ID,
          status: ticketStatus,
          whatsappHandoffRequested: whatsappTriggered,
          save: function() {
            ticketStatus = this.status;
            whatsappTriggered = this.whatsappHandoffRequested;
            ratingScore = this.satisfactionScore;
            ratingFeedback = this.satisfactionFeedback;
          }
        };
      }
    },
    SupportTicketMessage: {
      create: async (input) => {
        if (!initialMessage) initialMessage = input;
        else replyMessage = input;
        return { id: 'msg-1', ...input };
      }
    }
  };

  const service = new SupportService(models, { transaction: mockTransaction });

  // 1. Create High priority ticket (should trigger 4h SLA expires)
  const ticket = await service.createTicket(VALID_USER_ID, {
    subject: 'Video Stream Error',
    description: 'My video buffer fails continuously',
    priority: 'high',
    category: 'technical'
  });

  assert.equal(createdTicket.subject, 'Video Stream Error');
  assert.equal(createdTicket.priority, 'high');
  
  // Verify SLA expires at roughly 4 hours
  const hoursDiff = (createdTicket.slaExpiresAt - new Date()) / (1000 * 60 * 60);
  assert.ok(hoursDiff > 3.9 && hoursDiff < 4.1);
  assert.equal(initialMessage.message, 'My video buffer fails continuously');

  // 2. Add reply
  ticketStatus = 'pending';
  await service.addMessage(VALID_USER_ID, {
    ticketId: VALID_TICKET_ID,
    message: 'Still experiencing buffering issues'
  }, 'user');

  assert.equal(replyMessage.message, 'Still experiencing buffering issues');
  assert.equal(ticketStatus, 'open'); // Re-opened by user reply

  // 3. Trigger WhatsApp handoff
  await service.requestWhatsappHandoff(VALID_USER_ID, VALID_TICKET_ID);
  assert.equal(whatsappTriggered, true);

  // 4. Resolve & log CSAT score
  await service.closeTicket(VALID_USER_ID, {
    ticketId: VALID_TICKET_ID,
    satisfactionScore: 5,
    satisfactionFeedback: 'Very helpful team'
  });
  assert.equal(ticketStatus, 'resolved');
  assert.equal(ratingScore, 5);
  assert.equal(ratingFeedback, 'Very helpful team');
});
