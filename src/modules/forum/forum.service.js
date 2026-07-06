import { z } from 'zod';

export const createPostSchema = z.object({
  title: z.string().min(3).max(100),
  content: z.string().min(5).max(5000),
  category: z.string().max(50).optional()
});

export class ForumService {
  constructor(models, sequelize) {
    this.models = models;
    this.sequelize = sequelize;
  }

  async getPosts(category) {
    const whereClause = {
      reportsCount: {
        [this.models.Sequelize.Op.lt]: 5
      }
    };

    if (category && category !== 'All') {
      whereClause.category = category;
    }

    return this.models.ForumPost.findAll({
      where: whereClause,
      include: [
        { model: this.models.User, as: 'user' },
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
    const { title, content, category = 'General' } = createPostSchema.parse(input);

    return this.models.ForumPost.create({
      userId,
      title,
      content,
      category,
      likesCount: 0,
      likedByUsers: '[]',
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
    await post.save();
    return post;
  }

  async reportPost(postId) {
    const parsedPostId = z.string().uuid().parse(postId);

    const post = await this.models.ForumPost.findByPk(parsedPostId);
    if (!post) throw new Error('Post not found');

    post.reportsCount += 1;
    post.reported = true;
    await post.save();
    return post;
  }

  async reportComment(commentId) {
    const parsedCommentId = z.string().uuid().parse(commentId);

    const comment = await this.models.ForumComment.findByPk(parsedCommentId);
    if (!comment) throw new Error('Comment not found');

    comment.reportsCount += 1;
    comment.reported = true;
    await comment.save();
    return comment;
  }
}
