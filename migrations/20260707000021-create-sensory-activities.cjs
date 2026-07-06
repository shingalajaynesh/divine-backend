'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const stamps = {
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW')
      }
    };

    // 1. Create sensory_activities table
    await queryInterface.createTable('sensory_activities', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false
      },
      day_number: {
        type: Sequelize.INTEGER,
        allowNull: false,
        unique: true
      },
      sense_type: {
        type: Sequelize.STRING,
        allowNull: false
      },
      title_en: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      title_hi: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      description_en: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      description_hi: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      ...stamps
    });

    // 2. Create sensory_activity_logs table
    await queryInterface.createTable('sensory_activity_logs', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      day_number: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      completed: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      completed_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      ...stamps
    });

    // Unique index on user sensory logs for a specific day
    await queryInterface.addIndex('sensory_activity_logs', ['user_id', 'day_number'], {
      unique: true
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('sensory_activity_logs');
    await queryInterface.dropTable('sensory_activities');
  }
};
