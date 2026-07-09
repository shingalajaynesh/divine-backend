'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Create system_settings table
    await queryInterface.createTable('system_settings', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false,
        primaryKey: true
      },
      key: {
        type: Sequelize.STRING(255),
        allowNull: false,
        unique: true
      },
      value: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      description: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      updated_by: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE'
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

    await queryInterface.addIndex('system_settings', ['key']);

    // 2. Create feature_flags table
    await queryInterface.createTable('feature_flags', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false,
        primaryKey: true
      },
      name: {
        type: Sequelize.STRING(255),
        allowNull: false,
        unique: true
      },
      description: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      is_enabled: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      rules: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: null
      },
      updated_by: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE'
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

    await queryInterface.addIndex('feature_flags', ['name']);

    // 3. Create locale_strings table
    await queryInterface.createTable('locale_strings', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false,
        primaryKey: true
      },
      lang: {
        type: Sequelize.ENUM('en', 'hi'),
        allowNull: false
      },
      key: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      value: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      updated_by: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE'
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

    await queryInterface.addIndex('locale_strings', ['lang', 'key'], { unique: true });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('system_settings');
    await queryInterface.dropTable('feature_flags');
    await queryInterface.dropTable('locale_strings');
  }
};
