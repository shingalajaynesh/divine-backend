'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Create forum_groups table
    await queryInterface.createTable('forum_groups', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false,
        primaryKey: true
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      cover_url: {
        type: Sequelize.STRING,
        allowNull: true
      },
      is_private: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false
      },
      deleted_at: {
        type: Sequelize.DATE,
        allowNull: true
      }
    });

    // 2. Add group_id to forum_posts
    await queryInterface.addColumn('forum_posts', 'group_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'forum_groups',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });

    // 3. Add reactions to forum_posts
    await queryInterface.addColumn('forum_posts', 'reactions', {
      type: Sequelize.JSONB,
      allowNull: false,
      defaultValue: {}
    });

    // 4. Add reported_reason to forum_posts
    await queryInterface.addColumn('forum_posts', 'reported_reason', {
      type: Sequelize.TEXT,
      allowNull: true
    });

    // 5. Add reported_reason to forum_comments
    await queryInterface.addColumn('forum_comments', 'reported_reason', {
      type: Sequelize.TEXT,
      allowNull: true
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('forum_comments', 'reported_reason');
    await queryInterface.removeColumn('forum_posts', 'reported_reason');
    await queryInterface.removeColumn('forum_posts', 'reactions');
    await queryInterface.removeColumn('forum_posts', 'group_id');
    await queryInterface.dropTable('forum_groups');
  }
};
