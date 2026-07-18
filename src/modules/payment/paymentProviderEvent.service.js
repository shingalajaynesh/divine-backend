import { v4 as uuidv4 } from 'uuid';

export const EVENT_STATUS = Object.freeze({
  RECEIVED: 'RECEIVED',
  PROCESSING: 'PROCESSING',
  PROCESSED: 'PROCESSED',
  IGNORED: 'IGNORED',
  FAILED: 'FAILED',
  RETRY_PENDING: 'RETRY_PENDING',
  DEAD_LETTER: 'DEAD_LETTER',
});

const MAX_ATTEMPTS = 5;

const sanitizeMessage = (message) =>
  String(message || 'Payment provider event processing failed')
    .replace(/rzp_[A-Za-z0-9_]+/g, '[provider-id]')
    .slice(0, 500);

export class PaymentProviderEventService {
  constructor(models) {
    this.models = models;
  }

  async record(eventData, transaction) {
    const now = new Date();
    const existing = await this.models.PaymentProviderEvent.findOne({
      where: {
        provider: eventData.provider,
        providerEventId: eventData.providerEventId,
      },
      transaction,
      lock: transaction?.LOCK?.UPDATE,
    });

    if (existing) {
      existing.lastReceivedAt = now;
      await existing.save({ transaction });
      return { record: existing, duplicate: true };
    }

    const record = await this.models.PaymentProviderEvent.create({
      id: uuidv4(),
      ...eventData,
      processingStatus: EVENT_STATUS.RECEIVED,
      processingAttempts: 0,
      firstReceivedAt: now,
      lastReceivedAt: now,
    }, { transaction });

    return { record, duplicate: false };
  }

  async markProcessing(record, transaction) {
    record.processingStatus = EVENT_STATUS.PROCESSING;
    record.processingAttempts = (record.processingAttempts || 0) + 1;
    record.processingStartedAt = new Date();
    await record.save({ transaction });
  }

  async markProcessed(record, status, checkoutIntentId, transaction, storeCheckoutIntentId = null) {
    record.processingStatus = status;
    record.checkoutIntentId = checkoutIntentId || record.checkoutIntentId || null;
    record.storeCheckoutIntentId = storeCheckoutIntentId || record.storeCheckoutIntentId || null;
    record.processedAt = new Date();
    record.lastErrorCode = null;
    record.lastErrorMessage = null;
    await record.save({ transaction });
  }

  async markFailed(record, error, transaction) {
    const attempts = record.processingAttempts || 0;
    record.processingStatus = attempts >= MAX_ATTEMPTS ? EVENT_STATUS.DEAD_LETTER : EVENT_STATUS.RETRY_PENDING;
    record.lastErrorCode = error.code || error.name || 'PAYMENT_EVENT_PROCESSING_ERROR';
    record.lastErrorMessage = sanitizeMessage(error.message);
    record.nextRetryAt = record.processingStatus === EVENT_STATUS.RETRY_PENDING
      ? new Date(Date.now() + Math.min(attempts + 1, MAX_ATTEMPTS) * 60_000)
      : null;
    await record.save({ transaction });
  }
}
