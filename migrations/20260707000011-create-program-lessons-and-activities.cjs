'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('program_lessons', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.UUIDV4 },
      module_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'program_modules', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      slug: { type: Sequelize.STRING(120), allowNull: false },
      title: { type: Sequelize.STRING(180), allowNull: false },
      summary: { type: Sequelize.TEXT, allowNull: true },
      lesson_type: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'mixed' },
      duration_mins: { type: Sequelize.INTEGER, allowNull: true },
      release_day: { type: Sequelize.INTEGER, allowNull: true },
      sort_order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      is_published: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      deleted_at: { type: Sequelize.DATE, allowNull: true },
    });
    await queryInterface.addIndex('program_lessons', ['module_id', 'slug'], { unique: true });
    await queryInterface.addIndex('program_lessons', ['module_id', 'is_published', 'sort_order']);
    await queryInterface.addConstraint('program_lessons', { fields: ['lesson_type'], type: 'check', where: { lesson_type: ['article', 'audio', 'video', 'live', 'practice', 'mixed'] }, name: 'program_lessons_type_allowed' });
    await queryInterface.addConstraint('program_lessons', { fields: ['release_day'], type: 'check', where: { release_day: { [Sequelize.Op.or]: [{ [Sequelize.Op.eq]: null }, { [Sequelize.Op.between]: [1, 280] }] } }, name: 'program_lessons_release_day_range' });
    await queryInterface.addConstraint('program_lessons', { fields: ['duration_mins'], type: 'check', where: { duration_mins: { [Sequelize.Op.or]: [{ [Sequelize.Op.eq]: null }, { [Sequelize.Op.between]: [0, 1440] }] } }, name: 'program_lessons_duration_range' });

    await queryInterface.createTable('program_activities', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.UUIDV4 },
      lesson_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'program_lessons', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      slug: { type: Sequelize.STRING(120), allowNull: false },
      title: { type: Sequelize.STRING(180), allowNull: false },
      instructions: { type: Sequelize.TEXT, allowNull: false },
      quotient: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'GENERAL' },
      activity_type: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'practice' },
      media_url: { type: Sequelize.STRING(1000), allowNull: true },
      estimated_mins: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 10 },
      requires_submission: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      points: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      sort_order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      is_published: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      deleted_at: { type: Sequelize.DATE, allowNull: true },
    });
    await queryInterface.addIndex('program_activities', ['lesson_id', 'slug'], { unique: true });
    await queryInterface.addIndex('program_activities', ['lesson_id', 'is_published', 'sort_order']);
    await queryInterface.addIndex('program_activities', ['quotient', 'activity_type']);
    await queryInterface.addConstraint('program_activities', { fields: ['quotient'], type: 'check', where: { quotient: ['PQ', 'IQ', 'EQ', 'SQ', 'WELLNESS', 'GENERAL'] }, name: 'program_activities_quotient_allowed' });
    await queryInterface.addConstraint('program_activities', { fields: ['activity_type'], type: 'check', where: { activity_type: ['practice', 'puzzle', 'quiz', 'reflection', 'media', 'offline'] }, name: 'program_activities_type_allowed' });
    await queryInterface.addConstraint('program_activities', { fields: ['estimated_mins'], type: 'check', where: { estimated_mins: { [Sequelize.Op.between]: [1, 480] } }, name: 'program_activities_estimated_mins_range' });
    await queryInterface.addConstraint('program_activities', { fields: ['points'], type: 'check', where: { points: { [Sequelize.Op.between]: [0, 10000] } }, name: 'program_activities_points_range' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('program_activities');
    await queryInterface.dropTable('program_lessons');
  },
};
