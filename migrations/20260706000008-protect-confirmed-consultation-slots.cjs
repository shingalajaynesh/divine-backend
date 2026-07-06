'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS consultation_bookings_confirmed_slot_unique
      ON consultation_bookings (expert_id, schedule_slot)
      WHERE status = 'confirmed' AND deleted_at IS NULL;
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      'DROP INDEX IF EXISTS consultation_bookings_confirmed_slot_unique;',
    );
  },
};
