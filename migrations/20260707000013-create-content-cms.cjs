'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('content_categories', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.UUIDV4 },
      parent_id: { type: Sequelize.UUID, allowNull: true, references: { model: 'content_categories', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
      slug: { type: Sequelize.STRING(100), allowNull: false, unique: true },
      name: { type: Sequelize.STRING(120), allowNull: false },
      description: { type: Sequelize.TEXT, allowNull: true }, icon: { type: Sequelize.STRING(80), allowNull: true },
      sort_order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 }, is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') }, updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') }, deleted_at: { type: Sequelize.DATE, allowNull: true },
    });
    await queryInterface.addIndex('content_categories', ['is_active', 'sort_order']);

    await queryInterface.createTable('media_assets', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.UUIDV4 },
      center_id: { type: Sequelize.UUID, allowNull: true, references: { model: 'centers', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
      owner_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'RESTRICT' },
      storage_key: { type: Sequelize.STRING(500), allowNull: false, unique: true }, url: { type: Sequelize.STRING(1000), allowNull: true },
      mime_type: { type: Sequelize.STRING(120), allowNull: false }, kind: { type: Sequelize.STRING(20), allowNull: false },
      size_bytes: { type: Sequelize.BIGINT, allowNull: false, defaultValue: 0 }, duration_seconds: { type: Sequelize.INTEGER, allowNull: true },
      status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'uploading' }, alt_text: { type: Sequelize.STRING(300), allowNull: true },
      checksum: { type: Sequelize.STRING(128), allowNull: true }, metadata: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') }, updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') }, deleted_at: { type: Sequelize.DATE, allowNull: true },
    });
    await queryInterface.addIndex('media_assets', ['center_id', 'status', 'kind']);
    await queryInterface.addIndex('media_assets', ['owner_id', 'created_at']);
    await queryInterface.addConstraint('media_assets', { fields: ['kind'], type: 'check', where: { kind: ['image', 'audio', 'video', 'document'] }, name: 'media_assets_kind_allowed' });
    await queryInterface.addConstraint('media_assets', { fields: ['status'], type: 'check', where: { status: ['uploading', 'ready', 'failed', 'archived'] }, name: 'media_assets_status_allowed' });
    await queryInterface.addConstraint('media_assets', { fields: ['size_bytes'], type: 'check', where: { size_bytes: { [Sequelize.Op.gte]: 0 } }, name: 'media_assets_size_nonnegative' });
    await queryInterface.addConstraint('media_assets', { fields: ['status', 'url'], type: 'check', where: { [Sequelize.Op.or]: [{ status: { [Sequelize.Op.ne]: 'ready' } }, { url: { [Sequelize.Op.ne]: null } }] }, name: 'media_assets_ready_url_required' });

    await queryInterface.createTable('content_items', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.UUIDV4 },
      center_id: { type: Sequelize.UUID, allowNull: true, references: { model: 'centers', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
      category_id: { type: Sequelize.UUID, allowNull: true, references: { model: 'content_categories', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
      cover_asset_id: { type: Sequelize.UUID, allowNull: true, references: { model: 'media_assets', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
      created_by: { type: Sequelize.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'RESTRICT' },
      updated_by: { type: Sequelize.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'RESTRICT' },
      slug: { type: Sequelize.STRING(140), allowNull: false }, content_type: { type: Sequelize.STRING(20), allowNull: false },
      status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'draft' }, visibility: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'free' },
      publish_at: { type: Sequelize.DATE, allowNull: true }, unpublish_at: { type: Sequelize.DATE, allowNull: true }, sort_order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') }, updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') }, deleted_at: { type: Sequelize.DATE, allowNull: true },
    });
    await queryInterface.addIndex('content_items', ['center_id', 'slug'], { unique: true, where: { center_id: { [Sequelize.Op.ne]: null } } });
    await queryInterface.addIndex('content_items', ['slug'], { unique: true, where: { center_id: null }, name: 'content_items_global_slug_unique' });
    await queryInterface.addIndex('content_items', ['status', 'visibility', 'publish_at']);
    await queryInterface.addIndex('content_items', ['category_id', 'status', 'sort_order']);
    await queryInterface.addConstraint('content_items', { fields: ['content_type'], type: 'check', where: { content_type: ['article', 'video', 'audio', 'story', 'prayer', 'affirmation', 'recipe', 'yoga', 'meditation'] }, name: 'content_items_type_allowed' });
    await queryInterface.addConstraint('content_items', { fields: ['status'], type: 'check', where: { status: ['draft', 'review', 'published', 'archived'] }, name: 'content_items_status_allowed' });
    await queryInterface.addConstraint('content_items', { fields: ['visibility'], type: 'check', where: { visibility: ['free', 'enrolled', 'premium', 'staff'] }, name: 'content_items_visibility_allowed' });
    await queryInterface.addConstraint('content_items', { fields: ['publish_at', 'unpublish_at'], type: 'check', where: { [Sequelize.Op.or]: [{ unpublish_at: null }, { publish_at: null }, Sequelize.where(Sequelize.col('unpublish_at'), '>', Sequelize.col('publish_at'))] }, name: 'content_items_publish_window_valid' });

    await queryInterface.createTable('content_translations', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false, defaultValue: Sequelize.UUIDV4 },
      content_item_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'content_items', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      language: { type: Sequelize.STRING(10), allowNull: false }, title: { type: Sequelize.STRING(240), allowNull: false }, summary: { type: Sequelize.TEXT, allowNull: true }, body: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') }, updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') }, deleted_at: { type: Sequelize.DATE, allowNull: true },
    });
    await queryInterface.addIndex('content_translations', ['content_item_id', 'language'], { unique: true });
    await queryInterface.addIndex('content_translations', ['language', 'title']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('content_translations');
    await queryInterface.dropTable('content_items');
    await queryInterface.dropTable('media_assets');
    await queryInterface.dropTable('content_categories');
  },
};
