import { RazorpayClient } from './razorpay.client.js';
import { SubscriptionService } from '../subscription/subscription.service.js';
import { FinanceService } from '../finance/finance.service.js';
import { StoreService } from '../store/store.service.js';

export class PaymentReconciliationService {
  constructor(models, sequelize, razorpayClient = new RazorpayClient()) {
    this.models = models;
    this.sequelize = sequelize;
    this.razorpayClient = razorpayClient;
  }

  async reconcileCheckout(viewer, checkoutIntentId) {
    if (viewer.role?.roleType !== 'ADMIN' && viewer.role?.roleType !== 'STAFF') {
      throw new Error('Unauthorized access');
    }

    const checkout = await this.models.PaymentCheckoutIntent.findByPk(checkoutIntentId);
    if (!checkout) throw new Error('Payment checkout intent not found');
    if (!checkout.razorpayOrderId) throw new Error('Payment checkout has no provider order reference');

    const payment = checkout.razorpayPaymentId
      ? await this.razorpayClient.fetchPayment(checkout.razorpayPaymentId, {
          expectedOrderId: checkout.razorpayOrderId,
          expectedAmountMinor: checkout.expectedAmountMinor,
          expectedCurrency: checkout.currency,
        })
      : null;
    const order = await this.razorpayClient.fetchOrder(checkout.razorpayOrderId);

    const actions = [];
    if (payment?.status === 'captured') {
      const service = new SubscriptionService(this.models, this.sequelize, this.razorpayClient);
      await service.confirmCapturedSubscriptionPayment({
        razorpayOrderId: checkout.razorpayOrderId,
        razorpayPaymentId: payment.id,
        amountMinor: payment.amount,
        currency: payment.currency,
        providerStatus: payment.status,
        source: 'manual_reconciliation',
      });
      actions.push('payment_capture_confirmed');
    } else if (order?.status === 'paid' && !payment) {
      actions.push('order_paid_without_payment_id_observed');
    } else {
      actions.push('no_safe_correction');
    }

    return {
      referenceId: checkoutIntentId,
      providerOrderStatus: order?.status || null,
      providerPaymentStatus: payment?.status || null,
      localStatus: checkout.status,
      actions,
      message: actions.includes('payment_capture_confirmed')
        ? 'Provider-captured payment was confirmed locally.'
        : 'No provider-backed local payment correction was applied.',
    };
  }

  async reconcileRefund(viewer, refundId) {
    if (viewer.role?.roleType !== 'ADMIN' && viewer.role?.roleType !== 'STAFF') {
      throw new Error('Unauthorized access');
    }

    const refund = await this.models.PaymentRefund.findByPk(refundId);
    if (!refund) throw new Error('Payment refund not found');
    if (!refund.razorpayRefundId) throw new Error('Payment refund has no provider refund reference');

    const providerRefund = await this.razorpayClient.fetchRefund(refund.razorpayPaymentId, refund.razorpayRefundId);
    const finance = new FinanceService(this.models, this.sequelize, this.razorpayClient);
    const actions = [];
    if (providerRefund.status === 'processed') {
      await this.sequelize.transaction((transaction) => finance.confirmProviderRefundProcessed({
        razorpayRefundId: refund.razorpayRefundId,
        razorpayPaymentId: refund.razorpayPaymentId,
        amountMinor: providerRefund.amount || refund.requestedAmountMinor,
        providerStatus: providerRefund.status,
        transaction,
      }));
      actions.push('refund_processed_confirmed');
    } else if (providerRefund.status === 'failed') {
      await this.sequelize.transaction((transaction) => finance.markProviderRefundFailed({
        razorpayRefundId: refund.razorpayRefundId,
        razorpayPaymentId: refund.razorpayPaymentId,
        providerStatus: providerRefund.status,
        transaction,
      }));
      actions.push('refund_failed_confirmed');
    } else {
      actions.push('no_safe_correction');
    }

    return {
      referenceId: refundId,
      providerOrderStatus: null,
      providerPaymentStatus: providerRefund.status || null,
      localStatus: refund.status,
      actions,
      message: actions.includes('no_safe_correction')
        ? 'No provider-backed refund correction was applied.'
        : 'Provider refund state was reconciled locally.',
    };
  }

  async reconcileStoreCheckout(viewer, checkoutIntentId) {
    if (viewer.role?.roleType !== 'ADMIN' && viewer.role?.roleType !== 'STAFF') {
      throw new Error('Unauthorized access');
    }

    const checkout = await this.models.StoreCheckoutIntent.findByPk(checkoutIntentId);
    if (!checkout) throw new Error('Store checkout intent not found');
    if (!checkout.razorpayOrderId) throw new Error('Store checkout has no provider order reference');

    const payment = checkout.razorpayPaymentId
      ? await this.razorpayClient.fetchPayment(checkout.razorpayPaymentId, {
          expectedOrderId: checkout.razorpayOrderId,
          expectedAmountMinor: checkout.totalMinor,
          expectedCurrency: checkout.currency,
        })
      : null;
    const order = await this.razorpayClient.fetchOrder(checkout.razorpayOrderId);
    const actions = [];

    if (payment?.status === 'captured') {
      const service = new StoreService(this.models, this.sequelize, this.razorpayClient);
      await service.confirmCapturedStorePayment({
        razorpayOrderId: checkout.razorpayOrderId,
        razorpayPaymentId: payment.id,
        amountMinor: payment.amount,
        currency: payment.currency,
        providerStatus: payment.status,
        source: 'manual_store_reconciliation',
      });
      actions.push('store_payment_capture_confirmed');
    } else if (order?.status === 'paid' && !payment) {
      actions.push('store_order_paid_without_payment_id_observed');
    } else {
      actions.push('no_safe_correction');
    }

    return {
      referenceId: checkoutIntentId,
      providerOrderStatus: order?.status || null,
      providerPaymentStatus: payment?.status || null,
      localStatus: checkout.status,
      actions,
      message: actions.includes('store_payment_capture_confirmed')
        ? 'Provider-captured store payment was confirmed locally.'
        : 'No provider-backed store correction was applied.',
    };
  }
}
