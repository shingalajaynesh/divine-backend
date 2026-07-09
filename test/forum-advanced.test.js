import assert from 'node:assert/strict';
import test from 'node:test';
import { graphql } from 'graphql';
import schema from '../src/gql/schema/index.js';

test('Advanced Forum sub-communities, reactions, and moderator reviews', async () => {
  const getForumPostsQuery = `
    query GetForumPosts($category: String, $groupId: ID) {
      getForumPosts(category: $category, groupId: $groupId) {
        id
        title
        content
        reactionsCount
        reactionStats {
          type
          count
        }
        userReaction
        group {
          id
          name
        }
      }
    }
  `;

  const getForumGroupsQuery = `
    query GetForumGroups {
      getForumGroups {
        id
        name
        description
        isPrivate
      }
    }
  `;

  const getModerationQueueQuery = `
    query GetModerationQueue {
      getModerationQueue {
        flaggedPosts {
          id
          title
          reportsCount
          reportedReason
        }
        flaggedComments {
          id
          content
          reportsCount
          reportedReason
        }
      }
    }
  `;

  const createForumGroupMutation = `
    mutation CreateForumGroup($name: String!, $description: String, $coverUrl: String, $isPrivate: Boolean!) {
      createForumGroup(name: $name, description: $description, coverUrl: $coverUrl, isPrivate: $isPrivate) {
        id
        name
        description
        isPrivate
      }
    }
  `;

  const reactToPostMutation = `
    mutation ReactToPost($postId: ID!, $reactionType: String!) {
      reactToPost(postId: $postId, reactionType: $reactionType) {
        id
        reactionsCount
        reactionStats {
          type
          count
        }
        userReaction
      }
    }
  `;

  const reportPostMutation = `
    mutation ReportPost($postId: ID!, $reason: String) {
      reportPost(postId: $postId, reason: $reason) {
        id
        reported
        reportsCount
        reportedReason
      }
    }
  `;

  const moderatePostMutation = `
    mutation ModeratePost($postId: ID!, $action: String!) {
      moderatePost(postId: $postId, action: $action)
    }
  `;

  // Mock data entities
  const mockGroup = {
    id: 'group-100',
    name: 'First Trimester Support Group',
    description: 'Support, questions, and discussions for trimester 1.',
    coverUrl: null,
    isPrivate: false,
    createdAt: new Date('2026-07-09T00:00:00Z')
  };

  const mockPost = {
    id: 'da70bc6c-1394-44e8-9898-e5d823664488',
    userId: 'user-1',
    title: 'Yoga question',
    content: 'Is yoga safe in week 8?',
    category: 'Yoga',
    groupId: 'group-100',
    likesCount: 0,
    likedByUsers: '[]',
    reactions: {},
    reported: false,
    reportsCount: 0,
    reportedReason: null,
    save: async function() { return this; },
    destroy: async function() { return this; }
  };

  const mockComment = {
    id: 'da70bc6c-1394-44e8-9898-e5d823664499',
    postId: 'da70bc6c-1394-44e8-9898-e5d823664488',
    userId: 'user-2',
    content: 'Yes, but consult your doctor.',
    reported: false,
    reportsCount: 0,
    reportedReason: null,
    save: async function() { return this; },
    destroy: async function() { return this; }
  };

  const mockModels = {
    Sequelize: {
      Op: {
        lt: Symbol('lt')
      }
    },
    ForumGroup: {
      create: async (input) => {
        return { id: 'group-100', ...input };
      },
      findAll: async () => {
        return [mockGroup];
      },
      findByPk: async (id) => {
        if (id === mockGroup.id) return mockGroup;
        return null;
      }
    },
    ForumPost: {
      create: async (input) => {
        return { id: 'post-100', ...input, save: async () => {} };
      },
      findAll: async (options) => {
        const where = options.where;
        if (where.reported === true && !mockPost.reported) return [];
        return [mockPost];
      },
      findByPk: async (id) => {
        if (id === mockPost.id) return mockPost;
        return null;
      }
    },
    ForumComment: {
      findAll: async (options) => {
        const where = options.where;
        if (where.reported === true && !mockComment.reported) return [];
        return [mockComment];
      },
      findByPk: async (id) => {
        if (id === mockComment.id) return mockComment;
        return null;
      }
    },
    User: {
      findByPk: async (id) => {
        return { id, displayName: 'Mother' };
      }
    }
  };

  const { ForumService } = await import('../src/modules/forum/forum.service.js');

  const runQuery = async (source, variables, viewer) => {
    const service = new ForumService(mockModels, {});
    return graphql({
      schema,
      source,
      variableValues: variables,
      contextValue: { viewer, models: mockModels, sequelize: {}, forumService: service }
    });
  };

  const motherViewer = { id: 'user-1', role: { roleType: 'MOTHER' }, centerId: 'center-1' };
  const adminViewer = { id: 'admin-1', role: { roleType: 'SUPER_ADMIN' }, centerId: 'center-1' };

  // Test Case 1: Create sub-community forum group
  const res1 = await runQuery(createForumGroupMutation, {
    name: 'First Trimester Support Group',
    description: 'Support, questions, and discussions for trimester 1.',
    coverUrl: 'https://images.unsplash.com/photo-1516627145497-ae6968895b74',
    isPrivate: false
  }, motherViewer);
  assert.equal(res1.errors, undefined);
  assert.equal(res1.data.createForumGroup.name, 'First Trimester Support Group');

  // Test Case 2: Fetch groups list
  const res2 = await runQuery(getForumGroupsQuery, {}, motherViewer);
  assert.equal(res2.errors, undefined);
  assert.equal(res2.data.getForumGroups.length, 1);
  assert.equal(res2.data.getForumGroups[0].name, 'First Trimester Support Group');

  // Test Case 3: Toggle custom emoji reactions (HEART) on post
  const res3 = await runQuery(reactToPostMutation, {
    postId: mockPost.id,
    reactionType: 'HEART'
  }, motherViewer);
  assert.equal(res3.errors, undefined);
  assert.equal(res3.data.reactToPost.reactionsCount, 1);
  assert.equal(res3.data.reactToPost.reactionStats[0].type, 'HEART');
  assert.equal(res3.data.reactToPost.reactionStats[0].count, 1);
  assert.equal(res3.data.reactToPost.userReaction, 'HEART');

  // Test Case 4: Toggle same reaction removes it
  const res4 = await runQuery(reactToPostMutation, {
    postId: mockPost.id,
    reactionType: 'HEART'
  }, motherViewer);
  assert.equal(res4.errors, undefined);
  assert.equal(res4.data.reactToPost.reactionsCount, 0);

  // Test Case 5: Report post with abuse reason
  const res5 = await runQuery(reportPostMutation, {
    postId: mockPost.id,
    reason: 'Spam, advertising product'
  }, motherViewer);
  assert.equal(res5.errors, undefined);
  assert.equal(res5.data.reportPost.reported, true);
  assert.equal(res5.data.reportPost.reportedReason, 'Spam, advertising product');

  // Test Case 6: Stranger (Mother role) cannot fetch moderation queue
  const res6 = await runQuery(getModerationQueueQuery, {}, motherViewer);
  assert.ok(res6.errors && res6.errors.length > 0);
  assert.match(res6.errors[0].message, /Unauthorized access to moderation queue/);

  // Test Case 7: Admin viewer fetches moderation queue successfully
  const res7 = await runQuery(getModerationQueueQuery, {}, adminViewer);
  assert.equal(res7.errors, undefined);
  assert.equal(res7.data.getModerationQueue.flaggedPosts.length, 1);
  assert.equal(res7.data.getModerationQueue.flaggedPosts[0].reportedReason, 'Spam, advertising product');

  // Test Case 8: Moderate post (Approve / Dismiss) clears report status
  const res8 = await runQuery(moderatePostMutation, {
    postId: mockPost.id,
    action: 'APPROVE'
  }, adminViewer);
  assert.equal(res8.errors, undefined);
  assert.equal(res8.data.moderatePost, true);
  assert.equal(mockPost.reported, false);
  assert.equal(mockPost.reportsCount, 0);
});
