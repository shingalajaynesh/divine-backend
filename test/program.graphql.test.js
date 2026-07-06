import assert from 'node:assert/strict';
import test from 'node:test';
import { graphql } from 'graphql';
import schema from '../src/gql/schema/index.js';
import { ProgramManager } from '../src/gql/models/programManager.js';

test('programme catalogue requires authentication', async () => {
  const result = await graphql({ schema, source: '{ programCatalog { id name } }', contextValue: {} });
  assert.equal(result.errors?.[0]?.extensions?.code, 'UNAUTHENTICATED');
});

test('authenticated programme catalogue delegates to the secured manager', async () => {
  let called = false;
  const result = await graphql({
    schema,
    source: '{ programCatalog { id name } }',
    contextValue: {
      viewer: { id: 'mother-1', centerId: 'center-1' },
      programManager: {
        getCatalog: async () => {
          called = true;
          return [{ id: 'program-1', name: 'Divine daily foundations' }];
        },
      },
    },
  });
  assert.equal(result.errors, undefined);
  assert.equal(called, true);
  assert.equal(result.data.programCatalog[0].name, 'Divine daily foundations');
});

test('progress updates derive ownership from the verified viewer', async () => {
  let enrollmentLookup;
  let createInput;
  const progress = {
    id: 'progress-1',
    startedAt: null,
    completedAt: null,
    async update(input) { Object.assign(this, input); return this; },
  };
  const models = {
    ProgramActivity: {
      findByPk: async () => ({ id: 'activity-1', isPublished: true, lesson: { module: { programId: 'program-1' } } }),
    },
    ProgramLesson: {},
    ProgramModule: {},
    ProgramEnrollment: {
      findOne: async ({ where }) => {
        enrollmentLookup = where;
        return { id: 'enrollment-1' };
      },
    },
    ActivityProgress: {
      findOrCreate: async (input) => {
        createInput = input;
        return [progress, true];
      },
    },
  };
  const manager = new ProgramManager(models, { id: 'mother-verified' }, { info() {}, error() {} });
  const result = await manager.updateProgress('activity-1', { status: 'completed', durationSeconds: 300 });
  assert.equal(enrollmentLookup.userId, 'mother-verified');
  assert.equal(createInput.defaults.userId, 'mother-verified');
  assert.equal(result.status, 'completed');
  assert.ok(result.completedAt instanceof Date);
});

test('self-service enrollment cannot bypass premium entitlement', async () => {
  const manager = new ProgramManager({
    Program: { findOne: async () => ({ id: 'premium-1', isPremium: true }) },
    ProgramEnrollment: { findOrCreate: async () => { throw new Error('must not run'); } },
  }, { id: 'mother-1' }, { info() {}, error() {} });
  await assert.rejects(() => manager.enroll('premium-1'), { extensions: { code: 'FORBIDDEN' } });
});
