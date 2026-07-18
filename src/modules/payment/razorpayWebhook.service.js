import { v4 as uuidv4 } from 'uuid';
import { hashValue, verifyRazorpayWebhookSignature } from './razorpaySignature.service.js';
import { EVENT_STATUS, PaymentProviderEventService } from './paymentProviderEvent.service.js';
import { SubscriptionService } from '../subscription/subscription.service.js';
import { StoreService } from '../store/store.service.js';
import { FinanceService } from '../finance/finance.service.js';
import { PAYMENT_STATUS } from './paymentState.js';

const PROVIDER = 'razorpay';

const getEntity = (payload, key) => payload?.payload?.[key]?.entity || null;

const extractIdentifiers = (payload) => {
  const payment = getEntity(payload, 'payment');
  const order = getEntity(payload, 'order');
  const refund = getEntity(payload, 'refund');
  return {
    eventType: payload?.event || 'unknown',
    razorpayOrderId: payment?.order_id || order?.id || refund?.notes?.razorpay_order_id || null,
    razorpayPaymentId: payment?.id || refund?.payment_id || null,
    razorpayRefundId: refund?.id || null,
  };
};

const makeProviderEventId = (payload, payloadHash, identifiers) =>
  payload?.id ||
  payload?.event_id ||
  `${identifiers.eventType}:${identifiers.razorpayOrderId || 'no_order'}:${identifiers.razorpayPaymentId || 'no_payment'}:${identifiers.razorpayRefundId || 'no_refund'}:${payloadHash}`;

export class RazorpayWebhookService {
  constructor(models, sequelize, logger) {
    this.models = models;
    this.sequelize = sequelize;
    this.logger = logger;
    this.eventService = new PaymentProviderEventService(models);
    this.handlers = {
      'payment.authorized': this.handlePaymentAuthorized.bind(this),
      'payment.captured': this.handlePaymentCaptured.bind(this),
      'payment.failed': this.handlePaymentFailed.bind(this),
      'order.paid': this.handleOrderPaid.bind(this),
      'refund.created': this.handleRefundCreated.bind(this),
      'refund.processed': this.handleRefundProcessed.bind(this),
      'refund.failed': this.handleRefundFailed.bind(this),
    };
  }

  parseVerifiedPayload(rawBody, signature) {
    verifyRazorpayWebhookSignature({
      rawBody,
      signature,
      secret: process.env.RAZORPAY_WEBHOOK_SECRET,
    });
    try {
      return JSON.parse(rawBody.toString('utf8'));
    } catch {
      const error = new Error('Malformed Razorpay webhook JSON');
      error.statusCode = 400;
      throw error;
    }
  }

  async process(rawBody, signature, correlationId = uuidv4()) {
    const payload = this.parseVerifiedPayload(rawBody, signature);
    const payloadHash = hashValue(rawBody);
    const signatureHash = hashValue(signature || '');
    const identifiers = extractIdentifiers(payload);
    const providerEventId = makeProviderEventId(payload, payloadHash, identifiers);

    return this.sequelize.transaction(async (t) => {
      const { record, duplicate } = await this.eventService.record({
        provider: PROVIDER,
        providerEventId,
        eventType: identifiers.eventType,
        payloadHash,
        signatureHash,
        razorpayOrderId: identifiers.razorpayOrderId,
        razorpayPaymentId: identifiers.razorpayPaymentId,
        razorpayRefundId: identifiers.razorpayRefundId,
        correlationId,
      }, t);

      if (duplicate && [EVENT_STATUS.PROCESSED, EVENT_STATUS.IGNORED].includes(record.processingStatus)) {
        return { status: 'duplicate', event: record };
      }

      await this.eventService.markProcessing(record, t);
      const handler = this.handlers[identifiers.eventType];
      if (!handler) {
        await this.eventService.markProcessed(record, EVENT_STATUS.IGNORED, null, t);
        return { status: 'ignored', event: record };
      }

      try {
        const result = await handler(payload, t);
        await this.eventService.markProcessed(record, result.ignored ? EVENT_STATUS.IGNORED : EVENT_STATUS.PROCESSED, result.checkoutIntentId, t, result.storeCheckoutIntentId);
        return { status: result.ignored ? 'ignored' : 'processed', event: record, result };
      } catch (error) {
        await this.eventService.markFailed(record, error, t);
        throw error;
      }
    });
  }

  async handlePaymentAuthorized(payload, transaction) {
    const payment = getEntity(payload, 'payment');
    if (!payment?.order_id || !payment?.id) return { ignored: true };
    const storeCheckout = await this.models.StoreCheckoutIntent?.findOne?.({
      where: { razorpayOrderId: payment.order_id },
      transaction,
      lock: transaction?.LOCK?.UPDATE,
    });
    if (storeCheckout) {
      storeCheckout.razorpayPaymentId = payment.id;
      storeCheckout.status = storeCheckout.status === 'order_created' ? 'client_verified' : storeCheckout.status;
      await storeCheckout.save({ transaction });
      return { storeCheckoutIntentId: storeCheckout.id };
    }
    const service = new SubscriptionService(this.models, this.sequelize);
    const checkout = await service.markAuthorizedPayment({
      razorpayOrderId: payment.order_id,
      razorpayPaymentId: payment.id,
      providerStatus: payment.status,
      transaction,
    });
    return { checkoutIntentId: checkout?.id || null, ignored: !checkout };
  }

  async handlePaymentCaptured(payload, transaction) {
    const payment = getEntity(payload, 'payment');
    if (!payment?.order_id || !payment?.id) return { ignored: true };
    const storeCheckout = await this.models.StoreCheckoutIntent?.findOne?.({
      where: { razorpayOrderId: payment.order_id },
      transaction,
      lock: transaction?.LOCK?.UPDATE,
    });
    if (storeCheckout) {
      const service = new StoreService(this.models, this.sequelize);
      const result = await service.confirmCapturedStorePayment({
        razorpayOrderId: payment.order_id,
        razorpayPaymentId: payment.id,
        amountMinor: payment.amount,
        currency: payment.currency,
        providerStatus: payment.status,
        source: 'webhook:payment.captured',
        transaction,
      });
      return { storeCheckoutIntentId: result?.checkout?.id || storeCheckout.id };
    }
    const service = new SubscriptionService(this.models, this.sequelize);
    const result = await service.confirmCapturedSubscriptionPayment({
      razorpayOrderId: payment.order_id,
      razorpayPaymentId: payment.id,
      amountMinor: payment.amount,
      currency: payment.currency,
      providerStatus: payment.status,
      source: 'webhook:payment.captured',
      transaction,
    });
    return { checkoutIntentId: result.checkout.id };
  }

  async handleOrderPaid(payload, transaction) {
    const order = getEntity(payload, 'order');
    if (!order?.id) return { ignored: true };
    const storeCheckout = await this.models.StoreCheckoutIntent?.findOne?.({
      where: { razorpayOrderId: order.id },
      transaction,
      lock: transaction?.LOCK?.UPDATE,
    });
    if (storeCheckout) {
      storeCheckout.status = storeCheckout.status === 'paid' ? storeCheckout.status : 'client_verified';
      await storeCheckout.save({ transaction });
      return { storeCheckoutIntentId: storeCheckout.id };
    }
    const checkout = await this.models.PaymentCheckoutIntent.findOne({
      where: { razorpayOrderId: order.id },
      transaction,
      lock: transaction?.LOCK?.UPDATE,
    });
    if (!checkout) return { ignored: true };
    if ([PAYMENT_STATUS.CAPTURED, 'paid'].includes(checkout.providerStatus) || checkout.status === 'paid') {
      return { checkoutIntentId: checkout.id };
    }
    checkout.providerStatus = order.status || 'paid';
    await checkout.save({ transaction });
    return { checkoutIntentId: checkout.id };
  }

  async handlePaymentFailed(payload, transaction) {
    const payment = getEntity(payload, 'payment');
    if (!payment?.order_id) return { ignored: true };
    const storeCheckout = await this.models.StoreCheckoutIntent?.findOne?.({
      where: { razorpayOrderId: payment.order_id },
      transaction,
      lock: transaction?.LOCK?.UPDATE,
    });
    if (storeCheckout) {
      const service = new StoreService(this.models, this.sequelize);
      const checkout = await service.markStorePaymentFailed({
        razorpayOrderId: payment.order_id,
        razorpayPaymentId: payment.id,
        failureCode: payment.error_code,
        failureMessage: payment.error_description || payment.error_reason,
        transaction,
      });
      return { storeCheckoutIntentId: checkout?.id || null, ignored: !checkout };
    }
    const service = new SubscriptionService(this.models, this.sequelize);
    const checkout = await service.markFailedPayment({
      razorpayOrderId: payment.order_id,
      razorpayPaymentId: payment.id,
      providerStatus: payment.status || 'failed',
      failureReason: payment.error_description || payment.error_reason || payment.error_code || 'Razorpay payment failed',
      transaction,
    });
    return { checkoutIntentId: checkout?.id || null, ignored: !checkout };
  }

  async handleRefundCreated(payload, transaction) {
    const refund = getEntity(payload, 'refund');
    if (!refund?.id) return { ignored: true };
    const service = new FinanceService(this.models, this.sequelize);
    const row = await service.markProviderRefundCreated({
      razorpayRefundId: refund.id,
      razorpayPaymentId: refund.payment_id,
      providerStatus: refund.status,
      transaction,
    });
    return { checkoutIntentId: row?.checkoutIntentId || null, ignored: !row };
  }

  async handleRefundProcessed(payload, transaction) {
    const refund = getEntity(payload, 'refund');
    if (!refund?.id) return { ignored: true };
    const service = new FinanceService(this.models, this.sequelize);
    const row = await service.confirmProviderRefundProcessed({
      razorpayRefundId: refund.id,
      razorpayPaymentId: refund.payment_id,
      amountMinor: refund.amount,
      providerStatus: refund.status,
      transaction,
    });
    return { checkoutIntentId: row?.checkoutIntentId || null, ignored: !row };
  }

  async handleRefundFailed(payload, transaction) {
    const refund = getEntity(payload, 'refund');
    if (!refund?.id) return { ignored: true };
    const service = new FinanceService(this.models, this.sequelize);
    const row = await service.markProviderRefundFailed({
      razorpayRefundId: refund.id,
      razorpayPaymentId: refund.payment_id,
      providerStatus: refund.status,
      failureCode: refund.error_code,
      failureMessage: refund.error_description,
      transaction,
    });
    return { checkoutIntentId: row?.checkoutIntentId || null, ignored: !row };
  }
}
