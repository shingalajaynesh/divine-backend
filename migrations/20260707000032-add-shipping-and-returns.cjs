'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Add shipping/logistics tracking columns to store_orders
    await queryInterface.addColumn('store_orders', 'carrier', {
      type: Sequelize.STRING(255),
      allowNull: true
    });
    
    await queryInterface.addColumn('store_orders', 'tracking_number', {
      type: Sequelize.STRING(255),
      allowNull: true
    });

    await queryInterface.addColumn('store_orders', 'estimated_delivery_date', {
      type: Sequelize.DATE,
      allowNull: true
    });

    await queryInterface.addColumn('store_orders', 'shipped_at', {
      type: Sequelize.DATE,
      allowNull: true
    });

    await queryInterface.addColumn('store_orders', 'delivered_at', {
      type: Sequelize.DATE,
      allowNull: true
    });

    // 2. Create store_order_returns table
    await queryInterface.createTable('store_order_returns', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false,
        primaryKey: true
      },
      order_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'store_orders',
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      reason: {
        type: Sequelize.STRING(1000),
        allowNull: false
      },
      status: {
        type: Sequelize.STRING(50),
        allowNull: false,
        defaultValue: 'requested'
      },
      admin_notes: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('store_order_returns');
    await queryInterface.removeColumn('store_orders', 'delivered_at');
    await queryInterface.removeColumn('store_orders', 'shipped_at');
    await queryInterface.removeColumn('store_orders', 'estimated_delivery_date');
    await queryInterface.removeColumn('store_orders', 'tracking_number');
    await queryInterface.removeColumn('store_orders', 'carrier');
  }
};
