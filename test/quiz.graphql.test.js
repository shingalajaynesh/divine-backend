import test from 'node:test';
import assert from 'node:assert/strict';
import { graphql } from 'graphql';
import schema from '../src/gql/schema/index.js';

test('quiz queries require authentication', async () => {
  const result = await graphql({
    schema,
    source: `
      query GetQuiz {
        getDailyQuiz(dayNumber: 15) { questionText options }
      }
    `,
    contextValue: {},
  });
  assert.equal(result.errors?.[0]?.extensions?.code, 'UNAUTHENTICATED');
});

test('quiz mutations require authentication', async () => {
  const result = await graphql({
    schema,
    source: `
      mutation SubmitQuiz {
        submitQuizAnswer(dayNumber: 15, selectedOptionIndex: 2) { id isCorrect }
      }
    `,
    contextValue: {},
  });
  assert.equal(result.errors?.[0]?.extensions?.code, 'UNAUTHENTICATED');
});

test('submitQuizAnswer rejects future day attempts', async () => {
  const tenDaysAgo = new Date();
  tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
  const lmpDateStr = tenDaysAgo.toISOString().split('T')[0];

  const result = await graphql({
    schema,
    source: `
      mutation SubmitQuizFuture {
        submitQuizAnswer(dayNumber: 25, selectedOptionIndex: 1) { id isCorrect }
      }
    `,
    contextValue: {
      viewer: {
        id: 'mother-1',
        lmpDate: lmpDateStr,
        dueDate: null,
      },
      models: {},
      sequelize: {},
    },
  });

  assert.ok(result.errors);
  assert.match(result.errors[0].message, /Cannot submit quiz answers for future days/);
});

test('submitQuizAnswer checks answer correctly and records attempt', async () => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const lmpDateStr = thirtyDaysAgo.toISOString().split('T')[0];

  let findQuestionCalled = false;
  let findAttemptCalled = false;
  let createAttemptCalled = false;

  const result = await graphql({
    schema,
    source: `
      mutation SubmitQuizPast {
        submitQuizAnswer(dayNumber: 10, selectedOptionIndex: 2) {
          id
          dayNumber
          quizQuestionId
          question { id dayNumber }
          selectedOptionIndex
          isCorrect
        }
      }
    `,
    contextValue: {
      viewer: {
        id: 'mother-1',
        lmpDate: lmpDateStr,
        dueDate: null,
      },
      models: {
        QuizQuestion: {
          findByPk: async (id) => {
            assert.equal(id, 'quiz-10');
            return {
              id: 'quiz-10',
              dayNumber: 10,
              correctOptionIndex: 2,
              questionText: 'Question',
              options: ['A', 'B', 'C', 'D'],
              explanation: 'Explanation'
            };
          },
          findOne: async ({ where }) => {
            findQuestionCalled = true;
            assert.equal(where.dayNumber, 10);
            return {
              id: 'quiz-10',
              dayNumber: 10,
              correctOptionIndex: 2
            };
          }
        },
        QuizAttempt: {
          findOne: async ({ where }) => {
            findAttemptCalled = true;
            assert.equal(where.userId, 'mother-1');
            assert.equal(where.dayNumber, 10);
            return null; // Return null so it simulates a new attempt
          },
          create: async (data) => {
            createAttemptCalled = true;
            assert.equal(data.userId, 'mother-1');
            assert.equal(data.quizQuestionId, 'quiz-10');
            assert.equal(data.dayNumber, 10);
            assert.equal(data.selectedOptionIndex, 2);
            assert.equal(data.isCorrect, true);
            return {
              id: 'attempt-1',
              userId: 'mother-1',
              quizQuestionId: 'quiz-10',
              dayNumber: 10,
              selectedOptionIndex: 2,
              isCorrect: true,
              attemptedAt: new Date()
            };
          }
        }
      },
      sequelize: {
        transaction: async (cb) => cb({ LOCK: { UPDATE: 'UPDATE' } })
      },
    },
  });

  assert.equal(result.errors, undefined);
  assert.equal(findQuestionCalled, true);
  assert.equal(findAttemptCalled, true);
  assert.equal(createAttemptCalled, true);
  assert.equal(result.data.submitQuizAnswer.isCorrect, true);
  assert.equal(result.data.submitQuizAnswer.selectedOptionIndex, 2);
  assert.equal(result.data.submitQuizAnswer.quizQuestionId, 'quiz-10');
  assert.equal(result.data.submitQuizAnswer.question.id, 'quiz-10');
});
