import test from 'node:test';
import assert from 'node:assert/strict';
import { graphql } from 'graphql';
import schema from '../src/gql/schema/index.js';

test('partner dashboard queries require PARTNER role', async () => {
  const result = await graphql({
    schema,
    source: `
      query GetPartnerDashboard {
        getPartnerDashboard {
          motherName
          pregnancyDay
          currentWeek
        }
      }
    `,
    contextValue: {
      viewer: {
        id: 'mother-1',
        role: { roleType: 'MOTHER' }
      }
    }
  });

  assert.ok(result.errors);
  assert.equal(result.errors[0].extensions?.code, 'FORBIDDEN');
});

test('linkPartner links a new partner email successfully', async () => {
  let partnerCreated = false;
  let viewerSaved = false;

  const result = await graphql({
    schema,
    source: `
      mutation LinkPartner {
        linkPartner(partnerEmail: "partner@example.com") {
          id
          partner {
            id
            emailAddress
          }
        }
      }
    `,
    contextValue: {
      viewer: {
        id: 'mother-1',
        emailAddress: 'mother@example.com',
        role: { roleType: 'MOTHER' },
        centerId: 'center-123',
        save: async () => { viewerSaved = true; }
      },
      models: {
        Role: {
          findOne: async () => ({ id: 'role-partner-uuid', roleType: 'PARTNER' })
        },
        User: {
          findOne: async ({ where }) => {
            assert.equal(where.emailAddress, 'partner@example.com');
            return null; // Simulate partner not yet registered
          },
          create: async (data) => {
            partnerCreated = true;
            assert.equal(data.emailAddress, 'partner@example.com');
            assert.equal(data.roleId, 'role-partner-uuid');
            return {
              id: 'partner-new-id',
              emailAddress: 'partner@example.com',
              partnerId: 'mother-1',
              save: async () => {}
            };
          },
          findByPk: async (id) => {
            assert.equal(id, 'partner-new-id');
            return {
              id: 'partner-new-id',
              emailAddress: 'partner@example.com'
            };
          }
        }
      }
    }
  });

  assert.equal(result.errors, undefined);
  assert.ok(partnerCreated);
  assert.ok(viewerSaved);
  assert.equal(result.data.linkPartner.partner.emailAddress, 'partner@example.com');
});

test('getPartnerDashboard returns mother details & progress', async () => {
  const tenDaysAgo = new Date();
  tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
  const lmpDateStr = tenDaysAgo.toISOString().split('T')[0];

  const result = await graphql({
    schema,
    source: `
      query GetDashboard {
        getPartnerDashboard {
          motherName
          pregnancyDay
          currentWeek
          currentTrimester
          progressPercent
          partnerActivityTitle
          partnerActivityCompleted
        }
      }
    `,
    contextValue: {
      viewer: {
        id: 'partner-1',
        role: { roleType: 'PARTNER' },
        partnerId: 'mother-1',
        language: 'en'
      },
      models: {
        User: {
          findByPk: async (id) => {
            assert.equal(id, 'mother-1');
            return {
              id: 'mother-1',
              displayName: 'Rita Sen',
              lmpDate: lmpDateStr,
              dueDate: null
            };
          }
        },
        BabyDevelopment: {
          findOne: async () => ({ sizeEn: 'Sweet Pea', milestoneEn: 'Growing' })
        },
        DailyProgress: {
          findOne: async () => ({ progressPercent: 65, completedCount: 3, days: [] })
        },
        QuizAttempt: {
          findOne: async () => null
        },
        PartnerActivity: {
          findOne: async ({ where }) => {
            return { id: 'act-1', dayNumber: where.dayNumber, titleEn: 'Story Time', descriptionEn: 'Read a story' }
          }
        },
        PartnerActivityLog: {
          findOne: async () => ({ partnerAcknowledged: true })
        }
      },
      sequelize: {
        transaction: async (cb) => cb({ LOCK: { UPDATE: 'UPDATE' } })
      }
    }
  });

  assert.equal(result.errors, undefined);
  const data = result.data.getPartnerDashboard;
  assert.equal(data.motherName, 'Rita Sen');
  assert.ok(data.pregnancyDay === 11 || data.pregnancyDay === 12);
  assert.equal(data.progressPercent, 65);
  assert.equal(data.partnerActivityTitle, 'Story Time');
  assert.equal(data.partnerActivityCompleted, true);
});

test('sendEncouragement posts in-app notification to linked mother', async () => {
  let notificationCreated = false;

  const result = await graphql({
    schema,
    source: `
      mutation SendEncourage {
        sendEncouragement(message: "You are doing great, keep going!")
      }
    `,
    contextValue: {
      viewer: {
        id: 'partner-1',
        role: { roleType: 'PARTNER' },
        partnerId: 'mother-1',
        centerId: 'center-1',
        displayName: 'Amit Sen'
      },
      models: {
        Notification: {
          create: async (data) => {
            notificationCreated = true;
            assert.equal(data.userId, 'mother-1');
            assert.equal(data.kind, 'partner_encouragement');
            assert.equal(data.body, 'You are doing great, keep going!');
            assert.equal(data.title, 'Message from Amit Sen');
            return { id: 'notif-1' };
          }
        }
      }
    }
  });

  assert.equal(result.errors, undefined);
  assert.ok(result.data.sendEncouragement);
  assert.ok(notificationCreated);
});
