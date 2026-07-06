import assert from 'node:assert/strict';
import test from 'node:test';
import { graphql } from 'graphql';
import schema from '../src/gql/schema/index.js';
import { DietService } from '../src/modules/diet/diet.service.js';

test('diet queries require authentication', async () => {
  const prefQuery = '{ getDietPreference { userId dietType } }';
  const result = await graphql({ schema, source: prefQuery, contextValue: {} });
  assert.equal(result.errors?.[0]?.extensions?.code, 'UNAUTHENTICATED');
});

test('DietService manages preferences, meal plans, and shopping checklist', async () => {
  let createdPrefInput = null;
  let createdMealPlans = [];
  let updatedMealPlan = null;
  let createdShoppingItem = null;
  let updatedShoppingItem = null;
  let clearedPurchasedList = false;

  const models = {
    DietPreference: {
      findOne: async () => null,
      upsert: async (input) => {
        createdPrefInput = input;
        return [{ ...input }];
      }
    },
    UserMealPlan: {
      findAll: async () => [], // returns empty to trigger default creation
      create: async (input) => {
        createdMealPlans.push(input);
        return { id: 'meal-1', ...input };
      },
      findOne: async ({ where }) => {
        if (where.id === 'meal-1') {
          return {
            id: 'meal-1',
            completed: false,
            save: async () => { updatedMealPlan = 'meal-1'; }
          };
        }
        return null;
      }
    },
    ShoppingListItem: {
      findAll: async () => [{ id: 'shop-1', ingredientName: 'Apples', purchased: false }],
      create: async (input) => {
        createdShoppingItem = input;
        return { id: 'shop-2', ...input };
      },
      findOne: async ({ where }) => {
        if (where.id === 'shop-1') {
          return {
            id: 'shop-1',
            purchased: false,
            save: async () => { updatedShoppingItem = 'shop-1'; }
          };
        }
        return null;
      },
      destroy: async ({ where }) => {
        if (where.purchased === true) {
          clearedPurchasedList = true;
          return 1;
        }
        return 0;
      }
    }
  };

  const sequelize = {
    transaction: async (cb) => cb()
  };

  const service = new DietService(models, sequelize);

  // 1. Get default diet preferences
  const pref = await service.getDietPreference('user-1');
  assert.equal(pref.dietType, 'VEG');

  // 2. Update diet preferences
  await service.updateDietPreference('user-1', { dietType: 'VEGAN', allergens: ['nuts'], notes: 'No walnuts' });
  assert.equal(createdPrefInput.dietType, 'VEGAN');
  assert.equal(createdPrefInput.allergens, '["nuts"]');
  assert.equal(createdPrefInput.notes, 'No walnuts');

  // 3. Get my meal plans (triggers default creation of 4 meals)
  const meals = await service.getMyMealPlans('user-1', 45);
  assert.equal(meals.length, 4);
  assert.equal(createdMealPlans.length, 4);
  assert.equal(createdMealPlans[0].mealType, 'BREAKFAST');
  assert.equal(createdMealPlans[0].dayNumber, 45);

  // 4. Toggle meal plan
  await service.toggleMealPlan('user-1', 'meal-1', true);
  assert.equal(updatedMealPlan, 'meal-1');

  // 5. Add shopping item
  await service.addShoppingListItem('user-1', { ingredientName: 'Milk', quantity: '1L' });
  assert.equal(createdShoppingItem.ingredientName, 'Milk');
  assert.equal(createdShoppingItem.quantity, '1L');

  // 6. Toggle shopping item
  await service.toggleShoppingListItem('user-1', 'shop-1', true);
  assert.equal(updatedShoppingItem, 'shop-1');

  // 7. Clear purchased shopping list
  await service.clearPurchasedShoppingList('user-1');
  assert.equal(clearedPurchasedList, true);
});
