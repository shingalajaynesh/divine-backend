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

    // 1. Create user_streaks table
    await queryInterface.createTable('user_streaks', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        unique: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      current_streak: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      longest_streak: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      last_completed_date: {
        type: Sequelize.DATEONLY,
        allowNull: true
      },
      ...stamps
    });

    // 2. Create user_achievements table
    await queryInterface.createTable('user_achievements', {
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
      badge_key: {
        type: Sequelize.STRING,
        allowNull: false
      },
      unlocked_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW')
      },
      ...stamps
    });

    // Indexes
    await queryInterface.addIndex('user_achievements', ['user_id', 'badge_key'], {
      unique: true
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('user_achievements');
    await queryInterface.dropTable('user_streaks');
  }
};
