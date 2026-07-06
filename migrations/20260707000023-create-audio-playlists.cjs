'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const stamps = {
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW')
      }
    };

    // 1. Create audio_playlists table
    await queryInterface.createTable('audio_playlists', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      name: {
        type: Sequelize.STRING(240),
        allowNull: false
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      ...stamps
    });

    // 2. Create audio_playlist_items table
    await queryInterface.createTable('audio_playlist_items', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false
      },
      playlist_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'audio_playlists',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      content_item_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'content_items',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      sort_order: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      ...stamps
    });

    // Index unique (playlist_id, content_item_id)
    await queryInterface.addIndex('audio_playlist_items', ['playlist_id', 'content_item_id'], {
      unique: true
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('audio_playlist_items');
    await queryInterface.dropTable('audio_playlists');
  }
};
