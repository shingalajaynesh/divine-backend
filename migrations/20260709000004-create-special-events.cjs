'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('special_events', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false,
        primaryKey: true
      },
      title: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      event_type: {
        type: Sequelize.STRING(40),
        allowNull: false
      },
      event_date: {
        type: Sequelize.DATE,
        allowNull: false
      },
      duration_minutes: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      speaker_name: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      location: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      max_registrations: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      replay_url: {
        type: Sequelize.STRING(255),
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

    await queryInterface.createTable('event_registrations', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false,
        primaryKey: true
      },
      event_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'special_events',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      registered_at: {
        type: Sequelize.DATE,
        allowNull: false
      },
      checked_in: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      checked_in_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      feedback_rating: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      feedback_text: {
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

    // Add unique constraint for a user registering once per event
    await queryInterface.addIndex('event_registrations', ['event_id', 'user_id'], {
      unique: true,
      name: 'unique_user_event_registration'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('event_registrations');
    await queryInterface.dropTable('special_events');
  }
};
