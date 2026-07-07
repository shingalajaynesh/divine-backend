import assert from 'node:assert/strict';
import test from 'node:test';
import { graphql } from 'graphql';
import schema from '../src/gql/schema/index.js';

test('Advanced CMS operations for updating, translation sync, and deleting content items work successfully', async () => {
  const createMutation = `
    mutation CreateContentItem($input: CreateContentItemInput!) {
      createContentItem(input: $input) {
        id
        slug
        contentType
        status
        visibility
        translations {
          language
          title
          body
        }
      }
    }
  `;

  const updateMutation = `
    mutation UpdateContentItem($id: ID!, $input: UpdateContentItemInput!) {
      updateContentItem(id: $id, input: $input) {
        id
        slug
        visibility
        trimester1Safe
        trimester2Safe
        contraindications
        translations {
          language
          title
          summary
          body
        }
      }
    }
  `;

  const deleteMutation = `
    mutation DeleteContentItem($id: ID!) {
      deleteContentItem(id: $id)
    }
  `;

  // In-memory mock database store
  let mockContentItem = null;
  const mockTranslations = [];

  const mockModels = {
    ContentItem: {
      create: async (input) => {
        mockContentItem = {
          id: 'item-100',
          centerId: 'center-100',
          categoryId: null,
          coverAssetId: null,
          slug: input.slug,
          contentType: input.contentType,
          visibility: input.visibility || 'free',
          status: 'draft',
          trimester1Safe: true,
          trimester2Safe: true,
          trimester3Safe: true,
          contraindications: null,
          medicalReviewed: false,
          save: async () => {},
          reload: async () => mockContentItem,
          update: async (updates) => {
            Object.assign(mockContentItem, updates);
            return mockContentItem;
          },
          destroy: async () => {
            mockContentItem = null;
            return 1;
          },
          translations: mockTranslations
        };
        return mockContentItem;
      },
      findOne: async () => mockContentItem,
      sequelize: {
        transaction: async (fn) => fn({})
      }
    },
    ContentTranslation: {
      bulkCreate: async (records) => {
        mockTranslations.push(...records.map(r => ({ ...r, id: 'trans-' + Math.random() })));
        return mockTranslations;
      },
      findOne: async ({ where }) => {
        return mockTranslations.find(t => t.contentItemId === where.contentItemId && t.language === where.language);
      },
      create: async (record) => {
        const trans = { ...record, id: 'trans-' + Math.random(), update: async (updates) => Object.assign(trans, updates) };
        mockTranslations.push(trans);
        return trans;
      }
    },
    ContentCategory: {
      findOne: async () => null
    },
    MediaAsset: {
      findOne: async () => null
    }
  };

  const viewer = { id: 'staff-1', role: { roleType: 'STAFF' }, centerId: 'center-100' };

  const { ContentCmsManager } = await import('../src/gql/models/contentCmsManager.js');
  const contentCmsManager = new ContentCmsManager(mockModels, viewer, {});

  // 1. Create a draft with English translation
  const createResult = await graphql({
    schema,
    source: createMutation,
    variableValues: {
      input: {
        slug: 'advanced-swadhyaya',
        contentType: 'meditation',
        visibility: 'premium',
        translations: [
          { language: 'en', title: 'Advanced Swadhyaya Meditation', body: 'Practice quiet swadhyaya.' }
        ]
      }
    },
    contextValue: { viewer, models: mockModels, sequelize: {}, contentCmsManager }
  });

  assert.equal(createResult.errors, undefined);
  const created = createResult.data.createContentItem;
  assert.equal(created.slug, 'advanced-swadhyaya');
  assert.equal(created.contentType, 'meditation');
  assert.equal(created.visibility, 'premium');

  // 2. Update metadata + add/upsert Hindi translation
  const updateResult = await graphql({
    schema,
    source: updateMutation,
    variableValues: {
      id: created.id,
      input: {
        slug: 'advanced-swadhyaya-v2',
        trimester1Safe: false,
        trimester2Safe: true,
        contraindications: 'Do not practice in first trimester if experiencing cramping.',
        translations: [
          { language: 'hi', title: 'उन्नत स्वाध्याय ध्यान', summary: 'संक्षिप्त विवरण', body: 'शांत स्वाध्याय का अभ्यास करें।' }
        ]
      }
    },
    contextValue: { viewer, models: mockModels, sequelize: {}, contentCmsManager }
  });

  assert.equal(updateResult.errors, undefined);
  const updated = updateResult.data.updateContentItem;
  assert.equal(updated.slug, 'advanced-swadhyaya-v2');
  assert.equal(updated.trimester1Safe, false);
  assert.equal(updated.contraindications, 'Do not practice in first trimester if experiencing cramping.');
  
  // Verify that translation array holds both languages
  const hiTrans = updated.translations.find(t => t.language === 'hi');
  assert.ok(hiTrans);
  assert.equal(hiTrans.title, 'उन्नत स्वाध्याय ध्यान');

  // 3. Delete the content item
  const deleteResult = await graphql({
    schema,
    source: deleteMutation,
    variableValues: { id: created.id },
    contextValue: { viewer, models: mockModels, sequelize: {}, contentCmsManager }
  });

  assert.equal(deleteResult.errors, undefined);
  assert.equal(deleteResult.data.deleteContentItem, true);
});
