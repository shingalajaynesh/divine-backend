'use strict';

const assertNoDuplicates = async (queryInterface, sql, label) => {
  const [rows] = await queryInterface.sequelize.query(sql);
  if (rows.length > 0) {
    throw new Error(`Cannot add payment uniqueness protection: duplicate ${label} rows exist and require manual cleanup.`);
  }
};

module.exports = {
  async up(queryInterface, Sequelize) {
    await assertNoDuplicates(
      queryInterface,
      `
        SELECT razorpay_order_id
        FROM payments
        WHERE razorpay_order_id IS NOT NULL
        GROUP BY razorpay_order_id
        HAVING COUNT(*) > 1
        LIMIT 1
      `,
      'Razorpay order ID'
    );

    await assertNoDuplicates(
      queryInterface,
      `
        SELECT razorpay_payment_id
        FROM payments
        WHERE razorpay_payment_id IS NOT NULL
        GROUP BY razorpay_payment_id
        HAVING COUNT(*) > 1
        LIMIT 1
      `,
      'Razorpay payment ID'
    );

    await assertNoDuplicates(
      queryInterface,
      `
        SELECT payment_id
        FROM invoices
        WHERE payment_id IS NOT NULL
        GROUP BY payment_id
        HAVING COUNT(*) > 1
        LIMIT 1
      `,
      'invoice payment ID'
    );

    await assertNoDuplicates(
      queryInterface,
      `
        SELECT payment_id
        FROM financial_transactions
        WHERE payment_id IS NOT NULL AND type = 'payment'
        GROUP BY payment_id
        HAVING COUNT(*) > 1
        LIMIT 1
      `,
      'payment financial transaction'
    );

    await queryInterface.createTable('payment_checkout_intents', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false,
        primaryKey: true
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      center_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'centers', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE'
      },
      subscription_plan_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'subscription_plans', key: 'id' },
        onDelete: 'RESTRICT',
        onUpdate: 'CASCADE'
      },
      coupon_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'coupons', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE'
      },
      razorpay_order_id: {
        type: Sequelize.STRING,
        allowNull: true
      },
      razorpay_payment_id: {
        type: Sequelize.STRING,
        allowNull: true
      },
      expected_amount_minor: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      currency: {
        type: Sequelize.STRING(3),
        allowNull: false,
        defaultValue: 'INR'
      },
      purpose: {
        type: Sequelize.STRING(50),
        allowNull: false
      },
      status: {
        type: Sequelize.STRING(50),
        allowNull: false
      },
      receipt: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      expires_at: {
        type: Sequelize.DATE,
        allowNull: false
      },
      verified_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      processed_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      payment_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'payments', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE'
      },
      invoice_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'invoices', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE'
      },
      failure_reason: {
        type: Sequelize.STRING(500),
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

    await queryInterface.addColumn('payments', 'checkout_intent_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'payment_checkout_intents', key: 'id' },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    });

    await queryInterface.createTable('coupon_redemptions', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false,
        primaryKey: true
      },
      coupon_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'coupons', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      checkout_intent_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'payment_checkout_intents', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      payment_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'payments', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE'
      },
      redeemed_at: {
        type: Sequelize.DATE,
        allowNull: false
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

    await queryInterface.addIndex('payment_checkout_intents', ['receipt'], {
      unique: true,
      name: 'uniq_payment_checkout_intents_receipt'
    });
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uniq_payment_checkout_intents_razorpay_order_id
      ON payment_checkout_intents (razorpay_order_id)
      WHERE razorpay_order_id IS NOT NULL;
    `);
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uniq_payment_checkout_intents_razorpay_payment_id
      ON payment_checkout_intents (razorpay_payment_id)
      WHERE razorpay_payment_id IS NOT NULL;
    `);
    await queryInterface.addIndex('payment_checkout_intents', ['user_id', 'status'], {
      name: 'idx_payment_checkout_intents_user_status'
    });
    await queryInterface.addIndex('coupon_redemptions', ['checkout_intent_id'], {
      unique: true,
      name: 'uniq_coupon_redemptions_checkout_intent_id'
    });
    await queryInterface.addIndex('coupon_redemptions', ['coupon_id', 'user_id'], {
      name: 'idx_coupon_redemptions_coupon_user'
    });

    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uniq_payments_razorpay_order_id
      ON payments (razorpay_order_id)
      WHERE razorpay_order_id IS NOT NULL;
    `);
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uniq_payments_razorpay_payment_id
      ON payments (razorpay_payment_id)
      WHERE razorpay_payment_id IS NOT NULL;
    `);
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uniq_payments_checkout_intent_id
      ON payments (checkout_intent_id)
      WHERE checkout_intent_id IS NOT NULL;
    `);
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uniq_invoices_payment_id
      ON invoices (payment_id)
      WHERE payment_id IS NOT NULL;
    `);
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uniq_financial_transactions_payment_type_payment
      ON financial_transactions (payment_id)
      WHERE payment_id IS NOT NULL AND type = 'payment';
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS uniq_financial_transactions_payment_type_payment;');
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS uniq_invoices_payment_id;');
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS uniq_payments_checkout_intent_id;');
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS uniq_payments_razorpay_payment_id;');
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS uniq_payments_razorpay_order_id;');
    await queryInterface.removeIndex('coupon_redemptions', 'idx_coupon_redemptions_coupon_user');
    await queryInterface.removeIndex('coupon_redemptions', 'uniq_coupon_redemptions_checkout_intent_id');
    await queryInterface.removeIndex('payment_checkout_intents', 'idx_payment_checkout_intents_user_status');
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS uniq_payment_checkout_intents_razorpay_payment_id;');
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS uniq_payment_checkout_intents_razorpay_order_id;');
    await queryInterface.removeIndex('payment_checkout_intents', 'uniq_payment_checkout_intents_receipt');
    await queryInterface.dropTable('coupon_redemptions');
    await queryInterface.removeColumn('payments', 'checkout_intent_id');
    await queryInterface.dropTable('payment_checkout_intents');
  }
};
