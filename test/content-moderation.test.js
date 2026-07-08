import assert from 'node:assert/strict';
import test from 'node:test';
import { graphql } from 'graphql';
import schema from '../src/gql/schema/index.js';

test('Publishing lifecycle workflow and medical moderation enforcement', async () => {
  const createMutation = `
    mutation CreateContentItem($input: CreateContentItemInput!) {
      createContentItem(input: $input) {
        id slug contentType status visibility translations { language title }
      }
    }
  `;

  const submitMutation = `
    mutation SubmitForReview($id: ID!) {
      submitForReview(id: $id) {
        id status
      }
    }
  `;

  const approveMutation = `
    mutation ApproveMedicalContent($id: ID!, $feedback: String) {
      approveMedicalContent(id: $id, feedback: $feedback) {
        id status medicalReviewed reviewedBy feedback
      }
    }
  `;

  const flagMutation = `
    mutation FlagMedicalContent($id: ID!, $feedback: String) {
      flagMedicalContent(id: $id, feedback: $feedback) {
        id status medicalReviewed reviewedBy feedback
      }
    }
  `;

  const publishMutation = `
    mutation PublishContentItem($id: ID!) {
      publishContentItem(id: $id) {
        id status
      }
    }
  `;

  // In-memory mock database store
  let mockContentItem = null;
  const mockTranslations = [];

  const mockModels = {
    ContentItem: {
      create: async (input) => {
        mockContentItem = {
          id: 'item-28',
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
          reviewedBy: null,
          feedback: null,
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
    ContentCategory: { findOne: async () => null },
    MediaAsset: { findOne: async () => null }
  };

  const staffViewer = { id: 'staff-1', role: { roleType: 'STAFF' }, centerId: 'center-100' };
  const adminViewer = { id: 'admin-1', role: { roleType: 'ADMIN' }, centerId: 'center-100' };
  const motherViewer = { id: 'mother-1', role: { roleType: 'MOTHER' }, centerId: 'center-100' };

  const { ContentCmsManager } = await import('../src/gql/models/contentCmsManager.js');

  // Helper to execute GraphQL mutations
  const runMutation = async (source, variables, viewer = staffViewer) => {
    const manager = new ContentCmsManager(mockModels, viewer, {});
    return graphql({
      schema,
      source,
      variableValues: variables,
      contextValue: { viewer, models: mockModels, sequelize: {}, contentCmsManager: manager }
    });
  };

  // 1. Create a draft content item
  const createRes = await runMutation(createMutation, {
    input: {
      slug: 'prenatal-breathwork',
      contentType: 'yoga',
      visibility: 'free',
      translations: [{ language: 'en', title: 'Prenatal Breathwork 101', body: 'Breath work details' }]
    }
  });
  assert.equal(createRes.errors, undefined);
  const item = createRes.data.createContentItem;
  assert.equal(item.status, 'draft');

  // 2. Try to publish immediately (should fail because not approved yet)
  const publishFailRes = await runMutation(publishMutation, { id: item.id }, adminViewer);
  assert.ok(publishFailRes.errors && publishFailRes.errors.length > 0);
  assert.match(publishFailRes.errors[0].message, /Only approved content items can be published/);

  // 3. Try to approve a draft directly without submitting for review (should fail)
  const approveFailRes = await runMutation(approveMutation, { id: item.id, feedback: 'Instant' });
  assert.ok(approveFailRes.errors && approveFailRes.errors.length > 0);
  assert.match(approveFailRes.errors[0].message, /Only content items under review can be approved/);

  // 4. Submit for review
  const submitRes = await runMutation(submitMutation, { id: item.id });
  assert.equal(submitRes.errors, undefined);
  assert.equal(submitRes.data.submitForReview.status, 'review');

  // 5. Try to approve using an unauthorized MOTHER role (should fail)
  const approveUnauthorizedRes = await runMutation(approveMutation, { id: item.id, feedback: 'Mother attempt' }, motherViewer);
  assert.ok(approveUnauthorizedRes.errors && approveUnauthorizedRes.errors.length > 0);
  assert.match(approveUnauthorizedRes.errors[0].message, /You do not have permission to perform this action/);

  // 6. Approve using clinical staff
  const approveRes = await runMutation(approveMutation, { id: item.id, feedback: 'Verified safe for all trimesters' });
  assert.equal(approveRes.errors, undefined);
  const approvedItem = approveRes.data.approveMedicalContent;
  assert.equal(approvedItem.status, 'approved');
  assert.equal(approvedItem.medicalReviewed, true);
  assert.equal(approvedItem.reviewedBy, 'staff-1');
  assert.equal(approvedItem.feedback, 'Verified safe for all trimesters');

  // 7. Publish approved item using Admin
  const publishSuccessRes = await runMutation(publishMutation, { id: item.id }, adminViewer);
  assert.equal(publishSuccessRes.errors, undefined);
  assert.equal(publishSuccessRes.data.publishContentItem.status, 'published');

  // 8. Test Flag/Reject transition: reset to draft and review=false
  // Let's manually set status back to 'review' to test flagging
  mockContentItem.status = 'review';
  const flagRes = await runMutation(flagMutation, { id: item.id, feedback: 'Missing Gujarati translation' });
  assert.equal(flagRes.errors, undefined);
  const flaggedItem = flagRes.data.flagMedicalContent;
  assert.equal(flaggedItem.status, 'draft');
  assert.equal(flaggedItem.medicalReviewed, false);
  assert.equal(flaggedItem.feedback, 'Missing Gujarati translation');
});
