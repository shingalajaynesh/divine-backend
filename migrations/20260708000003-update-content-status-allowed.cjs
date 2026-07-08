'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Drop the old status check constraint
    await queryInterface.removeConstraint('content_items', 'content_items_status_allowed');

    // Add updated check constraint to allow 'approved'
    await queryInterface.addConstraint('content_items', {
      fields: ['status'],
      type: 'check',
      where: {
        status: ['draft', 'review', 'approved', 'published', 'archived']
      },
      name: 'content_items_status_allowed'
    });

    // Add reviewed_by column referencing users.id
    await queryInterface.addColumn('content_items', 'reviewed_by', {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });

    // Add feedback column
    await queryInterface.addColumn('content_items', 'feedback', {
      type: Sequelize.TEXT,
      allowNull: true
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove columns
    await queryInterface.removeColumn('content_items', 'feedback');
    await queryInterface.removeColumn('content_items', 'reviewed_by');

    // Drop updated constraint
    await queryInterface.removeConstraint('content_items', 'content_items_status_allowed');

    // Re-add old status check constraint
    await queryInterface.addConstraint('content_items', {
      fields: ['status'],
      type: 'check',
      where: {
        status: ['draft', 'review', 'published', 'archived']
      },
      name: 'content_items_status_allowed'
    });
  }
};
