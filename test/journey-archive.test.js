import assert from 'node:assert/strict';
import test from 'node:test';
import { graphql } from 'graphql';
import schema from '../src/gql/schema/index.js';

test('Journey Archive and Postpartum Plan resolvers function correctly', async () => {
  const query = `
    query GetJourneyArchiveAndPlan {
      myJourneyArchive {
        pregnancyDay
        weekNumber
        trimesterSummary {
          trimesterNumber
          totalActivitiesCompleted
          vitalsLoggedCount
          averageSleepHours
          averageHydrationWater
          moodFrequencyDistribution {
            mood
            count
          }
        }
      }
      me {
        postpartumPlan
      }
    }
  `;

  const mutation = `
    mutation SavePostpartumPlan($planJson: String!) {
      savePostpartumPlan(planJson: $planJson) {
        id
        postpartumPlan
      }
    }
  `;

  let mockUser = {
    id: 'user-777',
    displayName: 'Swati Patel',
    emailAddress: 'swati@example.com',
    centerId: 'center-100',
    language: 'gu',
    lmpDate: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Day 101, Trimester 2
    dueDate: null,
    postpartumPlan: { deliveryType: 'Vaginal', feedChoice: 'Breastfeeding' },
    save: async function() { return this; }
  };

  const mockModels = {
    User: {
      findByPk: async () => mockUser
    },
    DailyProgress: {
      findAll: async () => [
        { dayNumber: 10, pqCompleted: true, iqCompleted: true, eqCompleted: false, sqCompleted: false }, // T1 (2 completed)
        { dayNumber: 95, pqCompleted: true, iqCompleted: true, eqCompleted: true, sqCompleted: true } // T2 (4 completed)
      ]
    },
    VitalsLog: {
      findAll: async () => [
        { 
          loggedAt: new Date(new Date(mockUser.lmpDate).getTime() + 9 * 24 * 60 * 60 * 1000).toISOString(), // T1
          sleepHours: 8,
          hydrationWater: 2000,
          mood: 'HAPPY'
        },
        { 
          loggedAt: new Date(new Date(mockUser.lmpDate).getTime() + 94 * 24 * 60 * 60 * 1000).toISOString(), // T2
          sleepHours: 7,
          hydrationWater: 1500,
          mood: 'HAPPY'
        }
      ]
    }
  };

  // 1. Run Query
  const result = await graphql({
    schema,
    source: query,
    contextValue: {
      viewer: mockUser,
      models: mockModels,
      sequelize: {}
    }
  });

  assert.equal(result.errors, undefined);
  const archive = result.data.myJourneyArchive;
  assert.equal(archive.pregnancyDay, 102);
  assert.equal(archive.weekNumber, 15);
  
  const t1 = archive.trimesterSummary.find(s => s.trimesterNumber === 1);
  assert.equal(t1.totalActivitiesCompleted, 2);
  assert.equal(t1.vitalsLoggedCount, 1);
  assert.equal(t1.averageSleepHours, 8);
  assert.equal(t1.averageHydrationWater, 2000);
  assert.equal(t1.moodFrequencyDistribution[0].mood, 'HAPPY');

  const me = result.data.me;
  assert.equal(JSON.parse(me.postpartumPlan).deliveryType, 'Vaginal');

  // 2. Run Save Postpartum Mutation
  const mutResult = await graphql({
    schema,
    source: mutation,
    variableValues: {
      planJson: JSON.stringify({ deliveryType: 'C-Section', feedChoice: 'Formula' })
    },
    contextValue: {
      viewer: mockUser,
      models: mockModels,
      sequelize: {}
    }
  });

  assert.equal(mutResult.errors, undefined);
  assert.equal(JSON.parse(mutResult.data.savePostpartumPlan.postpartumPlan).deliveryType, 'C-Section');
});
