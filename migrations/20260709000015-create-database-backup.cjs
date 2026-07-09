'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('database_backups', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false,
        primaryKey: true
      },
      file_name: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      backup_size: {
        type: Sequelize.FLOAT,
        allowNull: false,
        defaultValue: 0
      },
      status: {
        type: Sequelize.STRING(50),
        allowNull: false,
        defaultValue: 'SUCCESS'
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

    await queryInterface.addIndex('database_backups', ['status', 'timestamp']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('database_backups');
  }
};
