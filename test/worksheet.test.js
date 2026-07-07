import assert from 'node:assert/strict';
import test from 'node:test';
import { graphql } from 'graphql';
import schema from '../src/gql/schema/index.js';

test('Worksheet Submissions and Grading resolvers work successfully', async () => {
  const query = `
    query GetWorksheetSubmissions {
      getWorksheetSubmissions {
        id
        userId
        userDisplayName
        title
        fileUrl
        score
        feedback
        status
      }
    }
  `;

  const mutation = `
    mutation GradeWorksheetSubmission($id: ID!, $score: Int!, $feedback: String!) {
      gradeWorksheetSubmission(id: $id, score: $score, feedback: $feedback) {
        id
        score
        feedback
        status
      }
    }
  `;

  const viewer = { id: 'staff-1', role: { roleType: 'STAFF' }, centerId: 'center-100' };

  // 1. Fetch worksheet submissions
  const queryResult = await graphql({
    schema,
    source: query,
    contextValue: { viewer, models: {}, sequelize: {} }
  });

  assert.equal(queryResult.errors, undefined);
  const submissions = queryResult.data.getWorksheetSubmissions;
  assert.ok(submissions.length >= 2);
  const work1 = submissions.find(s => s.id === 'work-1');
  assert.equal(work1.status, 'pending');

  // 2. Grade a pending submission
  const mutationResult = await graphql({
    schema,
    source: mutation,
    variableValues: {
      id: 'work-1',
      score: 95,
      feedback: 'Excellent work and reflections!'
    },
    contextValue: { viewer, models: {}, sequelize: {} }
  });

  assert.equal(mutationResult.errors, undefined);
  const graded = mutationResult.data.gradeWorksheetSubmission;
  assert.equal(graded.id, 'work-1');
  assert.equal(graded.score, 95);
  assert.equal(graded.feedback, 'Excellent work and reflections!');
  assert.equal(graded.status, 'reviewed');
});
