'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('partner_activity_logs', 'assigned_task_title', {
      type: Sequelize.STRING,
      allowNull: true
    });
    await queryInterface.addColumn('partner_activity_logs', 'assigned_task_desc', {
      type: Sequelize.TEXT,
      allowNull: true
    });
    await queryInterface.addColumn('partner_activity_logs', 'partner_response', {
      type: Sequelize.TEXT,
      allowNull: true
    });
    await queryInterface.addColumn('partner_activity_logs', 'family_notes', {
      type: Sequelize.TEXT,
      allowNull: true
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('partner_activity_logs', 'assigned_task_title');
    await queryInterface.removeColumn('partner_activity_logs', 'assigned_task_desc');
    await queryInterface.removeColumn('partner_activity_logs', 'partner_response');
    await queryInterface.removeColumn('partner_activity_logs', 'family_notes');
  }
};
