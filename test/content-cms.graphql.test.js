import assert from 'node:assert/strict';
import test from 'node:test';
import { graphql } from 'graphql';
import schema from '../src/gql/schema/index.js';
import { ContentCmsManager } from '../src/gql/models/contentCmsManager.js';

test('content feed requires authentication', async () => {
  const result = await graphql({ schema, source: '{ contentFeed { id slug } }', contextValue: {} });
  assert.equal(result.errors?.[0]?.extensions?.code, 'UNAUTHENTICATED');
});

test('mother accounts cannot access staff content management', async () => {
  const result = await graphql({
    schema,
    source: '{ manageContent { id slug } }',
    contextValue: { viewer: { id: 'mother-1', role: { roleType: 'MOTHER' } }, contentCmsManager: { manage: async () => [] } },
  });
  assert.equal(result.errors?.[0]?.extensions?.code, 'FORBIDDEN');
});

test('content creation derives center and author from the verified staff viewer', async () => {
  let createdItem;
  let translations;
  const item = { id: 'content-1', reload: async () => item };
  const models = {
    ContentItem: {
      sequelize: { transaction: async (work) => work({ id: 'tx' }) },
      create: async (input) => { createdItem = input; return item; },
    },
    ContentTranslation: { bulkCreate: async (input) => { translations = input; } },
    ContentCategory: {}, MediaAsset: {},
  };
  const manager = new ContentCmsManager(models, { id: 'staff-verified', centerId: 'center-verified' }, { info() {}, error() {} });
  await manager.create({ slug: 'evening-calm', contentType: 'meditation', visibility: 'free', translations: [{ language: 'en', title: 'Evening calm' }] });
  assert.equal(createdItem.centerId, 'center-verified');
  assert.equal(createdItem.createdBy, 'staff-verified');
  assert.equal(createdItem.updatedBy, 'staff-verified');
  assert.equal(createdItem.status, 'draft');
  assert.equal(translations[0].contentItemId, 'content-1');
});

test('only administrators can publish content', async () => {
  const mutation = 'mutation { publishContentItem(id: "content-1") { id status } }';
  const staffResult = await graphql({ schema, source: mutation, contextValue: { viewer: { id: 'staff-1', role: { roleType: 'STAFF' } }, contentCmsManager: { publish: async () => ({ id: 'content-1', status: 'published' }) } } });
  assert.equal(staffResult.errors?.[0]?.extensions?.code, 'FORBIDDEN');
  const adminResult = await graphql({ schema, source: mutation, contextValue: { viewer: { id: 'admin-1', role: { roleType: 'ADMIN' } }, contentCmsManager: { publish: async () => ({ id: 'content-1', status: 'published' }) } } });
  assert.equal(adminResult.errors, undefined);
  assert.equal(adminResult.data.publishContentItem.status, 'published');
});

test('media registration accepts HTTPS and derives ownership from the verified viewer', async () => {
  let createdMedia;
  const manager = new ContentCmsManager({
    MediaAsset: { create: async (input) => { createdMedia = input; return input; } },
  }, { id: 'staff-verified', centerId: 'center-verified' }, { info() {}, error() {} });

  await manager.registerMedia({
    kind: 'audio',
    url: 'https://cdn.example.com/calm.mp3',
    mimeType: 'audio/mpeg',
    sizeBytes: 2048,
  });

  assert.equal(createdMedia.ownerId, 'staff-verified');
  assert.equal(createdMedia.centerId, 'center-verified');
  assert.match(createdMedia.storageKey, /^external\/center-verified\/[0-9a-f-]{36}$/);
  assert.equal(createdMedia.status, 'ready');
  assert.deepEqual(createdMedia.metadata, { source: 'external_url' });
});

test('media registration rejects insecure URLs and unsupported kinds', async () => {
  const manager = new ContentCmsManager({ MediaAsset: { create: async () => assert.fail('should not create media') } }, { id: 'staff-1' }, { info() {}, error() {} });

  await assert.rejects(
    () => manager.registerMedia({ kind: 'image', url: 'http://cdn.example.com/cover.jpg', mimeType: 'image/jpeg' }),
    /must use HTTPS/,
  );
  await assert.rejects(
    () => manager.registerMedia({ kind: 'archive', url: 'https://cdn.example.com/file.zip', mimeType: 'application/zip' }),
    /Unsupported media kind/,
  );
});

test('content search and saved content require authentication', async () => {
  const search = await graphql({ schema, source: '{ searchContent(query: "calm") { id } }', contextValue: {} });
  const saved = await graphql({ schema, source: '{ savedContent { id } }', contextValue: {} });
  assert.equal(search.errors?.[0]?.extensions?.code, 'UNAUTHENTICATED');
  assert.equal(saved.errors?.[0]?.extensions?.code, 'UNAUTHENTICATED');
});

test('bookmark ownership is always derived from the verified viewer', async () => {
  let bookmarkWhere;
  const models = {
    ProgramEnrollment: { count: async () => 0 },
    ContentItem: { findOne: async () => ({ id: 'content-1' }) },
    ContentBookmark: { findOrCreate: async ({ where }) => { bookmarkWhere = where; } },
  };
  const manager = new ContentCmsManager(models, { id: 'member-verified', centerId: null, subscriptionStatus: 'free' }, { info() {}, error() {} });
  const result = await manager.setBookmark({ contentItemId: 'content-1', kind: 'watch_later', saved: true });
  assert.equal(bookmarkWhere.userId, 'member-verified');
  assert.equal(bookmarkWhere.contentItemId, 'content-1');
  assert.deepEqual(result, { contentItemId: 'content-1', kind: 'watch_later', saved: true });
});

test('search history is persisted against the verified viewer', async () => {
  let recentSearch;
  const models = {
    ProgramEnrollment: { count: async () => 0 },
    ContentTranslation: {}, ContentCategory: {}, MediaAsset: {},
    ContentItem: { findAll: async () => [] },
    RecentSearch: {
      create: async (input) => { recentSearch = input; },
      findAll: async () => [],
      destroy: async () => {},
    },
  };
  const manager = new ContentCmsManager(models, { id: 'member-verified', centerId: null, subscriptionStatus: 'free' }, { info() {}, error() {} });
  await manager.search({ query: '  gentle   breath ', language: 'en' });
  assert.equal(recentSearch.userId, 'member-verified');
  assert.equal(recentSearch.query, 'gentle breath');
  assert.equal(recentSearch.resultCount, 0);
});

test('view progress validates ranges and derives member ownership', async () => {
  let defaultsItem;
  let defaultsDaily;
  const historyItem = { id: 'history-item' };
  const historyDaily = { id: 'history-daily' };
  
  const models = {
    ProgramEnrollment: { count: async () => 0 },
    ContentItem: { findOne: async () => ({ id: 'content-1' }) },
    ContentViewHistory: {
      findOrCreate: async (input) => {
        if (input.where.contentItemId) {
          defaultsItem = input.defaults;
          return [historyItem, true];
        } else {
          defaultsDaily = input.defaults;
          return [historyDaily, true];
        }
      },
      findOne: async (input) => {
        if (input.where.contentItemId === 'content-1') return historyItem;
        if (input.where.dailyContentId === 'daily-1') return historyDaily;
        return null;
      }
    },
  };

  const manager = new ContentCmsManager(models, { id: 'member-verified', centerId: null, subscriptionStatus: 'free' }, { info() {}, error() {} });
  
  // Test content item recording
  assert.equal(await manager.recordView({ contentItemId: 'content-1', lastPositionSeconds: 42, progressPercent: 25 }), historyItem);
  assert.equal(defaultsItem.userId, 'member-verified');
  assert.equal(defaultsItem.lastPositionSeconds, 42);

  // Test daily content recording
  assert.equal(await manager.recordView({ dailyContentId: 'daily-1', lastPositionSeconds: 120, progressPercent: 80 }), historyDaily);
  assert.equal(defaultsDaily.userId, 'member-verified');
  assert.equal(defaultsDaily.lastPositionSeconds, 120);
  assert.equal(defaultsDaily.dailyContentId, 'daily-1');

  // Test view history retrieval
  assert.equal(await manager.getViewHistory({ contentItemId: 'content-1' }), historyItem);
  assert.equal(await manager.getViewHistory({ dailyContentId: 'daily-1' }), historyDaily);

  // Test input validations
  await assert.rejects(() => manager.recordView({ contentItemId: 'content-1', progressPercent: 101 }), /outside the allowed range/);
  await assert.rejects(() => manager.recordView({ progressPercent: 50 }), /Either contentItemId or dailyContentId must be provided/);
});
