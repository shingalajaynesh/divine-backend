'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('inquiries', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.UUIDV4 },
      name: { type: Sequelize.STRING(150), allowNull: false },
      email: { type: Sequelize.STRING(254), allowNull: true },
      phone: { type: Sequelize.STRING(20), allowNull: false },
      city: { type: Sequelize.STRING(120), allowNull: false },
      language: { type: Sequelize.STRING(10), allowNull: false, defaultValue: 'en' },
      preferred_call_time: { type: Sequelize.STRING(80), allowNull: true },
      message: { type: Sequelize.TEXT, allowNull: true },
      source: { type: Sequelize.STRING(50), allowNull: false, defaultValue: 'marketing_website' },
      status: {
        type: Sequelize.ENUM('pending', 'in_progress', 'resolved', 'closed'),
        allowNull: false,
        defaultValue: 'pending',
      },
      center_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'centers', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      assigned_to: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      deleted_at: { type: Sequelize.DATE, allowNull: true },
    });

    await queryInterface.addIndex('inquiries', ['status', 'created_at']);
    await queryInterface.addIndex('inquiries', ['center_id', 'status']);
    await queryInterface.addIndex('inquiries', ['phone']);

    await queryInterface.createTable('inquiry_responses', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.UUIDV4 },
      inquiry_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'inquiries', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      author_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      content: { type: Sequelize.TEXT, allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });

    await queryInterface.addIndex('inquiry_responses', ['inquiry_id', 'created_at']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('inquiry_responses');
    await queryInterface.dropTable('inquiries');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_inquiries_status";');
  },
};
