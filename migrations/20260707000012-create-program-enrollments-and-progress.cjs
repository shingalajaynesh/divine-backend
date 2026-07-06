'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('program_enrollments', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.UUIDV4 },
      user_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      program_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'programs', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'active' },
      source: { type: Sequelize.STRING(30), allowNull: false, defaultValue: 'manual' },
      enrolled_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      started_at: { type: Sequelize.DATE, allowNull: true },
      completed_at: { type: Sequelize.DATE, allowNull: true },
      access_starts_at: { type: Sequelize.DATE, allowNull: true },
      access_ends_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      deleted_at: { type: Sequelize.DATE, allowNull: true },
    });
    await queryInterface.addIndex('program_enrollments', ['user_id', 'program_id'], { unique: true });
    await queryInterface.addIndex('program_enrollments', ['user_id', 'status']);
    await queryInterface.addIndex('program_enrollments', ['program_id', 'status']);
    await queryInterface.addConstraint('program_enrollments', { fields: ['status'], type: 'check', where: { status: ['active', 'paused', 'completed', 'cancelled'] }, name: 'program_enrollments_status_allowed' });
    await queryInterface.addConstraint('program_enrollments', { fields: ['access_starts_at', 'access_ends_at'], type: 'check', where: { [Sequelize.Op.or]: [{ access_ends_at: null }, { access_starts_at: null }, Sequelize.where(Sequelize.col('access_ends_at'), '>', Sequelize.col('access_starts_at'))] }, name: 'program_enrollments_access_window_valid' });

    await queryInterface.createTable('activity_progress', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.UUIDV4 },
      enrollment_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'program_enrollments', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      user_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      activity_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'program_activities', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'not_started' },
      attempts: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      score: { type: Sequelize.DECIMAL(5, 2), allowNull: true },
      duration_seconds: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      last_position_seconds: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      notes: { type: Sequelize.TEXT, allowNull: true },
      evidence_url: { type: Sequelize.STRING(1000), allowNull: true },
      started_at: { type: Sequelize.DATE, allowNull: true },
      completed_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });
    await queryInterface.addIndex('activity_progress', ['enrollment_id', 'activity_id'], { unique: true });
    await queryInterface.addIndex('activity_progress', ['user_id', 'status']);
    await queryInterface.addIndex('activity_progress', ['activity_id', 'status']);
    await queryInterface.addConstraint('activity_progress', { fields: ['status'], type: 'check', where: { status: ['not_started', 'in_progress', 'completed', 'skipped'] }, name: 'activity_progress_status_allowed' });
    await queryInterface.addConstraint('activity_progress', { fields: ['attempts'], type: 'check', where: { attempts: { [Sequelize.Op.gte]: 0 } }, name: 'activity_progress_attempts_nonnegative' });
    await queryInterface.addConstraint('activity_progress', { fields: ['score'], type: 'check', where: { [Sequelize.Op.or]: [{ score: null }, { score: { [Sequelize.Op.between]: [0, 100] } }] }, name: 'activity_progress_score_range' });
    await queryInterface.addConstraint('activity_progress', { fields: ['duration_seconds'], type: 'check', where: { duration_seconds: { [Sequelize.Op.gte]: 0 } }, name: 'activity_progress_duration_nonnegative' });
    await queryInterface.addConstraint('activity_progress', { fields: ['last_position_seconds'], type: 'check', where: { last_position_seconds: { [Sequelize.Op.gte]: 0 } }, name: 'activity_progress_position_nonnegative' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('activity_progress');
    await queryInterface.dropTable('program_enrollments');
  },
};
