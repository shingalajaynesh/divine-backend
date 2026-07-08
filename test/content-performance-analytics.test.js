import assert from 'node:assert/strict';
import test from 'node:test';
import { graphql } from 'graphql';
import schema from '../src/gql/schema/index.js';

test('Content performance analytics queries and aggregation correctness', async () => {
  const analyticsQuery = `
    query GetContentPerformanceAnalytics {
      getContentPerformanceAnalytics {
        id
        slug
        contentType
        title
        totalViews
        uniqueViewers
        completionCount
        completionRate
        saveCount
        avgProgress
        dropOffRate
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
      translations: [{ id: 't-1', language: 'en', title: 'Five comfortable breaths' }]
    },
    {
      id: 'item-message',
      slug: 'one-kind-message',
      contentType: 'affirmation',
      visibility: 'free',
      status: 'published',
      medicalReviewed: true,
      translations: [{ id: 't-2', language: 'en', title: 'One kind message' }]
    }
  ];

  // Mock engagement histories and saves
  const mockViewLogs = [
    // item-breaths views
    { userId: 'user-1', contentItemId: 'item-breaths', viewCount: 2, progressPercent: 100, completed: true },
    { userId: 'user-2', contentItemId: 'item-breaths', viewCount: 1, progressPercent: 40, completed: false },
    // item-message views
    { userId: 'user-1', contentItemId: 'item-message', viewCount: 5, progressPercent: 100, completed: true }
  ];

  const mockBookmarks = [
    { userId: 'user-2', contentItemId: 'item-breaths', kind: 'bookmark' },
    { userId: 'user-3', contentItemId: 'item-breaths', kind: 'watch_later' }
  ];

  const mockModels = {
    ContentItem: {
      findAll: async () => {
        return mockContentItems.map(item => ({
          ...item,
          translations: item.translations,
          reload: async () => item
        }));
      }
    },
    ContentViewHistory: {
      findAll: async (options) => {
        const { contentItemId } = options.where;
        return mockViewLogs.filter(log => log.contentItemId === contentItemId);
      }
    },
    ContentBookmark: {
      count: async (options) => {
        const { contentItemId } = options.where;
        return mockBookmarks.filter(b => b.contentItemId === contentItemId).length;
      }
    }
  };

  const { ContentCmsManager } = await import('../src/gql/models/contentCmsManager.js');

  const runQuery = async (source, viewer) => {
    const manager = new ContentCmsManager(mockModels, viewer, {});
    return graphql({
      schema,
      source,
      contextValue: { viewer, models: mockModels, sequelize: {}, contentCmsManager: manager }
    });
  };

  // Test Case 1: Restricts access to non-staff users (MOTHER role)
  const motherViewer = { id: 'mother-1', role: { roleType: 'MOTHER' } };
  const res1 = await runQuery(analyticsQuery, motherViewer);
  assert.ok(res1.errors && res1.errors.length > 0);
  assert.equal(res1.errors[0].message, 'You do not have permission to perform this action.');

  // Test Case 2: Allows access for STAFF role and returns correct aggregations
  const staffViewer = { id: 'staff-1', role: { roleType: 'STAFF' } };
  const res2 = await runQuery(analyticsQuery, staffViewer);
  assert.equal(res2.errors, undefined);
  const reports = res2.data.getContentPerformanceAnalytics;
  
  assert.equal(reports.length, 2);

  // Assert item-message performance
  // Views logs: 1 user, 5 views, 100% completion rate
  const messageReport = reports.find(r => r.id === 'item-message');
  assert.ok(messageReport);
  assert.equal(messageReport.totalViews, 5);
  assert.equal(messageReport.uniqueViewers, 1);
  assert.equal(messageReport.completionCount, 1);
  assert.equal(messageReport.completionRate, 100);
  assert.equal(messageReport.avgProgress, 100);
  assert.equal(messageReport.dropOffRate, 0);
  assert.equal(messageReport.saveCount, 0);

  // Assert item-breaths performance
  // View logs: user-1 (2 views, 100% comp), user-2 (1 view, 40% inc)
  // totalViews = 3, uniqueViewers = 2, completionCount = 1
  // completionRate = 50%, avgProgress = 70% (140 / 2)
  // dropOffRate = 50%, saveCount = 2
  const breathsReport = reports.find(r => r.id === 'item-breaths');
  assert.ok(breathsReport);
  assert.equal(breathsReport.totalViews, 3);
  assert.equal(breathsReport.uniqueViewers, 2);
  assert.equal(breathsReport.completionCount, 1);
  assert.equal(breathsReport.completionRate, 50);
  assert.equal(breathsReport.avgProgress, 70);
  assert.equal(breathsReport.dropOffRate, 50);
  assert.equal(breathsReport.saveCount, 2);

  // Assert order by views count descending (5 views first, then 3 views)
  assert.equal(reports[0].id, 'item-message');
  assert.equal(reports[1].id, 'item-breaths');
});
