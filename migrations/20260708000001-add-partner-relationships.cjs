'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Add PARTNER to the role_type enum.
    // In PostgreSQL, ALTER TYPE ADD VALUE cannot run inside a transaction block.
    // Try to execute it, and ignore if it already exists or if it fails due to transaction.
    try {
      await queryInterface.sequelize.query(`ALTER TYPE "enum_roles_role_type" ADD VALUE 'PARTNER'`);
    } catch (err) {
      // Ignore if duplicate value or database dialect doesn't support it directly
      console.log('Note: Enum alteration skipped or already exists:', err.message);
    }

    // 2. Add columns to users table
    await queryInterface.addColumn('users', 'partner_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });

    await queryInterface.addColumn('users', 'share_vitals_with_partner', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true
    });

    await queryInterface.addColumn('users', 'share_reports_with_partner', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('users', 'partner_id');
    await queryInterface.removeColumn('users', 'share_vitals_with_partner');
    await queryInterface.removeColumn('users', 'share_reports_with_partner');
    // Removing enum values in Postgres is not trivial, so we leave the enum value as is.
  }
};
