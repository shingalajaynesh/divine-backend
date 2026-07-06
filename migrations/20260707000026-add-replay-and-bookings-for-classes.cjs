'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Add replay_url to live_classes
    await queryInterface.addColumn('live_classes', 'replay_url', {
      type: Sequelize.STRING,
      allowNull: true
    });

    // 2. Add attended, feedback_score, feedback_notes to class_bookings
    await queryInterface.addColumn('class_bookings', 'attended', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });

    await queryInterface.addColumn('class_bookings', 'feedback_score', {
      type: Sequelize.INTEGER,
      allowNull: true
    });

    await queryInterface.addColumn('class_bookings', 'feedback_notes', {
      type: Sequelize.TEXT,
      allowNull: true
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('class_bookings', 'feedback_notes');
    await queryInterface.removeColumn('class_bookings', 'feedback_score');
    await queryInterface.removeColumn('class_bookings', 'attended');
    await queryInterface.removeColumn('live_classes', 'replay_url');
  }
};
