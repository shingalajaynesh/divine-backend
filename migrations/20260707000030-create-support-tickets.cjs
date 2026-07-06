'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Create support_tickets table
    await queryInterface.createTable('support_tickets', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false,
        primaryKey: true
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      subject: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      status: {
        type: Sequelize.STRING(50),
        allowNull: false,
        defaultValue: 'open'
      },
      priority: {
        type: Sequelize.STRING(50),
        allowNull: false,
        defaultValue: 'medium'
      },
      category: {
        type: Sequelize.STRING(100),
        allowNull: false,
        defaultValue: 'general'
      },
      satisfaction_score: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      satisfaction_feedback: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      whatsapp_handoff_requested: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      sla_breached: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      sla_expires_at: {
        type: Sequelize.DATE,
        allowNull: false
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

    // 2. Create support_ticket_messages table
    await queryInterface.createTable('support_ticket_messages', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false,
        primaryKey: true
      },
      ticket_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'support_tickets',
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      sender_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      sender_type: {
        type: Sequelize.STRING(50),
        allowNull: false,
        defaultValue: 'user'
      },
      message: {
        type: Sequelize.TEXT,
        allowNull: false
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
    await queryInterface.dropTable('support_ticket_messages');
    await queryInterface.dropTable('support_tickets');
  }
};
