'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('query_performance_audits', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false,
        primaryKey: true
      },
      sql_query: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      duration_ms: {
        type: Sequelize.FLOAT,
        allowNull: false
      },
      threshold_ms: {
        type: Sequelize.FLOAT,
        allowNull: false
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

    await queryInterface.addIndex('query_performance_audits', ['duration_ms', 'timestamp']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('query_performance_audits');
  }
};
