'use strict';

const duplicateCheck = async (queryInterface, sql, label) => {
  const [rows] = await queryInterface.sequelize.query(sql);
  if (rows.length > 0) {
    throw new Error(`Cannot apply payment provider migration until duplicate ${label} are resolved manually.`);
  }
};

module.exports = {
  async up(queryInterface, Sequelize) {
    await duplicateCheck(queryInterface, `
      SELECT razorpay_payment_id
      FROM payments
      WHERE razorpay_payment_id IS NOT NULL
      GROUP BY razorpay_payment_id
      HAVING COUNT(*) > 1
    `, 'Razorpay payment IDs');

    await queryInterface.addColumn('payment_checkout_intents', 'provider_confirmed_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.addColumn('payment_checkout_intents', 'provider_status', {
      type: Sequelize.STRING(50),
      allowNull: true,
    });
    await queryInterface.addColumn('payment_checkout_intents', 'total_refunded_minor', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });

    await queryInterface.addColumn('payments', 'provider_status', {
      type: Sequelize.STRING(50),
      allowNull: true,
    });
    await queryInterface.addColumn('payments', 'amount_minor', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
    await queryInterface.addColumn('payments', 'currency', {
      type: Sequelize.STRING(3),
      allowNull: false,
      defaultValue: 'INR',
    });
    await queryInterface.addColumn('payments', 'total_refunded_minor', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });

    await queryInterface.createTable('payment_provider_events', {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
      },
      provider: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      provider_event_id: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      event_type: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      payload_hash: {
        type: Sequelize.STRING(64),
        allowNull: false,
      },
      signature_hash: {
        type: Sequelize.STRING(64),
        allowNull: true,
      },
      razorpay_order_id: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      razorpay_payment_id: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      razorpay_refund_id: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      checkout_intent_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'payment_checkout_intents', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      processing_status: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      processing_attempts: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      first_received_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      last_received_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      processing_started_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      processed_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      next_retry_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      last_error_code: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      last_error_message: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      correlation_id: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
    });

    await queryInterface.createTable('payment_refunds', {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
      },
      payment_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'payments', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      checkout_intent_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'payment_checkout_intents', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      razorpay_payment_id: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      razorpay_refund_id: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      requested_amount_minor: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      processed_amount_minor: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      currency: {
        type: Sequelize.STRING(3),
        allowNull: false,
        defaultValue: 'INR',
      },
      reason: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      requested_by_user_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      status: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      provider_status: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },
      idempotency_key: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      failure_code: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      failure_message: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      requested_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      processed_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      financial_transaction_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'financial_transactions', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      invoice_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'invoices', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
    });

    await queryInterface.addIndex('payment_provider_events', ['provider', 'provider_event_id'], {
      unique: true,
      name: 'uniq_payment_provider_events_provider_event_id',
    });
    await queryInterface.addIndex('payment_provider_events', ['processing_status', 'next_retry_at'], {
      name: 'idx_payment_provider_events_status_retry',
    });
    await queryInterface.addIndex('payment_provider_events', ['razorpay_order_id'], {
      name: 'idx_payment_provider_events_razorpay_order_id',
    });
    await queryInterface.addIndex('payment_provider_events', ['razorpay_payment_id'], {
      name: 'idx_payment_provider_events_razorpay_payment_id',
    });
    await queryInterface.addIndex('payment_refunds', ['payment_id', 'status'], {
      name: 'idx_payment_refunds_payment_status',
    });
    await queryInterface.addIndex('payment_refunds', ['idempotency_key'], {
      unique: true,
      name: 'uniq_payment_refunds_idempotency_key',
    });
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uniq_payment_refunds_razorpay_refund_id
      ON payment_refunds (razorpay_refund_id)
      WHERE razorpay_refund_id IS NOT NULL;
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS uniq_payment_refunds_razorpay_refund_id;');
    await queryInterface.removeIndex('payment_refunds', 'uniq_payment_refunds_idempotency_key');
    await queryInterface.removeIndex('payment_refunds', 'idx_payment_refunds_payment_status');
    await queryInterface.removeIndex('payment_provider_events', 'idx_payment_provider_events_razorpay_payment_id');
    await queryInterface.removeIndex('payment_provider_events', 'idx_payment_provider_events_razorpay_order_id');
    await queryInterface.removeIndex('payment_provider_events', 'idx_payment_provider_events_status_retry');
    await queryInterface.removeIndex('payment_provider_events', 'uniq_payment_provider_events_provider_event_id');
    await queryInterface.dropTable('payment_refunds');
    await queryInterface.dropTable('payment_provider_events');
    await queryInterface.removeColumn('payments', 'total_refunded_minor');
    await queryInterface.removeColumn('payments', 'currency');
    await queryInterface.removeColumn('payments', 'amount_minor');
    await queryInterface.removeColumn('payments', 'provider_status');
    await queryInterface.removeColumn('payment_checkout_intents', 'total_refunded_minor');
    await queryInterface.removeColumn('payment_checkout_intents', 'provider_status');
    await queryInterface.removeColumn('payment_checkout_intents', 'provider_confirmed_at');
  },
};
