import assert from 'node:assert/strict';
import test from 'node:test';
import { graphql } from 'graphql';
import schema from '../src/gql/schema/index.js';

test('Personalized content recommendations and learning paths progress calculation', async () => {
  const recommendationsQuery = `
    query GetRecommendedContentFeed($language: String, $limit: Int) {
      recommendedContentFeed(language: $language, limit: $limit) {
        id slug contentType completed
        category { slug name }
        translations { language title }
      }
    }
  `;

  const learningPathsQuery = `
    query GetMyLearningPaths($language: String) {
      myLearningPaths(language: $language) {
        id title description icon progressPercent
        items {
          id slug completed
        }
      }
    }
  `;

  // Define some mock content items
  const mockContentItems = [
    {
      id: 'item-breaths',
      slug: 'five-comfortable-breaths',
      contentType: 'meditation',
      visibility: 'free',
      status: 'published',
      medicalReviewed: true,
      trimester1Safe: true,
      trimester2Safe: true,
      trimester3Safe: true,
      sortOrder: 1,
      category: { id: 'cat-mind', slug: 'mindfulness', name: 'Mindfulness' },
      translations: [{ id: 't-1', language: 'en', title: 'Five comfortable breaths' }]
    },
    {
      id: 'item-message',
      slug: 'one-kind-message',
      contentType: 'affirmation',
      visibility: 'free',
      status: 'published',
      medicalReviewed: true,
      trimester1Safe: true,
      trimester2Safe: true,
      trimester3Safe: true,
      sortOrder: 2,
      category: { id: 'cat-bond', slug: 'bonding', name: 'Baby Bonding' },
      translations: [{ id: 't-2', language: 'en', title: 'One kind message' }]
    },
    {
      id: 'item-yoga2',
      slug: 't2-yoga',
      contentType: 'yoga',
      visibility: 'free',
      status: 'published',
      medicalReviewed: true,
      trimester1Safe: false,
      trimester2Safe: true,
      trimester3Safe: false,
      sortOrder: 3,
      category: { id: 'cat-yoga', slug: 'yoga', name: 'Prenatal Yoga' },
      translations: [{ id: 't-3', language: 'en', title: 'Trimester 2 Yoga Flow' }]
    }
  ];

  // In-memory mock database store
  let mockVitals = null;
  const mockViewHistory = [];

  const mockModels = {
    ContentItem: {
      findAll: async (options) => {
        let results = [...mockContentItems];

        // Apply where filters if specified
        if (options?.where) {
          const w = options.where;
          if (w.status) {
            results = results.filter(item => item.status === w.status);
          }
          if (w.medicalReviewed !== undefined) {
            results = results.filter(item => item.medicalReviewed === w.medicalReviewed);
          }
          if (w.trimester1Safe) {
            results = results.filter(item => item.trimester1Safe === true);
          }
          if (w.trimester2Safe) {
            results = results.filter(item => item.trimester2Safe === true);
          }
          if (w.trimester3Safe) {
            results = results.filter(item => item.trimester3Safe === true);
          }
          if (w.slug && w.slug.length) {
            results = results.filter(item => w.slug.includes(item.slug));
          }
          if (w.id && w.id[Symbol.for('notIn')]) {
            const notInList = w.id[Symbol.for('notIn')];
            results = results.filter(item => !notInList.includes(item.id));
          }
        }

        return results.map(item => ({
          ...item,
          translations: item.translations,
          // support Sequelize-like include getter
          category: item.category,
          reload: async () => item
        }));
      }
    },
    VitalsLog: {
      findOne: async () => mockVitals
    },
    ContentViewHistory: {
      findAll: async () => mockViewHistory,
      findOne: async (options) => {
        const { userId, contentItemId } = options.where;
        return mockViewHistory.find(h => h.userId === userId && h.contentItemId === contentItemId);
      }
    }
  };

  // Helper helper to calculate pregnancy stats
  // Let's set user dates to be in Trimester 2
  // Pregnancy length is 280 days. LMP to today is 100 days -> Trimester 2.
  const today = new Date();
  const lmpDate = new Date(today.getTime() - 100 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const dueDate = new Date(today.getTime() + 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const viewer = { id: 'mother-7', role: { roleType: 'MOTHER' }, centerId: 'center-100', lmpDate, dueDate };

  const { ContentCmsManager } = await import('../src/gql/models/contentCmsManager.js');

  const runQuery = async (source, variables) => {
    const manager = new ContentCmsManager(mockModels, viewer, {});
    return graphql({
      schema,
      source,
      variableValues: variables,
      contextValue: { viewer, models: mockModels, sequelize: {}, contentCmsManager: manager }
    });
  };

  // Test Case 1: Trimester-safe recommendations (Trimester 2 includes T2-only yoga and T2-safe items)
  const res1 = await runQuery(recommendationsQuery, { language: 'en', limit: 5 });
  assert.equal(res1.errors, undefined);
  const items1 = res1.data.recommendedContentFeed;
  assert.equal(items1.length, 3); // All 3 mock items are Trimester 2 safe

  // Test Case 2: Excludes completed items
  // Mark 'five-comfortable-breaths' (id: 'item-breaths') as completed in view history
  mockViewHistory.push({ userId: 'mother-7', contentItemId: 'item-breaths', completed: true });
  const res2 = await runQuery(recommendationsQuery, { language: 'en', limit: 5 });
  assert.equal(res2.errors, undefined);
  const items2 = res2.data.recommendedContentFeed;
  assert.equal(items2.length, 2);
  assert.ok(!items2.find(item => item.id === 'item-breaths'));

  // Test Case 3: Symptom adaptation prioritization
  // Let's reset mock history and vitals logs. Add vitals log with Insomnia symptom
  mockViewHistory.length = 0;
  mockVitals = {
    userId: 'mother-7',
    loggedAt: new Date(),
    symptoms: JSON.stringify(['Insomnia']),
    mood: 'HAPPY'
  };
  const res3 = await runQuery(recommendationsQuery, { language: 'en', limit: 5 });
  assert.equal(res3.errors, undefined);
  const items3 = res3.data.recommendedContentFeed;
  // Because Insomnia symptom is active, 'mindfulness' category items should be sorted first.
  // 'five-comfortable-breaths' (category: mindfulness) should precede 'one-kind-message' (category: bonding) and 't2-yoga' (category: yoga)
  assert.equal(items3[0].id, 'item-breaths');

  // Test Case 4: Learning paths progress calculations
  // No completed items -> 0% progress
  const pathRes1 = await runQuery(learningPathsQuery, { language: 'en' });
  assert.equal(pathRes1.errors, undefined);
  const paths1 = pathRes1.data.myLearningPaths;
  assert.equal(paths1.length, 1);
  assert.equal(paths1[0].progressPercent, 0);

  // Complete 1 out of 2 items in the path: 'five-comfortable-breaths' (id: 'item-breaths')
  mockViewHistory.push({ userId: 'mother-7', contentItemId: 'item-breaths', completed: true });
  const pathRes2 = await runQuery(learningPathsQuery, { language: 'en' });
  assert.equal(pathRes2.errors, undefined);
  const paths2 = pathRes2.data.myLearningPaths;
  // 1 out of 2 items is completed, so progress should be 50%
  assert.equal(paths2[0].progressPercent, 50);
  assert.equal(paths2[0].items[0].completed, true);
  assert.equal(paths2[0].items[1].completed, false);
});
