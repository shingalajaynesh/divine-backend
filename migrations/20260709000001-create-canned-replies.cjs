'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('canned_replies', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false,
        primaryKey: true
      },
      title: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      content: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      category: {
        type: Sequelize.STRING(100),
        allowNull: false,
        defaultValue: 'general'
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

    // Seed default canned replies
    const now = new Date();
    await queryInterface.bulkInsert('canned_replies', [
      {
        id: 'c8cb080b-df0e-436d-9273-9a3d6f1d248b',
        title: 'Welcome & App Onboarding Guide',
        content: 'Welcome to Divine Garbh Sanskar! Please start by filling out your pregnancy onboarding calculator on the Today Dashboard. This lets us personalize your daily activities trail and calendar milestones.',
        category: 'general',
        created_at: now,
        updated_at: now
      },
      {
        id: 'c8cb080b-df0e-436d-9273-9a3d6f1d248c',
        title: 'Diet & Nutrition Plan Queries',
        content: 'Our clinical nutritionist prepares personalized meal plans weekly based on your trimester stages, height/weight info, and diet preferences. You can access it under the Diet Planner tab.',
        category: 'diet',
        created_at: now,
        updated_at: now
      },
      {
        id: 'c8cb080b-df0e-436d-9273-9a3d6f1d248d',
        title: 'App Lag or Troubleshooting',
        content: 'If you experience any lag or crashes, please try logging out and logging back in, clearing app cache, or check if there is an update in Google Play Store / iOS App Store.',
        category: 'technical',
        created_at: now,
        updated_at: now
      },
      {
        id: 'c8cb080b-df0e-436d-9273-9a3d6f1d248e',
        title: 'Urgent Clinical Red Flag Warning',
        content: 'If you experience severe vaginal bleeding, severe lower abdominal cramps, or reduced fetal movements, please contact your primary doctor or visit the nearest hospital emergency room immediately.',
        category: 'medical',
        created_at: now,
        updated_at: now
      }
    ]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('canned_replies');
  }
};
