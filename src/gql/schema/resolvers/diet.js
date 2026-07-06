import { authenticate } from '../permissions/index.js';
import { DietService } from '../../../modules/diet/diet.service.js';

export const dietResolvers = {
  Query: {
    getDietPreference: authenticate(async (parent, args, context) => {
      const service = new DietService(context.models, context.sequelize);
      return service.getDietPreference(context.viewer.id);
    }),

    getMyMealPlans: authenticate(async (parent, { dayNumber }, context) => {
      const service = new DietService(context.models, context.sequelize);
      return service.getMyMealPlans(context.viewer.id, dayNumber);
    }),

    getShoppingList: authenticate(async (parent, args, context) => {
      const service = new DietService(context.models, context.sequelize);
      return service.getShoppingList(context.viewer.id);
    })
  },

  Mutation: {
    updateDietPreference: authenticate(async (parent, { input }, context) => {
      const service = new DietService(context.models, context.sequelize);
      return service.updateDietPreference(context.viewer.id, input);
    }),

    toggleMealPlan: authenticate(async (parent, { mealPlanId, completed }, context) => {
      const service = new DietService(context.models, context.sequelize);
      return service.toggleMealPlan(context.viewer.id, mealPlanId, completed);
    }),

    addShoppingListItem: authenticate(async (parent, { input }, context) => {
      const service = new DietService(context.models, context.sequelize);
      return service.addShoppingListItem(context.viewer.id, input);
    }),

    toggleShoppingListItem: authenticate(async (parent, { itemId, purchased }, context) => {
      const service = new DietService(context.models, context.sequelize);
      return service.toggleShoppingListItem(context.viewer.id, itemId, purchased);
    }),

    clearPurchasedShoppingList: authenticate(async (parent, args, context) => {
      const service = new DietService(context.models, context.sequelize);
      return service.clearPurchasedShoppingList(context.viewer.id);
    })
  }
};
