'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('programs', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.UUIDV4 },
      center_id: { type: Sequelize.UUID, allowNull: true, references: { model: 'centers', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
      slug: { type: Sequelize.STRING(120), allowNull: false, unique: true },
      name: { type: Sequelize.STRING(180), allowNull: false },
      summary: { type: Sequelize.TEXT, allowNull: true },
      cover_url: { type: Sequelize.STRING(1000), allowNull: true },
      language: { type: Sequelize.STRING(10), allowNull: false, defaultValue: 'en' },
      journey_stage: { type: Sequelize.STRING(30), allowNull: false, defaultValue: 'pregnancy' },
      status: { type: Sequelize.ENUM('draft', 'published', 'archived'), allowNull: false, defaultValue: 'draft' },
      is_premium: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      sort_order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      deleted_at: { type: Sequelize.DATE, allowNull: true },
    });
    await queryInterface.addIndex('programs', ['status', 'language', 'sort_order']);
    await queryInterface.addIndex('programs', ['center_id', 'status']);

    await queryInterface.createTable('program_modules', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.UUIDV4 },
      program_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'programs', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      title: { type: Sequelize.STRING(180), allowNull: false },
      description: { type: Sequelize.TEXT, allowNull: true },
      cover_url: { type: Sequelize.STRING(1000), allowNull: true },
      sort_order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      unlock_day: { type: Sequelize.INTEGER, allowNull: true },
      is_published: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      deleted_at: { type: Sequelize.DATE, allowNull: true },
    });
    await queryInterface.addIndex('program_modules', ['program_id', 'sort_order']);
    await queryInterface.addIndex('program_modules', ['program_id', 'is_published']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('program_modules');
    await queryInterface.dropTable('programs');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_programs_status";');
  },
};
