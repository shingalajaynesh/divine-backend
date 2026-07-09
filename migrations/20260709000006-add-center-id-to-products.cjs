'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('products', 'center_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'centers',
        key: 'id'
      },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    });

    await queryInterface.addIndex('products', ['center_id']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('products', 'center_id');
  }
};
