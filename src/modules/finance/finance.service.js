import { v4 as uuidv4 } from 'uuid';

export class FinanceService {
  constructor(models, sequelize) {
    this.models = models;
    this.sequelize = sequelize;
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
      } else if (tx.type === 'refund') {
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

      if (parseFloat(refundAmount) > parseFloat(payment.amount)) {
        throw new Error('Refund amount exceeds original payment amount');
      }

      // Check if user has a center associated
      const user = await this.models.User.findByPk(payment.userId, { transaction: t });
      const centerId = user?.centerId || null;

      // Update payment status
      payment.status = 'refunded';
      await payment.save({ transaction: t });

      // Generate refund transaction ledger entry
      const refTx = await this.models.FinancialTransaction.create({
        id: uuidv4(),
        userId: payment.userId,
        centerId,
        amount: parseFloat(refundAmount),
        type: 'refund',
        status: 'completed',
        centerShare: parseFloat(refundAmount) * 0.70, // 70% share reversed
        platformShare: parseFloat(refundAmount) * 0.30, // 30% share reversed
        paymentId: payment.id,
        reconciliationNotes: reason?.trim() || 'Customer refund processed'
      }, { transaction: t });

      // Create a refund invoice receipt
      await this.models.Invoice.create({
        id: uuidv4(),
        userId: payment.userId,
        paymentId: payment.id,
        amount: -parseFloat(refundAmount),
        status: 'refunded',
        invoiceNumber: `REF-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        billingDate: new Date(),
        dueDate: new Date()
      }, { transaction: t });

      return refTx;
    });
  }
}
