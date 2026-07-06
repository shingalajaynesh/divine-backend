import assert from 'node:assert/strict';
import test from 'node:test';
import { graphql } from 'graphql';
import schema from '../src/gql/schema/index.js';
import { ContentCmsManager } from '../src/gql/models/contentCmsManager.js';

const ADMIN_USER_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a00';
const MEMBER_USER_ID = 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a99';
const CONTENT_ITEM_ID = 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c11';

test('medical review content filters and admin approvals', async () => {
  let contentUpdated = null;
  let feedWhere = null;

  const mockTransaction = async (callback) => callback({});

  const models = {
    ProgramEnrollment: { count: async () => 0 },
    ContentBookmark: { count: async () => 0 },
    ContentItem: {
      findOne: async ({ where }) => {
        if (where.id === CONTENT_ITEM_ID) {
          return {
            id: CONTENT_ITEM_ID,
            status: 'draft',
            medicalReviewed: false,
            translations: [{ id: 't1', language: 'en', title: 'Healthy Diet Guide' }],
            update: async function(changes) {
              contentUpdated = changes;
            },
            reload: async function() {
              return this;
            }
          };
        }
        return null;
      },
      findAll: async ({ where }) => {
        feedWhere = where;
        // Mock returning reviewed content
        if (where.medicalReviewed === true) {
          return [
            {
              id: CONTENT_ITEM_ID,
              status: 'published',
              medicalReviewed: true,
              translations: [{ id: 't1', language: 'en', title: 'Healthy Diet Guide' }]
            }
          ];
        }
        return [];
      }
    }
  };

  const manager = new ContentCmsManager(
    models,
    { id: ADMIN_USER_ID, role: { roleType: 'ADMIN' } },
    { transaction: mockTransaction }
  );

  // 1. Staff reviews article
  await manager.review(CONTENT_ITEM_ID, true);
  assert.equal(contentUpdated.medicalReviewed, true);

  // 2. Member retrieves feed (should filter by medicalReviewed: true)
  const memberManager = new ContentCmsManager(
    models,
    { id: MEMBER_USER_ID, role: { roleType: 'MOTHER' } },
    { transaction: mockTransaction }
  );

  const feed = await memberManager.getFeed({ language: 'en' });
  assert.equal(feedWhere.medicalReviewed, true);
  assert.equal(feed[0].id, CONTENT_ITEM_ID);
});
