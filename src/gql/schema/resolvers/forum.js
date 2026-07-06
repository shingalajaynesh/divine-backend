import { authenticate } from '../permissions/index.js';

export const forumResolvers = {
  ForumComment: {
    user: async (parent, args, context) => {
      if (parent.user) return parent.user;
      return await context.models.User.findByPk(parent.userId);
    },
    createdAt: (parent) => parent.createdAt.toISOString()
  },

  ForumPost: {
    user: async (parent, args, context) => {
      if (parent.user) return parent.user;
      return await context.models.User.findByPk(parent.userId);
    },
    comments: async (parent, args, context) => {
      return await context.models.ForumComment.findAll({
        where: { postId: parent.id },
        order: [['createdAt', 'ASC']],
        include: [{ model: context.models.User, as: 'user' }]
      });
    },
    createdAt: (parent) => parent.createdAt.toISOString()
  },

  Query: {
    getForumPosts: authenticate(async (parent, args, context) => {
      return await context.models.ForumPost.findAll({
        order: [['createdAt', 'DESC']],
        include: [{ model: context.models.User, as: 'user' }]
      });
    }),
  },

  Mutation: {
    addForumPost: authenticate(async (parent, args, context) => {
      const { title, content } = args;
      const post = await context.models.ForumPost.create({
        userId: context.viewer.id,
        title,
        content
      });
      post.user = context.viewer;
      return post;
    }),

    addForumComment: authenticate(async (parent, args, context) => {
      const { postId, content } = args;
      const comment = await context.models.ForumComment.create({
        postId,
        userId: context.viewer.id,
        content
      });
      comment.user = context.viewer;
      return comment;
    }),
  }
};
