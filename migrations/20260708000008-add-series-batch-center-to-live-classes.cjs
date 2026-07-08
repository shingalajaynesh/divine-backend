'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('live_classes', 'center_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'centers', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });
    await queryInterface.addColumn('live_classes', 'series_title', {
      type: Sequelize.STRING,
      allowNull: true
    });
    await queryInterface.addColumn('live_classes', 'batch_name', {
      type: Sequelize.STRING,
      allowNull: true
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('live_classes', 'batch_name');
    await queryInterface.removeColumn('live_classes', 'series_title');
    await queryInterface.removeColumn('live_classes', 'center_id');
  }
};
