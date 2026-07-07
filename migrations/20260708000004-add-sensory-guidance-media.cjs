'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('sensory_activities', 'guidance_en', {
      type: Sequelize.TEXT,
      allowNull: true
    });
    await queryInterface.addColumn('sensory_activities', 'guidance_hi', {
      type: Sequelize.TEXT,
      allowNull: true
    });
    await queryInterface.addColumn('sensory_activities', 'media_links', {
      type: Sequelize.TEXT,
      allowNull: true
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('sensory_activities', 'guidance_en');
    await queryInterface.removeColumn('sensory_activities', 'guidance_hi');
    await queryInterface.removeColumn('sensory_activities', 'media_links');
  }
};
