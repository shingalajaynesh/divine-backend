'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('parameters', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false,
        primaryKey: true,
      },
      key: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      value: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      center_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'centers',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
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

    // Add unique index on key + center_id to prevent duplicates
    await queryInterface.addIndex('parameters', ['key', 'center_id'], {
      unique: true,
      name: 'idx_parameters_key_center_unique'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('parameters');
  }
};
