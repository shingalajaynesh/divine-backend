'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('vitals_logs', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false,
        primaryKey: true,
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      weight: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: true,
      },
      systolic_bp: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      diastolic_bp: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      kick_count: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      blood_sugar: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: true,
      },
      logged_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      deleted_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
    });

    await queryInterface.addIndex('vitals_logs', ['user_id', 'logged_at']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('vitals_logs');
  },
};
