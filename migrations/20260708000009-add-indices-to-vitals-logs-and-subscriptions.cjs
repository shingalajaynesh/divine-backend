'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addIndex('vitals_logs', ['user_id']);
    await queryInterface.addIndex('user_subscriptions', ['user_id']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('vitals_logs', ['user_id']);
    await queryInterface.removeIndex('user_subscriptions', ['user_id']);
  }
};
