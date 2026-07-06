'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Add columns to forum_posts
    await queryInterface.addColumn('forum_posts', 'category', {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: 'General'
    });

    await queryInterface.addColumn('forum_posts', 'liked_by_users', {
      type: Sequelize.TEXT,
      allowNull: false,
      defaultValue: '[]'
    });

    await queryInterface.addColumn('forum_posts', 'reported', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });

    await queryInterface.addColumn('forum_posts', 'reports_count', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0
    });

    // 2. Add columns to forum_comments
    await queryInterface.addColumn('forum_comments', 'reported', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false
    });

    await queryInterface.addColumn('forum_comments', 'reports_count', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('forum_comments', 'reports_count');
    await queryInterface.removeColumn('forum_comments', 'reported');

    await queryInterface.removeColumn('forum_posts', 'reports_count');
    await queryInterface.removeColumn('forum_posts', 'reported');
    await queryInterface.removeColumn('forum_posts', 'liked_by_users');
    await queryInterface.removeColumn('forum_posts', 'category');
  }
};
