'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('financial_transactions', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false,
        primaryKey: true
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE'
      },
      center_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'centers',
          key: 'id'
        },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE'
      },
      amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
      },
      type: {
        type: Sequelize.ENUM('payment', 'refund', 'settlement', 'reconciliation'),
        allowNull: false
      },
      status: {
        type: Sequelize.STRING(50),
        allowNull: false,
        defaultValue: 'completed'
      },
      center_share: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00
      },
      platform_share: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00
      },
      payment_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'payments',
          key: 'id'
        },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE'
      },
      invoice_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'invoices',
          key: 'id'
        },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE'
      },
      reconciled_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      reconciliation_notes: {
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

    await queryInterface.addIndex('financial_transactions', ['center_id']);
    await queryInterface.addIndex('financial_transactions', ['type']);
    await queryInterface.addIndex('financial_transactions', ['payment_id']);
    await queryInterface.addIndex('financial_transactions', ['invoice_id']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('financial_transactions');
  }
};
