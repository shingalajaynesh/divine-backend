import { authenticate } from '../permissions/index.js';
import { RecommendationService } from '../../../modules/recommendation/recommendation.service.js';

export const recommendationResolvers = {
  Query: {
    myRecommendations: authenticate(async (parent, args, context) => {
      const service = new RecommendationService(context.models, context.sequelize);
      const user = await context.models.User.findByPk(context.viewer.id);
      if (!user) return [];
      return service.getRecommendations(user);
    })
  }
};
