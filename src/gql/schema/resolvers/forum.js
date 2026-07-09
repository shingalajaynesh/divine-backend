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
    reportedReason: (parent) => parent.reportedReason || null,
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
    group: async (parent, args, context) => {
      if (parent.group) return parent.group;
      if (!parent.groupId) return null;
      return await context.models.ForumGroup.findByPk(parent.groupId);
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
    reactionsCount: (parent) => {
      let reactionsMap = {};
      if (parent.reactions) {
        reactionsMap = typeof parent.reactions === 'string' ? JSON.parse(parent.reactions) : parent.reactions;
      }
      return Object.keys(reactionsMap).length;
    },
    reactionStats: (parent) => {
      let reactionsMap = {};
      if (parent.reactions) {
        reactionsMap = typeof parent.reactions === 'string' ? JSON.parse(parent.reactions) : parent.reactions;
      }
      const counts = {};
      Object.values(reactionsMap).forEach(type => {
        counts[type] = (counts[type] || 0) + 1;
      });
      return Object.entries(counts).map(([type, count]) => ({ type, count }));
    },
    userReaction: (parent, args, context) => {
      if (!context.viewer) return null;
      let reactionsMap = {};
      if (parent.reactions) {
        reactionsMap = typeof parent.reactions === 'string' ? JSON.parse(parent.reactions) : parent.reactions;
      }
      return reactionsMap[context.viewer.id] || null;
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
    reportedReason: (parent) => parent.reportedReason || null,
    createdAt: (parent) => {
      const d = typeof parent.createdAt === 'string' ? new Date(parent.createdAt) : parent.createdAt;
      return d.toISOString();
    }
  },

  ForumGroup: {
    posts: async (parent, args, context) => {
      return await context.models.ForumPost.findAll({
        where: { groupId: parent.id },
        order: [['createdAt', 'DESC']]
      });
    }
  },

  Query: {
    getForumPosts: authenticate(async (parent, { category, groupId }, context) => {
      const service = new ForumService(context.models, context.sequelize);
      return service.getPosts(category, groupId);
    }),

    getForumGroups: authenticate(async (parent, args, context) => {
      const service = new ForumService(context.models, context.sequelize);
      return service.getGroups();
    }),

    getModerationQueue: authenticate(async (parent, args, context) => {
      const hasStaffAccess = ['STAFF', 'ADMIN', 'GUIDE', 'SUPER_ADMIN'].includes(context.viewer.role?.roleType);
      if (!hasStaffAccess) {
        throw new Error('Unauthorized access to moderation queue');
      }
      const service = new ForumService(context.models, context.sequelize);
      return service.getModerationQueue();
    })
  },

  Mutation: {
    addForumPost: authenticate(async (parent, args, context) => {
      const service = new ForumService(context.models, context.sequelize);
      const post = await service.addPost(context.viewer.id, args);
      post.user = context.viewer;
      return post;
    }),

    createForumGroup: authenticate(async (parent, args, context) => {
      const service = new ForumService(context.models, context.sequelize);
      return service.createGroup(args);
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

    reactToPost: authenticate(async (parent, { postId, reactionType }, context) => {
      const service = new ForumService(context.models, context.sequelize);
      return service.reactToPost(context.viewer.id, postId, reactionType);
    }),

    reportPost: authenticate(async (parent, { postId, reason }, context) => {
      const service = new ForumService(context.models, context.sequelize);
      return service.reportPost(postId, reason);
    }),

    reportComment: authenticate(async (parent, { commentId, reason }, context) => {
      const service = new ForumService(context.models, context.sequelize);
      return service.reportComment(commentId, reason);
    }),

    moderatePost: authenticate(async (parent, { postId, action }, context) => {
      const hasStaffAccess = ['STAFF', 'ADMIN', 'GUIDE', 'SUPER_ADMIN'].includes(context.viewer.role?.roleType);
      if (!hasStaffAccess) {
        throw new Error('Unauthorized');
      }
      const service = new ForumService(context.models, context.sequelize);
      return service.moderatePost(postId, action);
    }),

    moderateComment: authenticate(async (parent, { commentId, action }, context) => {
      const hasStaffAccess = ['STAFF', 'ADMIN', 'GUIDE', 'SUPER_ADMIN'].includes(context.viewer.role?.roleType);
      if (!hasStaffAccess) {
        throw new Error('Unauthorized');
      }
      const service = new ForumService(context.models, context.sequelize);
      return service.moderateComment(commentId, action);
    })
  }
};
