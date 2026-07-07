import assert from 'node:assert/strict';
import test from 'node:test';
import { graphql } from 'graphql';
import schema from '../src/gql/schema/index.js';

test('Recommendation engine generates personalized recommendations based on trimester, tracked logs, and subscription', async () => {
  const query = `
    query GetMyRecommendations {
      myRecommendations {
        id
        title
        description
        category
        icon
        actionLink
        isPremium
        unlocked
      }
    }
  `;

  let latestVitals = null;
  let mockSubscription = null;

  const mockModels = {
    User: {
      findByPk: async (id) => {
        // Mocking user in trimester 1 (LMP 30 days ago)
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        return {
          id,
          lmpDate: thirtyDaysAgo.toISOString().split('T')[0],
          dueDate: null
        };
      }
    },
    VitalsLog: {
      findOne: async () => latestVitals
    },
    UserSubscription: {
      findOne: async () => mockSubscription
    }
  };

  // Scenario 1: Free user, trimester 1, low sleep & nausea symptoms
  latestVitals = {
    symptoms: JSON.stringify(['Nausea', 'Insomnia']),
    sleepHours: 5.5,
    hydrationWater: 2.0
  };
  mockSubscription = null; // Free user

  const result1 = await graphql({
    schema,
    source: query,
    contextValue: {
      viewer: { id: 'mother-1' },
      models: mockModels,
      sequelize: {}
    }
  });

  assert.equal(result1.errors, undefined);
  const recs1 = result1.data.myRecommendations;

  // Check plan entitlement recommendation (CTA to upgrade)
  const upgradeCta = recs1.find(r => r.id === 'cta-upgrade');
  assert.ok(upgradeCta);
  assert.equal(upgradeCta.category, 'CALL_TO_ACTION');

  // Check trimester 1 recommendation
  const trim1Diet = recs1.find(r => r.id === 'trim1-diet');
  assert.ok(trim1Diet);
  
  // Premium recommendation should be locked
  const premiumYoga = recs1.find(r => r.id === 'trim1-premium-yoga');
  assert.ok(premiumYoga);
  assert.equal(premiumYoga.unlocked, false);

  // Check symptom-based recommendations (Nausea & Insomnia sleep)
  const nauseaRec = recs1.find(r => r.id === 'symptom-nausea');
  assert.ok(nauseaRec);
  const insomniaRec = recs1.find(r => r.id === 'symptom-insomnia');
  assert.ok(insomniaRec);
  const hydrationRec = recs1.find(r => r.id === 'hydration-low');
  assert.ok(hydrationRec);


  // Scenario 2: Premium user, trimester 2, happy mood
  mockModels.User.findByPk = async (id) => {
    // Trimester 2 (LMP 120 days ago)
    const lmp = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000);
    return {
      id,
      lmpDate: lmp.toISOString().split('T')[0],
      dueDate: null
    };
  };

  latestVitals = {
    symptoms: '[]',
    mood: 'HAPPY',
    sleepHours: 8.0,
    hydrationWater: 3.0
  };
  mockSubscription = {
    status: 'active',
    plan: { id: 'plan-premium', name: 'Premium Plan' }
  };

  const result2 = await graphql({
    schema,
    source: query,
    contextValue: {
      viewer: { id: 'mother-1' },
      models: mockModels,
      sequelize: {}
    }
  });

  assert.equal(result2.errors, undefined);
  const recs2 = result2.data.myRecommendations;

  // Premium user should NOT see the CTA to upgrade
  const upgradeCta2 = recs2.find(r => r.id === 'cta-upgrade');
  assert.equal(upgradeCta2, undefined);

  // Check trimester 2 recommendation
  const trim2Diet = recs2.find(r => r.id === 'trim2-diet');
  assert.ok(trim2Diet);

  // Premium webinar should be unlocked
  const premiumWebinar = recs2.find(r => r.id === 'trim2-premium-webinar');
  assert.ok(premiumWebinar);
  assert.equal(premiumWebinar.unlocked, true);

  // Should NOT see nausea/insomnia/low hydration recommendations
  assert.equal(recs2.find(r => r.id === 'symptom-nausea'), undefined);
  assert.equal(recs2.find(r => r.id === 'symptom-insomnia'), undefined);
});
