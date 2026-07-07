'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('vitals_logs', 'mood', {
      type: Sequelize.STRING,
      allowNull: true
    });
    await queryInterface.addColumn('vitals_logs', 'sleep_hours', {
      type: Sequelize.FLOAT,
      allowNull: true
    });
    await queryInterface.addColumn('vitals_logs', 'hydration_water', {
      type: Sequelize.FLOAT,
      allowNull: true
    });
    await queryInterface.addColumn('vitals_logs', 'nutrition_calories', {
      type: Sequelize.FLOAT,
      allowNull: true
    });
    await queryInterface.addColumn('vitals_logs', 'nutrition_meal_notes', {
      type: Sequelize.TEXT,
      allowNull: true
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('vitals_logs', 'mood');
    await queryInterface.removeColumn('vitals_logs', 'sleep_hours');
    await queryInterface.removeColumn('vitals_logs', 'hydration_water');
    await queryInterface.removeColumn('vitals_logs', 'nutrition_calories');
    await queryInterface.removeColumn('vitals_logs', 'nutrition_meal_notes');
  }
};
