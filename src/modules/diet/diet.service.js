import { z } from 'zod';

export const updateDietPreferenceSchema = z.object({
  dietType: z.enum(['VEG', 'VEGAN', 'EGGITARIAN', 'NON_VEG']),
  allergens: z.array(z.string()).optional(),
  notes: z.string().optional()
});

export const addShoppingItemSchema = z.object({
  ingredientName: z.string().min(1).max(120),
  quantity: z.string().max(60).optional()
});

export class DietService {
  constructor(models, sequelize) {
    this.models = models;
    this.sequelize = sequelize;
  }

  async getDietPreference(userId) {
    let pref = await this.models.DietPreference.findOne({ where: { userId } });
    if (!pref) {
      // Return default initial VEG preferences (not persisted yet)
      pref = { userId, dietType: 'VEG', allergens: '[]', notes: '' };
    }
    return pref;
  }

  async updateDietPreference(userId, input) {
    const { dietType, allergens = [], notes = '' } = updateDietPreferenceSchema.parse(input);
    const allergensStr = JSON.stringify(allergens);

    const [pref] = await this.models.DietPreference.upsert({
      userId,
      dietType,
      allergens: allergensStr,
      notes
    });
    return pref;
  }

  async getMyMealPlans(userId, dayNumber) {
    const parsedDay = z.number().int().min(1).max(280).parse(dayNumber);
    const plans = await this.models.UserMealPlan.findAll({
      where: { userId, dayNumber: parsedDay },
      order: [['createdAt', 'ASC']]
    });

    // If empty daily checklist, generate defaults (BREAKFAST, LUNCH, SNACK, DINNER)
    if (plans.length === 0) {
      const defaultTypes = ['BREAKFAST', 'LUNCH', 'SNACK', 'DINNER'];
      const created = [];
      await this.sequelize.transaction(async (t) => {
        for (const type of defaultTypes) {
          const item = await this.models.UserMealPlan.create({
            userId,
            dayNumber: parsedDay,
            mealType: type,
            completed: false
          }, { transaction: t });
          created.push(item);
        }
      });
      return created;
    }

    return plans;
  }

  async toggleMealPlan(userId, mealPlanId, completed) {
    const plan = await this.models.UserMealPlan.findOne({ where: { id: mealPlanId, userId } });
    if (!plan) throw new Error('Meal plan entry not found');

    plan.completed = completed;
    await plan.save();
    return plan;
  }

  async getShoppingList(userId) {
    return this.models.ShoppingListItem.findAll({
      where: { userId },
      order: [['createdAt', 'DESC']]
    });
  }

  async addShoppingListItem(userId, input) {
    const { ingredientName, quantity = '' } = addShoppingItemSchema.parse(input);
    return this.models.ShoppingListItem.create({
      userId,
      ingredientName,
      quantity,
      purchased: false
    });
  }

  async toggleShoppingListItem(userId, itemId, purchased) {
    const item = await this.models.ShoppingListItem.findOne({ where: { id: itemId, userId } });
    if (!item) throw new Error('Shopping item not found');

    item.purchased = purchased;
    await item.save();
    return item;
  }

  async clearPurchasedShoppingList(userId) {
    await this.models.ShoppingListItem.destroy({
      where: { userId, purchased: true }
    });
    return true;
  }
}
