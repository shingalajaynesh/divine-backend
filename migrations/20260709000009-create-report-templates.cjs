'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('report_templates', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false,
        primaryKey: true
      },
      title: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      role: {
        type: Sequelize.ENUM('MOTHER', 'PARTNER', 'CENTER', 'FRANCHISE', 'STAFF', 'PLATFORM'),
        allowNull: false
      },
      filters: {
        type: Sequelize.JSONB,
        allowNull: true
      },
      widgets: {
        type: Sequelize.JSONB,
        allowNull: false
      },
      created_by: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false
      }
    });

    await queryInterface.addIndex('report_templates', ['role']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('report_templates');
  }
};
