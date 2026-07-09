'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('replication_statuses', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false,
        primaryKey: true
      },
      node_name: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      role: {
        type: Sequelize.STRING(50),
        allowNull: false
      },
      lag_ms: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      is_healthy: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      timestamp: {
        type: Sequelize.DATE,
        allowNull: false
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

    await queryInterface.addIndex('replication_statuses', ['node_name', 'timestamp']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('replication_statuses');
  }
};
