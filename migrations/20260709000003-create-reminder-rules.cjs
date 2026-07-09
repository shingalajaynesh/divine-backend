'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('reminder_rules', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false,
        primaryKey: true
      },
      name: {
        type: Sequelize.STRING(180),
        allowNull: false
      },
      rule_type: {
        type: Sequelize.STRING(40),
        allowNull: false
      },
      trigger_condition: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: {}
      },
      template_title: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      template_body: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      channels: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: ['in_app']
      },
      enabled: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
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

    const now = new Date();
    await queryInterface.bulkInsert('reminder_rules', [
      {
        id: 'e8cb080b-df0e-436d-9273-9a3d6f1d248b',
        name: 'Unread Content Daily Reminder',
        rule_type: 'content',
        trigger_condition: JSON.stringify({ hoursSinceActivity: 12 }),
        template_title: '🌟 Today\'s Daily Quotient Trail awaits!',
        template_body: 'Reconnect with your baby through our carefully structured activities.',
        channels: JSON.stringify(['in_app', 'push']),
        enabled: true,
        created_at: now,
        updated_at: now
      },
      {
        id: 'e8cb080b-df0e-436d-9273-9a3d6f1d248c',
        name: 'Upcoming Webinar Class Alert',
        rule_type: 'classes',
        trigger_condition: JSON.stringify({ minutesBeforeClass: 15 }),
        template_title: '⏰ Live Class starting soon!',
        template_body: 'Your booked webinar session begins in 15 minutes. Join now to participate!',
        channels: JSON.stringify(['in_app', 'push', 'whatsapp']),
        enabled: true,
        created_at: now,
        updated_at: now
      },
      {
        id: 'e8cb080b-df0e-436d-9273-9a3d6f1d248d',
        name: 'BP & Vitals Track Reminder',
        rule_type: 'wellness',
        trigger_condition: JSON.stringify({ hoursSinceVitals: 24 }),
        template_title: '🩺 Maintain your wellness tracker',
        template_body: 'Please take a moment to log your blood pressure and baby kicks today.',
        channels: JSON.stringify(['in_app', 'whatsapp']),
        enabled: true,
        created_at: now,
        updated_at: now
      },
      {
        id: 'e8cb080b-df0e-436d-9273-9a3d6f1d248e',
        name: 'Engagement Reactivation Alarm',
        rule_type: 'reactivation',
        trigger_condition: JSON.stringify({ daysOfInactivity: 3 }),
        template_title: '🌸 We miss you!',
        template_body: 'Take a deep breath and spend 5 minutes on your baby\'s development today.',
        channels: JSON.stringify(['in_app', 'push', 'email']),
        enabled: true,
        created_at: now,
        updated_at: now
      }
    ]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('reminder_rules');
  }
};
