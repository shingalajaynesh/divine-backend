'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Create staff_invitations table
    await queryInterface.createTable('staff_invitations', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false,
        primaryKey: true,
      },
      email_address: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      role_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'roles',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      center_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'centers',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      token: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      status: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'INVITED', // INVITED, PENDING_ACTIVATION, ACTIVE, SUSPENDED, DEACTIVATED, INVITATION_EXPIRED
      },
      expires_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      created_by: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    // 2. Create inventory_movements table
    await queryInterface.createTable('inventory_movements', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false,
        primaryKey: true,
      },
      product_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'products',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      center_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'centers',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      reason_code: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      reason_note: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      quantity_before: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      quantity_change: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      quantity_after: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      reference_type: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      reference_id: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      performed_by: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      request_correlation_id: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    // Indexes
    await queryInterface.addIndex('staff_invitations', ['email_address'], {
      name: 'idx_staff_invitations_email',
    });
    await queryInterface.addIndex('staff_invitations', ['token'], {
      name: 'idx_staff_invitations_token',
    });
    await queryInterface.addIndex('inventory_movements', ['product_id'], {
      name: 'idx_inventory_movements_product',
    });
    await queryInterface.addIndex('inventory_movements', ['center_id'], {
      name: 'idx_inventory_movements_center',
    });
    await queryInterface.addIndex('inventory_movements', ['request_correlation_id'], {
      unique: true,
      name: 'uniq_inventory_movements_request_correlation_id',
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex('inventory_movements', 'uniq_inventory_movements_request_correlation_id');
    await queryInterface.dropTable('inventory_movements');
    await queryInterface.dropTable('staff_invitations');
  },
};
