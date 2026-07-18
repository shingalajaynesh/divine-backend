'use strict';

const failIfRows = async (queryInterface, sql, label) => {
  const [rows] = await queryInterface.sequelize.query(sql);
  if (rows.length > 0) {
    throw new Error(`Cannot apply store payment migration until ${label} are resolved manually.`);
  }
};

module.exports = {
  async up(queryInterface, Sequelize) {
    await failIfRows(queryInterface, `
      SELECT id FROM products WHERE inventory_count < 0 LIMIT 1
    `, 'negative product inventory records');

    await queryInterface.createTable('store_checkout_intents', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, allowNull: false, primaryKey: true },
      user_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      center_id: { type: Sequelize.UUID, allowNull: true, references: { model: 'centers', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
      address_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'user_addresses', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'RESTRICT' },
      currency: { type: Sequelize.STRING(3), allowNull: false, defaultValue: 'INR' },
      subtotal_minor: { type: Sequelize.INTEGER, allowNull: false },
      discount_minor: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      tax_minor: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      shipping_minor: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      total_minor: { type: Sequelize.INTEGER, allowNull: false },
      coupon_id: { type: Sequelize.UUID, allowNull: true, references: { model: 'coupons', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
      coupon_code: { type: Sequelize.STRING(100), allowNull: true },
      razorpay_order_id: { type: Sequelize.STRING, allowNull: true },
      razorpay_payment_id: { type: Sequelize.STRING, allowNull: true },
      receipt: { type: Sequelize.STRING(100), allowNull: false },
      status: { type: Sequelize.STRING(50), allowNull: false },
      expires_at: { type: Sequelize.DATE, allowNull: false },
      client_verified_at: { type: Sequelize.DATE, allowNull: true },
      provider_confirmed_at: { type: Sequelize.DATE, allowNull: true },
      store_order_id: { type: Sequelize.UUID, allowNull: true },
      payment_id: { type: Sequelize.UUID, allowNull: true, references: { model: 'payments', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
      invoice_id: { type: Sequelize.UUID, allowNull: true, references: { model: 'invoices', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
      failure_code: { type: Sequelize.STRING(100), allowNull: true },
      failure_message: { type: Sequelize.STRING(500), allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });

    await queryInterface.createTable('store_checkout_items', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, allowNull: false, primaryKey: true },
      checkout_intent_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'store_checkout_intents', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      product_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'products', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'RESTRICT' },
      sku: { type: Sequelize.STRING(100), allowNull: true },
      product_name: { type: Sequelize.STRING(255), allowNull: false },
      quantity: { type: Sequelize.INTEGER, allowNull: false },
      unit_price_minor: { type: Sequelize.INTEGER, allowNull: false },
      line_discount_minor: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      tax_minor: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      line_total_minor: { type: Sequelize.INTEGER, allowNull: false },
      metadata: { type: Sequelize.JSONB, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });

    await queryInterface.createTable('inventory_reservations', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, allowNull: false, primaryKey: true },
      product_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'products', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'RESTRICT' },
      checkout_intent_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'store_checkout_intents', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      quantity: { type: Sequelize.INTEGER, allowNull: false },
      status: { type: Sequelize.STRING(50), allowNull: false },
      reserved_at: { type: Sequelize.DATE, allowNull: false },
      expires_at: { type: Sequelize.DATE, allowNull: false },
      released_at: { type: Sequelize.DATE, allowNull: true },
      consumed_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });

    await queryInterface.addColumn('store_orders', 'total_amount_minor', { type: Sequelize.INTEGER, allowNull: true });
    await queryInterface.addColumn('store_orders', 'currency', { type: Sequelize.STRING(3), allowNull: false, defaultValue: 'INR' });
    await queryInterface.addColumn('store_orders', 'payment_status', { type: Sequelize.STRING(50), allowNull: false, defaultValue: 'pending' });
    await queryInterface.addColumn('store_orders', 'payment_id', { type: Sequelize.UUID, allowNull: true, references: { model: 'payments', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' });
    await queryInterface.addColumn('store_orders', 'invoice_id', { type: Sequelize.UUID, allowNull: true, references: { model: 'invoices', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' });
    await queryInterface.addColumn('store_orders', 'store_checkout_intent_id', { type: Sequelize.UUID, allowNull: true, references: { model: 'store_checkout_intents', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' });
    await queryInterface.addColumn('payments', 'store_checkout_intent_id', { type: Sequelize.UUID, allowNull: true, references: { model: 'store_checkout_intents', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' });
    await queryInterface.addColumn('payments', 'store_order_id', { type: Sequelize.UUID, allowNull: true, references: { model: 'store_orders', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' });
    await queryInterface.addColumn('payments', 'purpose', { type: Sequelize.STRING(50), allowNull: true });
    await queryInterface.addColumn('payment_provider_events', 'store_checkout_intent_id', { type: Sequelize.UUID, allowNull: true, references: { model: 'store_checkout_intents', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' });

    await queryInterface.sequelize.query('CREATE UNIQUE INDEX IF NOT EXISTS uniq_store_checkout_intents_receipt ON store_checkout_intents (receipt);');
    await queryInterface.sequelize.query('CREATE UNIQUE INDEX IF NOT EXISTS uniq_store_checkout_intents_razorpay_order_id ON store_checkout_intents (razorpay_order_id) WHERE razorpay_order_id IS NOT NULL;');
    await queryInterface.sequelize.query('CREATE UNIQUE INDEX IF NOT EXISTS uniq_store_checkout_intents_store_order_id ON store_checkout_intents (store_order_id) WHERE store_order_id IS NOT NULL;');
    await queryInterface.sequelize.query('CREATE UNIQUE INDEX IF NOT EXISTS uniq_store_orders_store_checkout_intent_id ON store_orders (store_checkout_intent_id) WHERE store_checkout_intent_id IS NOT NULL;');
    await queryInterface.addIndex('store_checkout_intents', ['user_id', 'status'], { name: 'idx_store_checkout_intents_user_status' });
    await queryInterface.addIndex('inventory_reservations', ['checkout_intent_id', 'status'], { name: 'idx_inventory_reservations_checkout_status' });
    await queryInterface.addIndex('inventory_reservations', ['status', 'expires_at'], { name: 'idx_inventory_reservations_status_expiry' });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('inventory_reservations', 'idx_inventory_reservations_status_expiry');
    await queryInterface.removeIndex('inventory_reservations', 'idx_inventory_reservations_checkout_status');
    await queryInterface.removeIndex('store_checkout_intents', 'idx_store_checkout_intents_user_status');
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS uniq_store_orders_store_checkout_intent_id;');
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS uniq_store_checkout_intents_store_order_id;');
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS uniq_store_checkout_intents_razorpay_order_id;');
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS uniq_store_checkout_intents_receipt;');
    await queryInterface.removeColumn('payment_provider_events', 'store_checkout_intent_id');
    await queryInterface.removeColumn('payments', 'purpose');
    await queryInterface.removeColumn('payments', 'store_order_id');
    await queryInterface.removeColumn('payments', 'store_checkout_intent_id');
    await queryInterface.removeColumn('store_orders', 'store_checkout_intent_id');
    await queryInterface.removeColumn('store_orders', 'invoice_id');
    await queryInterface.removeColumn('store_orders', 'payment_id');
    await queryInterface.removeColumn('store_orders', 'payment_status');
    await queryInterface.removeColumn('store_orders', 'currency');
    await queryInterface.removeColumn('store_orders', 'total_amount_minor');
    await queryInterface.dropTable('inventory_reservations');
    await queryInterface.dropTable('store_checkout_items');
    await queryInterface.dropTable('store_checkout_intents');
  },
};
