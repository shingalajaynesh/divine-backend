'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Create counseling_leads table
    await queryInterface.createTable('counseling_leads', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false,
        primaryKey: true
      },
      name: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      email: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      phone: {
        type: Sequelize.STRING(50),
        allowNull: false
      },
      status: {
        type: Sequelize.STRING(50),
        allowNull: false,
        defaultValue: 'new' // new, contacted, scheduled, converted, lost
      },
      source: {
        type: Sequelize.STRING(100),
        allowNull: false,
        defaultValue: 'web'
      },
      assigned_to: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      converted_user_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      next_follow_up: {
        type: Sequelize.DATE,
        allowNull: true
      },
      converted_at: {
        type: Sequelize.DATE,
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

    // 2. Create counseling_calls table
    await queryInterface.createTable('counseling_calls', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false,
        primaryKey: true
      },
      lead_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'counseling_leads',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      scheduled_at: {
        type: Sequelize.DATE,
        allowNull: false
      },
      status: {
        type: Sequelize.STRING(50),
        allowNull: false,
        defaultValue: 'scheduled' // scheduled, completed, no_show, cancelled
      },
      duration_minutes: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      outcome: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      counselor_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
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

    // Seed initial demo leads
    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 2);

    await queryInterface.bulkInsert('counseling_leads', [
      {
        id: 'a9cb080b-df0e-436d-9273-9a3d6f1d248a',
        name: 'Aishwarya Rai',
        email: 'aishwarya@example.com',
        phone: '+919999888877',
        status: 'new',
        source: 'inquiry',
        created_at: now,
        updated_at: now
      },
      {
        id: 'a9cb080b-df0e-436d-9273-9a3d6f1d248b',
        name: 'Kareena Kapoor',
        email: 'kareena@example.com',
        phone: '+918888777766',
        status: 'scheduled',
        source: 'web',
        next_follow_up: futureDate,
        created_at: now,
        updated_at: now
      }
    ]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('counseling_calls');
    await queryInterface.dropTable('counseling_leads');
  }
};
