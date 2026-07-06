import assert from 'node:assert/strict';
import test from 'node:test';
import { graphql } from 'graphql';
import schema from '../src/gql/schema/index.js';
import { ForumService } from '../src/modules/forum/forum.service.js';

const VALID_USER_ID = 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a66';
const VALID_POST_ID = 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a77';
const VALID_COMMENT_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a88';

test('forum queries require authentication', async () => {
  const query = '{ getForumPosts { id title content category } }';
  const result = await graphql({ schema, source: query, contextValue: {} });
  assert.equal(result.errors?.[0]?.extensions?.code, 'UNAUTHENTICATED');
});

test('ForumService creates posts, toggles likes, and reports contents', async () => {
  let createdPostInput = null;
  let savedPostId = null;
  let reportedPostId = null;
  let reportedCommentId = null;

  const mockOp = {
    lt: Symbol('lt')
  };

  const models = {
    Sequelize: {
      Op: mockOp
    },
    ForumPost: {
      create: async (input) => {
        createdPostInput = input;
        return { id: VALID_POST_ID, ...input };
      },
      findByPk: async (id) => {
        if (id === VALID_POST_ID) {
          return {
            id: VALID_POST_ID,
            likedByUsers: '[]',
            likesCount: 0,
            reportsCount: 0,
            reported: false,
            save: async function() {
              savedPostId = this.id;
              reportedPostId = this.reported ? this.id : null;
            }
          };
        }
        return null;
      },
      findAll: async ({ where }) => {
        return [
          {
            id: VALID_POST_ID,
            title: 'Yoga post',
            content: 'Great yoga post',
            category: 'Yoga',
            reportsCount: 0
          }
        ];
      }
    },
    ForumComment: {
      findByPk: async (id) => {
        if (id === VALID_COMMENT_ID) {
          return {
            id: VALID_COMMENT_ID,
            reportsCount: 0,
            reported: false,
            save: async function() {
              reportedCommentId = this.id;
            }
          };
        }
        return null;
      }
    }
  };

  const service = new ForumService(models, {});

  // 1. Create a post
  await service.addPost(VALID_USER_ID, {
    title: 'Yoga post',
    content: 'Great yoga post',
    category: 'Yoga'
  });
  assert.equal(createdPostInput.title, 'Yoga post');
  assert.equal(createdPostInput.category, 'Yoga');

  // 2. Toggle like (Adds user)
  const likedPost = await service.toggleLike(VALID_USER_ID, VALID_POST_ID);
  assert.equal(savedPostId, VALID_POST_ID);

  // 3. Report post
  await service.reportPost(VALID_POST_ID);
  assert.equal(reportedPostId, VALID_POST_ID);

  // 4. Report comment
  await service.reportComment(VALID_COMMENT_ID);
  assert.equal(reportedCommentId, VALID_COMMENT_ID);

  // 5. Get posts list
  const posts = await service.getPosts('Yoga');
  assert.equal(posts.length, 1);
  assert.equal(posts[0].category, 'Yoga');
});
