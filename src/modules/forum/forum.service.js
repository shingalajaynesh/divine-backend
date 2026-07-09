import { z } from 'zod';

export const createPostSchema = z.object({
  title: z.string().min(3).max(100),
  content: z.string().min(5).max(5000),
  category: z.string().max(50).optional(),
  groupId: z.string().uuid().optional().nullable()
});

export const createGroupSchema = z.object({
  name: z.string().min(3).max(100),
  description: z.string().max(1000).optional().nullable(),
  coverUrl: z.string().url().optional().nullable(),
  isPrivate: z.boolean().default(false)
});

export class ForumService {
  constructor(models, sequelize) {
    this.models = models;
    this.sequelize = sequelize;
  }

  async getGroups() {
    return this.models.ForumGroup.findAll({
      order: [['createdAt', 'DESC']]
    });
  }

  async createGroup(input) {
    const { name, description, coverUrl, isPrivate } = createGroupSchema.parse(input);
    return this.models.ForumGroup.create({
      name,
      description,
      coverUrl,
      isPrivate
    });
  }

  async getPosts(category, groupId) {
    const whereClause = {
      reportsCount: {
        [this.models.Sequelize.Op.lt]: 5
      }
    };

    if (category && category !== 'All') {
      whereClause.category = category;
    }

    if (groupId) {
      whereClause.groupId = groupId;
    }

    return this.models.ForumPost.findAll({
      where: whereClause,
      include: [
        { model: this.models.User, as: 'user' },
        { model: this.models.ForumGroup, as: 'group', required: false },
        { 
          model: this.models.ForumComment, 
          as: 'comments',
          required: false,
          where: {
            reportsCount: {
              [this.models.Sequelize.Op.lt]: 5
            }
          },
          include: [{ model: this.models.User, as: 'user' }]
        }
      ],
      order: [['createdAt', 'DESC']]
    });
  }

  async addPost(userId, input) {
    const { title, content, category = 'General', groupId = null } = createPostSchema.parse(input);

    return this.models.ForumPost.create({
      userId,
      title,
      content,
      category,
      groupId,
      likesCount: 0,
      likedByUsers: '[]',
      reactions: {},
      reported: false,
      reportsCount: 0
    });
  }

  async toggleLike(userId, postId) {
    const parsedPostId = z.string().uuid().parse(postId);

    const post = await this.models.ForumPost.findByPk(parsedPostId);
    if (!post) throw new Error('Post not found');

    let likedUsers = [];
    try {
      likedUsers = JSON.parse(post.likedByUsers || '[]');
    } catch (e) {
      likedUsers = [];
    }

    const idx = likedUsers.indexOf(userId);
    if (idx === -1) {
      likedUsers.push(userId);
    } else {
      likedUsers.splice(idx, 1);
    }

    post.likedByUsers = JSON.stringify(likedUsers);
    post.likesCount = likedUsers.length;

    // Keep reactions in sync as well
    let reactionsMap = {};
    if (post.reactions) {
      reactionsMap = typeof post.reactions === 'string' ? JSON.parse(post.reactions) : post.reactions;
    }
    if (idx === -1) {
      reactionsMap[userId] = 'LIKE';
    } else {
      delete reactionsMap[userId];
    }
    post.reactions = reactionsMap;

    await post.save();
    return post;
  }

  async reactToPost(userId, postId, reactionType) {
    const parsedPostId = z.string().uuid().parse(postId);
    const parsedReaction = z.string().min(1).parse(reactionType).toUpperCase();

    const post = await this.models.ForumPost.findByPk(parsedPostId);
    if (!post) throw new Error('Post not found');

    let reactionsMap = {};
    if (post.reactions) {
      if (typeof post.reactions === 'string') {
        try {
          reactionsMap = JSON.parse(post.reactions);
        } catch (e) {
          reactionsMap = {};
        }
      } else {
        reactionsMap = post.reactions;
      }
    }

    if (reactionsMap[userId] === parsedReaction) {
      delete reactionsMap[userId];
    } else {
      reactionsMap[userId] = parsedReaction;
    }

    post.reactions = reactionsMap;

    // Keep likedByUsers in sync for backward compatibility
    let likedUsers = [];
    try {
      likedUsers = JSON.parse(post.likedByUsers || '[]');
    } catch (e) {
      likedUsers = [];
    }
    const likeIdx = likedUsers.indexOf(userId);
    if (reactionsMap[userId] === 'LIKE') {
      if (likeIdx === -1) likedUsers.push(userId);
    } else {
      if (likeIdx !== -1) likedUsers.splice(likeIdx, 1);
    }
    post.likedByUsers = JSON.stringify(likedUsers);
    post.likesCount = likedUsers.length;

    await post.save();
    return post;
  }

  async reportPost(postId, reason) {
    const parsedPostId = z.string().uuid().parse(postId);

    const post = await this.models.ForumPost.findByPk(parsedPostId);
    if (!post) throw new Error('Post not found');

    post.reportsCount += 1;
    post.reported = true;
    if (reason) {
      post.reportedReason = reason;
    }
    await post.save();
    return post;
  }

  async reportComment(commentId, reason) {
    const parsedCommentId = z.string().uuid().parse(commentId);

    const comment = await this.models.ForumComment.findByPk(parsedCommentId);
    if (!comment) throw new Error('Comment not found');

    comment.reportsCount += 1;
    comment.reported = true;
    if (reason) {
      comment.reportedReason = reason;
    }
    await comment.save();
    return comment;
  }

  async getModerationQueue() {
    const flaggedPosts = await this.models.ForumPost.findAll({
      where: { reported: true },
      include: [{ model: this.models.User, as: 'user' }],
      order: [['reportsCount', 'DESC']]
    });

    const flaggedComments = await this.models.ForumComment.findAll({
      where: { reported: true },
      include: [{ model: this.models.User, as: 'user' }],
      order: [['reportsCount', 'DESC']]
    });

    return { flaggedPosts, flaggedComments };
  }

  async moderatePost(postId, action) {
    const parsedPostId = z.string().uuid().parse(postId);
    const post = await this.models.ForumPost.findByPk(parsedPostId);
    if (!post) throw new Error('Post not found');

    if (action === 'APPROVE') {
      post.reported = false;
      post.reportsCount = 0;
      post.reportedReason = null;
      await post.save();
    } else if (action === 'DELETE') {
      await post.destroy();
    } else {
      throw new Error('Invalid moderation action');
    }
    return true;
  }

  async moderateComment(commentId, action) {
    const parsedCommentId = z.string().uuid().parse(commentId);
    const comment = await this.models.ForumComment.findByPk(parsedCommentId);
    if (!comment) throw new Error('Comment not found');

    if (action === 'APPROVE') {
      comment.reported = false;
      comment.reportsCount = 0;
      comment.reportedReason = null;
      await comment.save();
    } else if (action === 'DELETE') {
      await comment.destroy();
    } else {
      throw new Error('Invalid moderation action');
    }
    return true;
  }
}
