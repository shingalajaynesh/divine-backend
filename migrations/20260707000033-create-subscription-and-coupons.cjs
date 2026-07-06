'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Create subscription_plans table
    await queryInterface.createTable('subscription_plans', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false,
        primaryKey: true
      },
      name: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      price: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
      },
      billing_period: {
        type: Sequelize.STRING(50),
        allowNull: false,
        defaultValue: 'monthly'
      },
      trial_days: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 7
      },
      features: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: '[]'
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

    // 2. Create user_subscriptions table
    await queryInterface.createTable('user_subscriptions', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false,
        primaryKey: true
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      plan_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'subscription_plans',
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      status: {
        type: Sequelize.STRING(50),
        allowNull: false,
        defaultValue: 'trialing'
      },
      trial_start_date: {
        type: Sequelize.DATE,
        allowNull: true
      },
      trial_end_date: {
        type: Sequelize.DATE,
        allowNull: true
      },
      current_period_start_date: {
        type: Sequelize.DATE,
        allowNull: false
      },
      current_period_end_date: {
        type: Sequelize.DATE,
        allowNull: false
      },
      cancelled_at: {
        type: Sequelize.DATE,
        allowNull: true
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

    // 3. Create coupons table
    await queryInterface.createTable('coupons', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false,
        primaryKey: true
      },
      code: {
        type: Sequelize.STRING(50),
        allowNull: false,
        unique: true
      },
      discount_percent: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      discount_amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true
      },
      valid_from: {
        type: Sequelize.DATE,
        allowNull: false
      },
      valid_until: {
        type: Sequelize.DATE,
        allowNull: false
      },
      max_redemptions: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      redemptions_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
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

    // 4. Preseed subscription plans & coupons
    const now = new Date();
    const future = new Date();
    future.setFullYear(future.getFullYear() + 2); // valid for 2 years

    await queryInterface.bulkInsert('subscription_plans', [
      {
        id: '17a5b3a4-e910-410a-86fe-2d5d71eb5aa4',
        name: 'Standard Pregnancy Guide Plan',
        description: 'Access 280-day basic daily activities calendar, weekly baby development trackers, and community sharing channels.',
        price: 1499.00,
        billing_period: 'yearly',
        trial_days: 7,
        features: JSON.stringify(['daily_activities', 'milestone_trackers', 'community_channels']),
        created_at: now,
        updated_at: now
      },
      {
        id: '27a5b3a4-e910-410a-86fe-2d5d71eb5aa5',
        name: 'Premium Garbh Sanskar Complete Plan',
        description: 'Complete package: active expert sessions bookings, personalized obstetric guides, bilingual parallel texts, secure playlists, and priority medical advice support desk.',
        price: 2999.00,
        billing_period: 'yearly',
        trial_days: 14,
        features: JSON.stringify(['daily_activities', 'milestone_trackers', 'community_channels', 'expert_bookings', 'bilingual_narrator', 'secure_playlists', 'support_desk']),
        created_at: now,
        updated_at: now
      }
    ]);

    await queryInterface.bulkInsert('coupons', [
      {
        id: '37a5b3a4-e910-410a-86fe-2d5d71eb5aa6',
        code: 'GARBH50',
        discount_percent: 50,
        discount_amount: null,
        valid_from: now,
        valid_until: future,
        max_redemptions: 500,
        redemptions_count: 0,
        created_at: now,
        updated_at: now
      }
    ]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('coupons');
    await queryInterface.dropTable('user_subscriptions');
    await queryInterface.dropTable('subscription_plans');
  }
};
