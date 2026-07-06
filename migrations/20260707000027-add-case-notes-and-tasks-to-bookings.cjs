'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('consultation_bookings', 'case_notes', {
      type: Sequelize.TEXT,
      allowNull: true
    });

    await queryInterface.addColumn('consultation_bookings', 'follow_up_tasks', {
      type: Sequelize.TEXT,
      allowNull: true
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('consultation_bookings', 'follow_up_tasks');
    await queryInterface.removeColumn('consultation_bookings', 'case_notes');
  }
};
