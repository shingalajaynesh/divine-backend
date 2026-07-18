import test from 'node:test';
import assert from 'node:assert/strict';
import { graphql } from 'graphql';
import schema from '../src/gql/schema/index.js';

test('partner queries require authentication', async () => {
  const result = await graphql({
    schema,
    source: `
      query GetPartnerActivity {
        getPartnerActivity(dayNumber: 15) { title description }
      }
    `,
    contextValue: {},
  });
  assert.equal(result.errors?.[0]?.extensions?.code, 'UNAUTHENTICATED');
});

test('partner mutations require authentication', async () => {
  const result = await graphql({
    schema,
    source: `
      mutation AcknowledgePartner {
        acknowledgePartnerActivity(dayNumber: 15) { id partnerAcknowledged }
      }
    `,
    contextValue: {},
  });
  assert.equal(result.errors?.[0]?.extensions?.code, 'UNAUTHENTICATED');
});

test('acknowledgePartnerActivity rejects future day updates', async () => {
  const tenDaysAgo = new Date();
  tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
  const lmpDateStr = tenDaysAgo.toISOString().split('T')[0];

  const result = await graphql({
    schema,
    source: `
      mutation AcknowledgeFuture {
        acknowledgePartnerActivity(dayNumber: 25) { id partnerAcknowledged }
      }
    `,
    contextValue: {
      viewer: {
        id: 'mother-1',
        lmpDate: lmpDateStr,
        dueDate: null,
      },
      models: {},
      sequelize: {},
    },
  });

  assert.ok(result.errors);
  assert.match(result.errors[0].message, /Cannot complete partner activities for future days/);
});

test('acknowledgePartnerActivity toggles state and returns record', async () => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const lmpDateStr = thirtyDaysAgo.toISOString().split('T')[0];

  let findActivityCalled = false;
  let findLogCalled = false;
  let createLogCalled = false;

  const result = await graphql({
    schema,
    source: `
      mutation AcknowledgePast {
        acknowledgePartnerActivity(dayNumber: 10) {
          id
          dayNumber
          partnerActivityId
          activity { id dayNumber title }
          partnerAcknowledged
        }
      }
    `,
    contextValue: {
      viewer: {
        id: 'mother-1',
        lmpDate: lmpDateStr,
        dueDate: null,
      },
      models: {
        PartnerActivity: {
          findByPk: async (id) => {
            assert.equal(id, 'partner-act-10');
            return {
              id: 'partner-act-10',
              dayNumber: 10,
              title: 'Sample Title',
              description: 'Sample Description'
            };
          },
          findOne: async ({ where }) => {
            findActivityCalled = true;
            assert.equal(where.dayNumber, 10);
            return {
              id: 'partner-act-10',
              dayNumber: 10,
              titleEn: 'Sample Title'
            };
          }
        },
        PartnerActivityLog: {
          findOne: async ({ where }) => {
            findLogCalled = true;
            assert.equal(where.userId, 'mother-1');
            assert.equal(where.dayNumber, 10);
            return null; // Simulate first time logging
          },
          create: async (data) => {
            createLogCalled = true;
            assert.equal(data.userId, 'mother-1');
            assert.equal(data.partnerActivityId, 'partner-act-10');
            assert.equal(data.dayNumber, 10);
            assert.equal(data.partnerAcknowledged, true);
            return {
              id: 'log-10',
              userId: 'mother-1',
              partnerActivityId: 'partner-act-10',
              dayNumber: 10,
              partnerAcknowledged: true,
              completedAt: new Date()
            };
          }
        }
      },
      sequelize: {
        transaction: async (cb) => cb({ LOCK: { UPDATE: 'UPDATE' } })
      },
    },
  });

  assert.equal(result.errors, undefined);
  assert.equal(findActivityCalled, true);
  assert.equal(findLogCalled, true);
  assert.equal(createLogCalled, true);
  assert.equal(result.data.acknowledgePartnerActivity.partnerAcknowledged, true);
  assert.equal(result.data.acknowledgePartnerActivity.partnerActivityId, 'partner-act-10');
  assert.equal(result.data.acknowledgePartnerActivity.activity.id, 'partner-act-10');
});
