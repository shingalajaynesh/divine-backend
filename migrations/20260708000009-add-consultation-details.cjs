'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('consultation_bookings', 'intake_form', {
      type: Sequelize.JSONB,
      allowNull: true
    });
    await queryInterface.addColumn('consultation_bookings', 'prescriptions', {
      type: Sequelize.JSONB,
      allowNull: true
    });
    await queryInterface.addColumn('consultation_bookings', 'documents', {
      type: Sequelize.JSONB,
      allowNull: true
    });
    await queryInterface.addColumn('consultation_bookings', 'follow_up_date', {
      type: Sequelize.DATEONLY,
      allowNull: true
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('consultation_bookings', 'follow_up_date');
    await queryInterface.removeColumn('consultation_bookings', 'documents');
    await queryInterface.removeColumn('consultation_bookings', 'prescriptions');
    await queryInterface.removeColumn('consultation_bookings', 'intake_form');
  }
};
