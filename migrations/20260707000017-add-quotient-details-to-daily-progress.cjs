'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const columns = {
      pq_duration_mins: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 0
      },
      iq_duration_mins: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 0
      },
      eq_duration_mins: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 0
      },
      sq_duration_mins: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 0
      },
      pq_evidence: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      iq_evidence: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      eq_evidence: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      sq_evidence: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      pq_notes: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      iq_notes: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      eq_notes: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      sq_notes: {
        type: Sequelize.TEXT,
        allowNull: true
      }
    };

    for (const [colName, colSpec] of Object.entries(columns)) {
      await queryInterface.addColumn('daily_progress', colName, colSpec);
    }
  },

  async down(queryInterface) {
    const columns = [
      'pq_duration_mins',
      'iq_duration_mins',
      'eq_duration_mins',
      'sq_duration_mins',
      'pq_evidence',
      'iq_evidence',
      'eq_evidence',
      'sq_evidence',
      'pq_notes',
      'iq_notes',
      'eq_notes',
      'sq_notes'
    ];

    for (const colName of columns) {
      await queryInterface.removeColumn('daily_progress', colName);
    }
  }
};
