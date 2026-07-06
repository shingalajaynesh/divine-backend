'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('content_items', 'trimester_1_safe', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true
    });

    await queryInterface.addColumn('content_items', 'trimester_2_safe', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true
    });

    await queryInterface.addColumn('content_items', 'trimester_3_safe', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true
    });

    await queryInterface.addColumn('content_items', 'contraindications', {
      type: Sequelize.TEXT,
      allowNull: true
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('content_items', 'trimester_1_safe');
    await queryInterface.removeColumn('content_items', 'trimester_2_safe');
    await queryInterface.removeColumn('content_items', 'trimester_3_safe');
    await queryInterface.removeColumn('content_items', 'contraindications');
  }
};
