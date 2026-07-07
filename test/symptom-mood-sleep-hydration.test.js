import assert from 'node:assert/strict';
import test from 'node:test';
import { graphql } from 'graphql';
import schema from '../src/gql/schema/index.js';

test('Vitals tracking mutation logs and queries mood, sleep, hydration, and nutrition details successfully', async () => {
  const logVitalsMutation = `
    mutation LogVitalsAndSymptoms($input: LogVitalsAndSymptomsInput!) {
      logVitalsAndSymptoms(input: $input) {
        id
        weight
        mood
        sleepHours
        hydrationWater
        nutritionCalories
        nutritionMealNotes
      }
    }
  `;

  const queryVitals = `
    query GetWellnessData {
      getMyVitals {
        id
        weight
        mood
        sleepHours
        hydrationWater
        nutritionCalories
        nutritionMealNotes
      }
    }
  `;

  let storedLog = null;
  const mockModels = {
    VitalsLog: {
      create: async (input) => {
        storedLog = { id: 'vitals-log-777', ...input };
        return storedLog;
      },
      findAll: async () => [storedLog].filter(Boolean)
    },
    Appointment: { findAll: async () => [] },
    MedicineReminder: { findAll: async () => [] },
    HospitalBagItem: { findAll: async () => [] }
  };

  const mockVitalsManager = {
    getVitalsHistory: async (userId) => {
      if (storedLog) {
        return [{
          ...storedLog,
          loggedAt: new Date()
        }];
      }
      return [];
    }
  };

  // 1. Log all wellness parameters
  const resultLog = await graphql({
    schema,
    source: logVitalsMutation,
    contextValue: {
      viewer: { id: 'mother-user-111' },
      models: mockModels,
      sequelize: {},
      vitalsManager: mockVitalsManager
    },
    variableValues: {
      input: {
        weight: 64.5,
        symptoms: ['Nausea', 'Fatigue'],
        mood: 'CALM',
        sleepHours: 8.5,
        hydrationWater: 2.7,
        nutritionCalories: 2100.0,
        nutritionMealNotes: 'Oatmeal with almonds for breakfast, Satvik lunch'
      }
    }
  });

  assert.equal(resultLog.errors, undefined);
  const logged = resultLog.data.logVitalsAndSymptoms;
  assert.equal(logged.weight, 64.5);
  assert.equal(logged.mood, 'CALM');
  assert.equal(logged.sleepHours, 8.5);
  assert.equal(logged.hydrationWater, 2.7);
  assert.equal(logged.nutritionCalories, 2100.0);
  assert.equal(logged.nutritionMealNotes, 'Oatmeal with almonds for breakfast, Satvik lunch');

  // 2. Query logs back
  const resultQuery = await graphql({
    schema,
    source: queryVitals,
    contextValue: {
      viewer: { id: 'mother-user-111' },
      models: mockModels,
      sequelize: {},
      vitalsManager: mockVitalsManager
    }
  });

  assert.equal(resultQuery.errors, undefined);
  const vitalsList = resultQuery.data.getMyVitals;
  assert.equal(vitalsList.length, 1);
  assert.equal(vitalsList[0].mood, 'CALM');
  assert.equal(vitalsList[0].sleepHours, 8.5);
  assert.equal(vitalsList[0].hydrationWater, 2.7);
  assert.equal(vitalsList[0].nutritionCalories, 2100.0);
});
