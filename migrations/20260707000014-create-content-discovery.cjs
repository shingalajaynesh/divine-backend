'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('content_bookmarks', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.UUIDV4 },
      user_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      content_item_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'content_items', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      kind: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'bookmark' },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });
    await queryInterface.addIndex('content_bookmarks', ['user_id', 'content_item_id', 'kind'], { unique: true });
    await queryInterface.addIndex('content_bookmarks', ['user_id', 'created_at']);
    await queryInterface.addConstraint('content_bookmarks', { fields: ['kind'], type: 'check', where: { kind: ['bookmark', 'watch_later'] }, name: 'content_bookmarks_kind_allowed' });

    await queryInterface.createTable('content_view_history', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.UUIDV4 },
      user_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      content_item_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'content_items', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      last_position_seconds: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      progress_percent: { type: Sequelize.FLOAT, allowNull: false, defaultValue: 0 },
      completed: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      view_count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
      viewed_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });
    await queryInterface.addIndex('content_view_history', ['user_id', 'content_item_id'], { unique: true });
    await queryInterface.addIndex('content_view_history', ['user_id', 'viewed_at']);
    await queryInterface.addConstraint('content_view_history', { fields: ['last_position_seconds'], type: 'check', where: { last_position_seconds: { [Sequelize.Op.gte]: 0 } }, name: 'content_view_history_position_nonnegative' });
    await queryInterface.addConstraint('content_view_history', { fields: ['progress_percent'], type: 'check', where: { progress_percent: { [Sequelize.Op.between]: [0, 100] } }, name: 'content_view_history_progress_range' });
    await queryInterface.addConstraint('content_view_history', { fields: ['view_count'], type: 'check', where: { view_count: { [Sequelize.Op.gte]: 1 } }, name: 'content_view_history_count_positive' });

    await queryInterface.createTable('recent_searches', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.UUIDV4 },
      user_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      query: { type: Sequelize.STRING(120), allowNull: false },
      filters: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
      result_count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      searched_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });
    await queryInterface.addIndex('recent_searches', ['user_id', 'searched_at']);
    await queryInterface.addConstraint('recent_searches', { fields: ['result_count'], type: 'check', where: { result_count: { [Sequelize.Op.gte]: 0 } }, name: 'recent_searches_result_count_nonnegative' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('recent_searches');
    await queryInterface.dropTable('content_view_history');
    await queryInterface.dropTable('content_bookmarks');
  },
};
