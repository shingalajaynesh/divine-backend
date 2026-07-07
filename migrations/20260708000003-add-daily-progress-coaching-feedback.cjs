'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('daily_progress', 'pq_feedback', {
      type: Sequelize.TEXT,
      allowNull: true
    });
    await queryInterface.addColumn('daily_progress', 'iq_feedback', {
      type: Sequelize.TEXT,
      allowNull: true
    });
    await queryInterface.addColumn('daily_progress', 'eq_feedback', {
      type: Sequelize.TEXT,
      allowNull: true
    });
    await queryInterface.addColumn('daily_progress', 'sq_feedback', {
      type: Sequelize.TEXT,
      allowNull: true
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('daily_progress', 'pq_feedback');
    await queryInterface.removeColumn('daily_progress', 'iq_feedback');
    await queryInterface.removeColumn('daily_progress', 'eq_feedback');
    await queryInterface.removeColumn('daily_progress', 'sq_feedback');
  }
};
