import { authenticate } from '../permissions/index.js';
import { ForumService } from '../../../modules/forum/forum.service.js';

export const forumResolvers = {
  ForumComment: {
    user: async (parent, args, context) => {
      if (parent.user) return parent.user;
      return await context.models.User.findByPk(parent.userId);
    },
    reported: (parent) => !!parent.reported,
    reportsCount: (parent) => parent.reportsCount || 0,
    createdAt: (parent) => {
      const d = typeof parent.createdAt === 'string' ? new Date(parent.createdAt) : parent.createdAt;
      return d.toISOString();
    }
  },

  ForumPost: {
    user: async (parent, args, context) => {
      if (parent.user) return parent.user;
      return await context.models.User.findByPk(parent.userId);
    },
    isLiked: (parent, args, context) => {
      if (!context.viewer) return false;
      let likedUsers = [];
      try {
        likedUsers = JSON.parse(parent.likedByUsers || '[]');
      } catch (e) {
        likedUsers = [];
      }
      return likedUsers.includes(context.viewer.id);
    },
    comments: async (parent, args, context) => {
      return await context.models.ForumComment.findAll({
        where: { 
          postId: parent.id,
          reportsCount: {
            [context.models.Sequelize.Op.lt]: 5
          }
        },
        order: [['createdAt', 'ASC']],
        include: [{ model: context.models.User, as: 'user' }]
      });
    },
    reported: (parent) => !!parent.reported,
    reportsCount: (parent) => parent.reportsCount || 0,
    createdAt: (parent) => {
      const d = typeof parent.createdAt === 'string' ? new Date(parent.createdAt) : parent.createdAt;
      return d.toISOString();
    }
  },

  Query: {
    getForumPosts: authenticate(async (parent, { category }, context) => {
      const service = new ForumService(context.models, context.sequelize);
      return service.getPosts(category);
    }),
  },

  Mutation: {
    addForumPost: authenticate(async (parent, args, context) => {
      const service = new ForumService(context.models, context.sequelize);
      const post = await service.addPost(context.viewer.id, args);
      post.user = context.viewer;
      return post;
    }),

    addForumComment: authenticate(async (parent, args, context) => {
      const { postId, content } = args;
      const comment = await context.models.ForumComment.create({
        postId,
        userId: context.viewer.id,
        content,
        reported: false,
        reportsCount: 0
      });
      comment.user = context.viewer;
      return comment;
    }),

    togglePostLike: authenticate(async (parent, { postId }, context) => {
      const service = new ForumService(context.models, context.sequelize);
      return service.toggleLike(context.viewer.id, postId);
    }),

    reportPost: authenticate(async (parent, { postId }, context) => {
      const service = new ForumService(context.models, context.sequelize);
      return service.reportPost(postId);
    }),

    reportComment: authenticate(async (parent, { commentId }, context) => {
      const service = new ForumService(context.models, context.sequelize);
      return service.reportComment(commentId);
    })
  }
};
