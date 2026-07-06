import assert from 'node:assert/strict';
import test from 'node:test';
import { DataModels } from 'divine-data-models';

const logger = { info() {}, warn() {}, error() {} };

const createModels = () => {
  const dataModels = new DataModels(logger);
  dataModels.init({
    database: 'model_contract_test',
    dbUser: 'model_contract_test',
    dbPassword: 'model_contract_test',
    host: '127.0.0.1',
    dialect: 'postgres',
    pool: { max: 1, min: 0 },
  });
  return { sequelize: dataModels.sequelize, models: dataModels.models };
};

test('programme hierarchy exposes the expected associations', async () => {
  const { sequelize, models } = createModels();
  try {
    assert.equal(models.Program.associations.modules.target, models.ProgramModule);
    assert.equal(models.ProgramModule.associations.lessons.target, models.ProgramLesson);
    assert.equal(models.ProgramLesson.associations.activities.target, models.ProgramActivity);
    assert.equal(models.Program.associations.enrollments.target, models.ProgramEnrollment);
    assert.equal(models.ProgramEnrollment.associations.activityProgress.target, models.ActivityProgress);
  } finally {
    await sequelize.close();
  }
});

test('enrollment contract protects completion and access-window state', async () => {
  const { sequelize, models } = createModels();
  try {
    await models.ProgramEnrollment.build({
      userId: 'fc655bbc-d851-4f78-9955-08f86f5ac9fd',
      programId: '6aef5b42-ed1a-477e-925f-bff9eb93b6b1',
      status: 'active',
      accessStartsAt: new Date('2026-07-01T00:00:00Z'),
      accessEndsAt: new Date('2027-07-01T00:00:00Z'),
    }).validate();

    await assert.rejects(
      models.ProgramEnrollment.build({ userId: 'fc655bbc-d851-4f78-9955-08f86f5ac9fd', programId: '6aef5b42-ed1a-477e-925f-bff9eb93b6b1', status: 'completed' }).validate(),
      /completedAt/,
    );
  } finally {
    await sequelize.close();
  }
});

test('activity progress contract validates completion and score state', async () => {
  const { sequelize, models } = createModels();
  try {
    await models.ActivityProgress.build({
      enrollmentId: '6ccfd612-a16b-444b-82bd-e4dafdc5a64e',
      userId: 'fc655bbc-d851-4f78-9955-08f86f5ac9fd',
      activityId: 'b8c3a95e-44b8-459d-8c83-33bd6088110e',
      status: 'in_progress',
      score: 75,
      attempts: 1,
    }).validate();

    await assert.rejects(
      models.ActivityProgress.build({ enrollmentId: '6ccfd612-a16b-444b-82bd-e4dafdc5a64e', userId: 'fc655bbc-d851-4f78-9955-08f86f5ac9fd', activityId: 'b8c3a95e-44b8-459d-8c83-33bd6088110e', status: 'completed', score: 120 }).validate(),
      /Validation error|completedAt/,
    );
  } finally {
    await sequelize.close();
  }
});

test('lesson contract validates types and pregnancy-day boundaries', async () => {
  const { sequelize, models } = createModels();
  try {
    await models.ProgramLesson.build({
      moduleId: '3f71e763-e080-4c9d-8c12-aa780ac966f6',
      slug: 'mindful-breathing',
      title: 'Mindful breathing',
      lessonType: 'practice',
      releaseDay: 120,
    }).validate();

    await assert.rejects(
      models.ProgramLesson.build({ moduleId: '3f71e763-e080-4c9d-8c12-aa780ac966f6', slug: 'invalid', title: 'Invalid', lessonType: 'unknown', releaseDay: 281 }).validate(),
      /Validation error/,
    );
  } finally {
    await sequelize.close();
  }
});

test('activity contract validates quotient, duration, and points', async () => {
  const { sequelize, models } = createModels();
  try {
    await models.ProgramActivity.build({
      lessonId: '7152ea4b-4e13-44dc-a55f-3c11be9c86d7',
      slug: 'five-calm-breaths',
      title: 'Five calm breaths',
      instructions: 'Sit safely and take five comfortable breaths.',
      quotient: 'EQ',
      activityType: 'practice',
      estimatedMins: 5,
      points: 10,
    }).validate();

    await assert.rejects(
      models.ProgramActivity.build({ lessonId: '7152ea4b-4e13-44dc-a55f-3c11be9c86d7', slug: 'invalid', title: 'Invalid', instructions: 'Invalid', quotient: 'BAD', estimatedMins: 0, points: -1 }).validate(),
      /Validation error/,
    );
  } finally {
    await sequelize.close();
  }
});
