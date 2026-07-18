'use strict';

const failIfRows = async (queryInterface, sql, label) => {
  const [rows] = await queryInterface.sequelize.query(sql);
  if (rows.length > 0) {
    throw new Error(`Cannot apply database consistency migration until ${label} are resolved manually.`);
  }
};

const replaceForeignKey = async (queryInterface, tableName, columnName, targetTable, targetColumn, onDelete) => {
  const [constraints] = await queryInterface.sequelize.query(
    `
      SELECT con.conname AS name
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = ANY(con.conkey)
      WHERE con.contype = 'f'
        AND rel.relname = :tableName
        AND att.attname = :columnName
    `,
    { replacements: { tableName, columnName } }
  );

  for (const constraint of constraints) {
    await queryInterface.removeConstraint(tableName, constraint.name);
  }

  await queryInterface.addConstraint(tableName, {
    fields: [columnName],
    type: 'foreign key',
    name: `fk_${tableName}_${columnName}`,
    references: { table: targetTable, field: targetColumn },
    onUpdate: 'CASCADE',
    onDelete
  });
};

const removeForeignKey = async (queryInterface, tableName, columnName) => {
  const [constraints] = await queryInterface.sequelize.query(
    `
      SELECT con.conname AS name
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = ANY(con.conkey)
      WHERE con.contype = 'f'
        AND rel.relname = :tableName
        AND att.attname = :columnName
    `,
    { replacements: { tableName, columnName } }
  );

  for (const constraint of constraints) {
    await queryInterface.removeConstraint(tableName, constraint.name);
  }
};

const createIndex = (queryInterface, sql) => queryInterface.sequelize.query(sql);

module.exports = {
  async up(queryInterface, Sequelize) {
    await failIfRows(queryInterface, `
      SELECT user_id, product_id
      FROM cart_items
      GROUP BY user_id, product_id
      HAVING COUNT(*) > 1
      LIMIT 1
    `, 'duplicate cart item rows');

    await failIfRows(queryInterface, `
      SELECT user_id, badge_key
      FROM user_achievements
      GROUP BY user_id, badge_key
      HAVING COUNT(*) > 1
      LIMIT 1
    `, 'duplicate user achievement rows');

    await queryInterface.addColumn('quiz_attempts', 'quiz_question_id', {
      type: Sequelize.UUID,
      allowNull: true
    });
    await queryInterface.addColumn('partner_activity_logs', 'partner_activity_id', {
      type: Sequelize.UUID,
      allowNull: true
    });
    await queryInterface.addColumn('sensory_activity_logs', 'sensory_activity_id', {
      type: Sequelize.UUID,
      allowNull: true
    });

    await queryInterface.sequelize.query(`
      UPDATE quiz_attempts qa
      SET quiz_question_id = qq.id
      FROM quiz_questions qq
      WHERE qa.day_number = qq.day_number
        AND qa.quiz_question_id IS NULL;
    `);
    await queryInterface.sequelize.query(`
      UPDATE partner_activity_logs pal
      SET partner_activity_id = pa.id
      FROM partner_activities pa
      WHERE pal.day_number = pa.day_number
        AND pal.partner_activity_id IS NULL;
    `);
    await queryInterface.sequelize.query(`
      UPDATE sensory_activity_logs sal
      SET sensory_activity_id = sa.id
      FROM sensory_activities sa
      WHERE sal.day_number = sa.day_number
        AND sal.sensory_activity_id IS NULL;
    `);

    await failIfRows(queryInterface, 'SELECT id FROM quiz_attempts WHERE quiz_question_id IS NULL LIMIT 1', 'quiz attempts without matching quiz questions');
    await failIfRows(queryInterface, 'SELECT id FROM partner_activity_logs WHERE partner_activity_id IS NULL LIMIT 1', 'partner activity logs without matching master activities');
    await failIfRows(queryInterface, 'SELECT id FROM sensory_activity_logs WHERE sensory_activity_id IS NULL LIMIT 1', 'sensory activity logs without matching master activities');

    await queryInterface.changeColumn('quiz_attempts', 'quiz_question_id', {
      type: Sequelize.UUID,
      allowNull: false,
      references: { model: 'quiz_questions', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT'
    });
    await queryInterface.changeColumn('partner_activity_logs', 'partner_activity_id', {
      type: Sequelize.UUID,
      allowNull: false,
      references: { model: 'partner_activities', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT'
    });
    await queryInterface.changeColumn('sensory_activity_logs', 'sensory_activity_id', {
      type: Sequelize.UUID,
      allowNull: false,
      references: { model: 'sensory_activities', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT'
    });

    await replaceForeignKey(queryInterface, 'payments', 'user_id', 'users', 'id', 'RESTRICT');
    await replaceForeignKey(queryInterface, 'invoices', 'user_id', 'users', 'id', 'RESTRICT');
    await replaceForeignKey(queryInterface, 'financial_transactions', 'user_id', 'users', 'id', 'RESTRICT');
    await replaceForeignKey(queryInterface, 'admin_audit_logs', 'user_id', 'users', 'id', 'RESTRICT');
    await replaceForeignKey(queryInterface, 'store_orders', 'user_id', 'users', 'id', 'RESTRICT');
    await removeForeignKey(queryInterface, 'store_checkout_intents', 'store_order_id');

    await createIndex(queryInterface, 'CREATE INDEX IF NOT EXISTS idx_content_items_reviewed_by ON content_items (reviewed_by);');
    await createIndex(queryInterface, 'CREATE INDEX IF NOT EXISTS idx_registered_devices_approved_by ON registered_devices (approved_by);');
    await createIndex(queryInterface, 'CREATE INDEX IF NOT EXISTS idx_testimonials_approved_by ON testimonials (approved_by);');
    await createIndex(queryInterface, 'CREATE INDEX IF NOT EXISTS idx_user_meal_plans_content_item_id ON user_meal_plans (content_item_id);');
    await createIndex(queryInterface, 'CREATE UNIQUE INDEX IF NOT EXISTS uniq_cart_items_user_product ON cart_items (user_id, product_id);');
    await createIndex(queryInterface, 'CREATE UNIQUE INDEX IF NOT EXISTS uniq_user_achievements_user_badge ON user_achievements (user_id, badge_key);');
    await createIndex(queryInterface, 'CREATE INDEX IF NOT EXISTS idx_quiz_attempts_question ON quiz_attempts (quiz_question_id);');
    await createIndex(queryInterface, 'CREATE INDEX IF NOT EXISTS idx_partner_activity_logs_activity ON partner_activity_logs (partner_activity_id);');
    await createIndex(queryInterface, 'CREATE INDEX IF NOT EXISTS idx_sensory_activity_logs_activity ON sensory_activity_logs (sensory_activity_id);');
    await createIndex(queryInterface, 'CREATE INDEX IF NOT EXISTS idx_notifications_user_status_created ON notifications (user_id, status, created_at);');
    await createIndex(queryInterface, 'CREATE INDEX IF NOT EXISTS idx_reminder_schedules_user_enabled_time ON reminder_schedules (user_id, enabled, local_time);');
    await createIndex(queryInterface, 'CREATE INDEX IF NOT EXISTS idx_notification_deliveries_provider_message ON notification_deliveries (channel, provider_message_id);');
    await createIndex(queryInterface, 'CREATE INDEX IF NOT EXISTS idx_support_tickets_status_priority_sla ON support_tickets (status, priority, sla_expires_at);');
    await createIndex(queryInterface, 'CREATE INDEX IF NOT EXISTS idx_support_ticket_messages_ticket_created ON support_ticket_messages (ticket_id, created_at);');
    await createIndex(queryInterface, 'CREATE INDEX IF NOT EXISTS idx_appointments_user_date ON appointments (user_id, appointment_date);');
    await createIndex(queryInterface, 'CREATE INDEX IF NOT EXISTS idx_medicine_reminders_user_active_time ON medicine_reminders (user_id, active, time_of_day);');
    await createIndex(queryInterface, 'CREATE INDEX IF NOT EXISTS idx_report_schedules_active_next_run ON report_schedules (is_active, next_run_at);');
    await createIndex(queryInterface, 'CREATE INDEX IF NOT EXISTS idx_store_orders_user_created ON store_orders (user_id, created_at);');
    await createIndex(queryInterface, 'CREATE INDEX IF NOT EXISTS idx_store_orders_payment_status_created ON store_orders (payment_status, created_at);');
    await createIndex(queryInterface, 'CREATE INDEX IF NOT EXISTS idx_store_order_items_order ON store_order_items (order_id);');
    await createIndex(queryInterface, 'CREATE INDEX IF NOT EXISTS idx_store_order_returns_order_status ON store_order_returns (order_id, status);');
    await createIndex(queryInterface, 'CREATE INDEX IF NOT EXISTS idx_payment_provider_events_store_checkout ON payment_provider_events (store_checkout_intent_id);');
    await createIndex(queryInterface, 'CREATE INDEX IF NOT EXISTS idx_payments_store_order ON payments (store_order_id);');
    await createIndex(queryInterface, 'CREATE INDEX IF NOT EXISTS idx_store_checkout_intents_coupon ON store_checkout_intents (coupon_id);');
  },

  async down(queryInterface, Sequelize) {
    await createIndex(queryInterface, 'DROP INDEX IF EXISTS idx_store_checkout_intents_coupon;');
    await createIndex(queryInterface, 'DROP INDEX IF EXISTS idx_payments_store_order;');
    await createIndex(queryInterface, 'DROP INDEX IF EXISTS idx_payment_provider_events_store_checkout;');
    await createIndex(queryInterface, 'DROP INDEX IF EXISTS idx_store_order_returns_order_status;');
    await createIndex(queryInterface, 'DROP INDEX IF EXISTS idx_store_order_items_order;');
    await createIndex(queryInterface, 'DROP INDEX IF EXISTS idx_store_orders_payment_status_created;');
    await createIndex(queryInterface, 'DROP INDEX IF EXISTS idx_store_orders_user_created;');
    await createIndex(queryInterface, 'DROP INDEX IF EXISTS idx_report_schedules_active_next_run;');
    await createIndex(queryInterface, 'DROP INDEX IF EXISTS idx_medicine_reminders_user_active_time;');
    await createIndex(queryInterface, 'DROP INDEX IF EXISTS idx_appointments_user_date;');
    await createIndex(queryInterface, 'DROP INDEX IF EXISTS idx_support_ticket_messages_ticket_created;');
    await createIndex(queryInterface, 'DROP INDEX IF EXISTS idx_support_tickets_status_priority_sla;');
    await createIndex(queryInterface, 'DROP INDEX IF EXISTS idx_notification_deliveries_provider_message;');
    await createIndex(queryInterface, 'DROP INDEX IF EXISTS idx_reminder_schedules_user_enabled_time;');
    await createIndex(queryInterface, 'DROP INDEX IF EXISTS idx_notifications_user_status_created;');
    await createIndex(queryInterface, 'DROP INDEX IF EXISTS idx_sensory_activity_logs_activity;');
    await createIndex(queryInterface, 'DROP INDEX IF EXISTS idx_partner_activity_logs_activity;');
    await createIndex(queryInterface, 'DROP INDEX IF EXISTS idx_quiz_attempts_question;');
    await createIndex(queryInterface, 'DROP INDEX IF EXISTS uniq_user_achievements_user_badge;');
    await createIndex(queryInterface, 'DROP INDEX IF EXISTS uniq_cart_items_user_product;');
    await createIndex(queryInterface, 'DROP INDEX IF EXISTS idx_user_meal_plans_content_item_id;');
    await createIndex(queryInterface, 'DROP INDEX IF EXISTS idx_testimonials_approved_by;');
    await createIndex(queryInterface, 'DROP INDEX IF EXISTS idx_registered_devices_approved_by;');
    await createIndex(queryInterface, 'DROP INDEX IF EXISTS idx_content_items_reviewed_by;');

    await replaceForeignKey(queryInterface, 'store_checkout_intents', 'store_order_id', 'store_orders', 'id', 'SET NULL');
    await replaceForeignKey(queryInterface, 'store_orders', 'user_id', 'users', 'id', 'CASCADE');
    await replaceForeignKey(queryInterface, 'admin_audit_logs', 'user_id', 'users', 'id', 'CASCADE');
    await replaceForeignKey(queryInterface, 'financial_transactions', 'user_id', 'users', 'id', 'CASCADE');
    await replaceForeignKey(queryInterface, 'invoices', 'user_id', 'users', 'id', 'CASCADE');
    await replaceForeignKey(queryInterface, 'payments', 'user_id', 'users', 'id', 'CASCADE');

    await queryInterface.removeColumn('sensory_activity_logs', 'sensory_activity_id');
    await queryInterface.removeColumn('partner_activity_logs', 'partner_activity_id');
    await queryInterface.removeColumn('quiz_attempts', 'quiz_question_id');
  },
};
