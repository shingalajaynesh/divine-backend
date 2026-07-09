'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Create report_schedules table
    await queryInterface.createTable('report_schedules', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false,
        primaryKey: true
      },
      template_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'report_templates',
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      frequency: {
        type: Sequelize.ENUM('daily', 'weekly', 'monthly'),
        allowNull: false
      },
      recipient_emails: {
        type: Sequelize.STRING(1000),
        allowNull: false
      },
      next_run_at: {
        type: Sequelize.DATE,
        allowNull: false
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
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

    await queryInterface.addIndex('report_schedules', ['template_id']);

    // 2. Add shared_with_roles column to report_templates table
    await queryInterface.addColumn('report_templates', 'shared_with_roles', {
      type: Sequelize.STRING(500),
      allowNull: true,
      defaultValue: null
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('report_schedules');
    await queryInterface.removeColumn('report_templates', 'shared_with_roles');
  }
};
