'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Add Razorpay columns
    await queryInterface.addColumn('payments', 'razorpay_order_id', {
      type: Sequelize.STRING,
      allowNull: true
    });
    await queryInterface.addColumn('payments', 'razorpay_payment_id', {
      type: Sequelize.STRING,
      allowNull: true
    });
    await queryInterface.addColumn('payments', 'razorpay_signature', {
      type: Sequelize.STRING,
      allowNull: true
    });

    // 2. Change stripe_session_id to be nullable
    await queryInterface.changeColumn('payments', 'stripe_session_id', {
      type: Sequelize.STRING,
      allowNull: true
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('payments', 'razorpay_order_id');
    await queryInterface.removeColumn('payments', 'razorpay_payment_id');
    await queryInterface.removeColumn('payments', 'razorpay_signature');
    await queryInterface.changeColumn('payments', 'stripe_session_id', {
      type: Sequelize.STRING,
      allowNull: false
    });
  }
};
