import { v4 as uuidv4 } from 'uuid';
import { RazorpayClient } from '../payment/razorpay.client.js';
import { CHECKOUT_STATUS, PAYMENT_STATUS, REFUND_STATUS, setCheckoutStatus, setPaymentStatus } from '../payment/paymentState.js';

export class FinanceService {
  constructor(models, sequelize, razorpayClient = new RazorpayClient()) {
    this.models = models;
    this.sequelize = sequelize;
    this.razorpayClient = razorpayClient;
  }

  // 1. Get Financial Report/Summary Analytics
  async getFinancialReport(startDate, endDate, centerId) {
    const { Op } = this.models.Sequelize || { Op: {} };
    const where = {};

    if (centerId) {
      where.centerId = centerId;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt[Op.gte] = new Date(startDate);
      }
      if (endDate) {
        where.createdAt[Op.lte] = new Date(endDate);
      }
    }

    const txs = await this.models.FinancialTransaction.findAll({ where });

    let totalRevenue = 0;
    let totalRefunds = 0;
    let totalCenterShare = 0;
    let totalPlatformShare = 0;
    let transactionCount = 0;
    let reconciledCount = 0;

    for (const tx of txs) {
      const amt = parseFloat(tx.amount) || 0;
      const cShare = parseFloat(tx.centerShare) || 0;
      const pShare = parseFloat(tx.platformShare) || 0;

      if (tx.type === 'payment') {
        totalRevenue += amt;
        totalCenterShare += cShare;
        totalPlatformShare += pShare;
        transactionCount += 1;
      } else if (tx.type === 'refund' && tx.status === 'completed') {
        totalRefunds += amt;
        totalCenterShare -= cShare;
        totalPlatformShare -= pShare;
      }

      if (tx.reconciledAt) {
        reconciledCount += 1;
      }
    }

    return {
      totalRevenue,
      totalRefunds,
      netRevenue: totalRevenue - totalRefunds,
      totalCenterShare,
      totalPlatformShare,
      transactionCount,
      reconciledCount
    };
  }

  // 2. Fetch Ledger List
  async getFinancialTransactions(centerId, type) {
    const where = {};
    if (centerId) where.centerId = centerId;
    if (type) where.type = type;

    return this.models.FinancialTransaction.findAll({
      where,
      include: [
        { model: this.models.User, as: 'user' },
        { model: this.models.Center, as: 'center' },
        { model: this.models.Payment, as: 'payment' },
        { model: this.models.Invoice, as: 'invoice' }
      ],
      order: [['createdAt', 'DESC']]
    });
  }

  // 3. Reconcile Payment
  async reconcileTransaction(viewer, transactionId, notes) {
    if (viewer.role?.roleType !== 'ADMIN' && viewer.role?.roleType !== 'STAFF') {
      throw new Error('Unauthorized access');
    }

    const tx = await this.models.FinancialTransaction.findByPk(transactionId);
    if (!tx) throw new Error('Financial transaction not found');

    tx.reconciledAt = new Date();
    tx.reconciliationNotes = notes?.trim() || null;
    await tx.save();

    return tx;
  }

  // 4. Record Refund
  async refundTransaction(viewer, paymentId, refundAmount, reason) {
    if (viewer.role?.roleType !== 'ADMIN' && viewer.role?.roleType !== 'STAFF') {
      throw new Error('Unauthorized access');
    }

    return this.sequelize.transaction(async (t) => {
      const payment = await this.models.Payment.findByPk(paymentId, { transaction: t });
      if (!payment) throw new Error('Payment not found');
      if (!['captured', 'succeeded', 'partially_refunded'].includes(payment.status)) {
        throw new Error('Only captured payments can be refunded');
      }
      if (!payment.razorpayPaymentId) {
        throw new Error('Payment is missing Razorpay payment reference');
      }

      const refundAmountMinor = this.decimalToMinorUnits(refundAmount);
      const capturedAmountMinor = payment.amountMinor || this.decimalToMinorUnits(payment.amount);
      const alreadyRefundedMinor = payment.totalRefundedMinor || 0;

      if (refundAmountMinor <= 0) {
        throw new Error('Refund amount must be greater than zero');
      }
      if (alreadyRefundedMinor + refundAmountMinor > capturedAmountMinor) {
        throw new Error('Refund amount exceeds original payment amount');
      }

      // Check if user has a center associated
      const user = await this.models.User.findByPk(payment.userId, { transaction: t });
      const centerId = user?.centerId || null;
      const idempotencyKey = `refund:${payment.id}:${refundAmountMinor}:${String(reason || '').trim().toLowerCase().slice(0, 80)}`;
      const existingRefund = await this.models.PaymentRefund?.findOne?.({
        where: { idempotencyKey },
        transaction: t,
        lock: t.LOCK?.UPDATE
      });
      if (existingRefund?.financialTransactionId) {
        return this.models.FinancialTransaction.findByPk(existingRefund.financialTransactionId, { transaction: t });
      }

      const refund = await this.models.PaymentRefund.create({
        id: uuidv4(),
        paymentId: payment.id,
        checkoutIntentId: payment.checkoutIntentId || null,
        razorpayPaymentId: payment.razorpayPaymentId,
        requestedAmountMinor: refundAmountMinor,
        processedAmountMinor: 0,
        currency: payment.currency || 'INR',
        reason: reason?.trim() || null,
        requestedByUserId: viewer.id,
        status: REFUND_STATUS.REQUESTED,
        providerStatus: null,
        idempotencyKey,
        requestedAt: new Date(),
      }, { transaction: t });

      const providerRefund = await this.razorpayClient.initiateRefund({
        paymentId: payment.razorpayPaymentId,
        amountMinor: refundAmountMinor,
        receipt: refund.id,
        idempotencyKey,
        notes: {
          refund_id: refund.id,
          payment_id: payment.id,
          checkout_intent_id: payment.checkoutIntentId || '',
        },
      });

      refund.razorpayRefundId = providerRefund.id;
      refund.providerStatus = providerRefund.status || 'created';
      refund.status = REFUND_STATUS.PROVIDER_CREATED;

      setPaymentStatus(payment, PAYMENT_STATUS.REFUND_PENDING);
      payment.providerStatus = payment.providerStatus || 'captured';
      await payment.save({ transaction: t });

      const refTx = await this.models.FinancialTransaction.create({
        id: uuidv4(),
        userId: payment.userId,
        centerId,
        amount: parseFloat(refundAmount),
        type: 'refund',
        status: 'pending',
        centerShare: parseFloat(refundAmount) * 0.70, // 70% share reversed
        platformShare: parseFloat(refundAmount) * 0.30, // 30% share reversed
        paymentId: payment.id,
        reconciliationNotes: reason?.trim() || 'Customer refund processed'
      }, { transaction: t });

      refund.financialTransactionId = refTx.id;
      await refund.save({ transaction: t });
      return refTx;
    });
  }

  decimalToMinorUnits(value) {
    const normalized = String(value).trim();
    const match = normalized.match(/^(\d+)(?:\.(\d{1,2}))?$/);
    if (!match) throw new Error('Invalid monetary amount');
    return (Number.parseInt(match[1], 10) * 100) + (Number.parseInt((match[2] || '').padEnd(2, '0'), 10) || 0);
  }

  minorUnitsToDecimal(amountMinor) {
    return Number((amountMinor / 100).toFixed(2));
  }

  async markProviderRefundCreated({ razorpayRefundId, razorpayPaymentId, providerStatus, transaction }) {
    const refund = await this.findRefund(razorpayRefundId, razorpayPaymentId, transaction);
    if (!refund) return null;
    if (refund.status !== REFUND_STATUS.PROCESSED) {
      refund.status = REFUND_STATUS.PROVIDER_CREATED;
      refund.providerStatus = providerStatus || 'created';
      await refund.save({ transaction });
    }
    return refund;
  }

  async confirmProviderRefundProcessed({ razorpayRefundId, razorpayPaymentId, amountMinor, providerStatus, transaction }) {
    const refund = await this.findRefund(razorpayRefundId, razorpayPaymentId, transaction);
    if (!refund) return null;
    if (refund.status === REFUND_STATUS.PROCESSED) return refund;

    const payment = await this.models.Payment.findByPk(refund.paymentId, {
      transaction,
      lock: transaction?.LOCK?.UPDATE,
    });
    if (!payment) throw new Error('Original payment not found for refund');

    const processedAmountMinor = Number(amountMinor || refund.requestedAmountMinor);
    if (processedAmountMinor > refund.requestedAmountMinor) {
      throw new Error('Provider refund amount exceeds requested refund amount');
    }
    const capturedAmountMinor = payment.amountMinor || this.decimalToMinorUnits(payment.amount);
    const totalRefundedMinor = (payment.totalRefundedMinor || 0) + processedAmountMinor;
    if (totalRefundedMinor > capturedAmountMinor) {
      throw new Error('Refund total exceeds captured payment amount');
    }

    refund.status = REFUND_STATUS.PROCESSED;
    refund.providerStatus = providerStatus || 'processed';
    refund.processedAmountMinor = processedAmountMinor;
    refund.processedAt = new Date();

    let refTx = refund.financialTransactionId
      ? await this.models.FinancialTransaction.findByPk(refund.financialTransactionId, { transaction })
      : null;
    const user = await this.models.User.findByPk(payment.userId, { transaction });
    const centerId = user?.centerId || null;
    const amount = this.minorUnitsToDecimal(processedAmountMinor);

    if (!refTx) {
      refTx = await this.models.FinancialTransaction.create({
        id: uuidv4(),
        userId: payment.userId,
        centerId,
        amount,
        type: 'refund',
        status: 'completed',
        centerShare: amount * 0.70,
        platformShare: amount * 0.30,
        paymentId: payment.id,
        reconciliationNotes: refund.reason || 'Provider refund processed'
      }, { transaction });
      refund.financialTransactionId = refTx.id;
    } else {
      refTx.status = 'completed';
      refTx.amount = amount;
      refTx.centerShare = amount * 0.70;
      refTx.platformShare = amount * 0.30;
      await refTx.save({ transaction });
    }

    if (!refund.invoiceId) {
      const invoice = await this.models.Invoice.create({
        id: uuidv4(),
        userId: payment.userId,
        paymentId: payment.id,
        amount: -amount,
        status: 'refunded',
        invoiceNumber: `REF-${refund.id}`,
        billingDate: new Date(),
        dueDate: new Date()
      }, { transaction });
      refund.invoiceId = invoice.id;
      refTx.invoiceId = invoice.id;
      await refTx.save({ transaction });
    }

    payment.totalRefundedMinor = totalRefundedMinor;
    setPaymentStatus(payment, totalRefundedMinor === capturedAmountMinor ? PAYMENT_STATUS.REFUNDED : PAYMENT_STATUS.PARTIALLY_REFUNDED);
    await payment.save({ transaction });

    if (payment.storeOrderId && this.models.StoreOrder) {
      const storeOrder = await this.models.StoreOrder.findByPk(payment.storeOrderId, {
        transaction,
        lock: transaction?.LOCK?.UPDATE,
      });
      if (storeOrder) {
        storeOrder.paymentStatus = payment.status;
        await storeOrder.save({ transaction });
      }
    }

    if (payment.checkoutIntentId) {
      const checkout = await this.models.PaymentCheckoutIntent.findByPk(payment.checkoutIntentId, {
        transaction,
        lock: transaction?.LOCK?.UPDATE,
      });
      if (checkout) {
        checkout.totalRefundedMinor = totalRefundedMinor;
        setCheckoutStatus(checkout, totalRefundedMinor === capturedAmountMinor ? CHECKOUT_STATUS.REFUNDED : CHECKOUT_STATUS.PARTIALLY_REFUNDED);
        await checkout.save({ transaction });
      }
    }

    await refund.save({ transaction });
    return refund;
  }

  async markProviderRefundFailed({ razorpayRefundId, razorpayPaymentId, providerStatus, failureCode, failureMessage, transaction }) {
    const refund = await this.findRefund(razorpayRefundId, razorpayPaymentId, transaction);
    if (!refund || refund.status === REFUND_STATUS.PROCESSED) return refund;
    refund.status = REFUND_STATUS.FAILED;
    refund.providerStatus = providerStatus || 'failed';
    refund.failureCode = failureCode || null;
    refund.failureMessage = String(failureMessage || 'Provider refund failed').slice(0, 500);
    await refund.save({ transaction });
    return refund;
  }

  async findRefund(razorpayRefundId, razorpayPaymentId, transaction) {
    const where = razorpayRefundId ? { razorpayRefundId } : { razorpayPaymentId };
    return this.models.PaymentRefund?.findOne?.({
      where,
      transaction,
      lock: transaction?.LOCK?.UPDATE,
    }) || null;
  }
}
