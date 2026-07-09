import assert from 'node:assert/strict';
import test from 'node:test';
import { FinanceService } from '../src/modules/finance/finance.service.js';

const VIEWER_STAFF = { id: '66666666-6666-4666-a666-666666666666', role: { roleType: 'STAFF' } };
const VIEWER_MOTHER = { id: '77777777-7777-4777-a777-777777777777', role: { roleType: 'MOTHER' } };

test('FinanceService - Revenue report aggregates, payment reconciliation, and refunds', async () => {
  const mockTransactions = [];
  const mockPayments = [];
  const mockInvoices = [];
  const mockUsers = [
    { id: 'usr_abc', displayName: 'Customer A', centerId: 'ctr_delhi', save: async function() { return this; } }
  ];
  const mockCenters = [
    { id: 'ctr_delhi', name: 'Delhi Hub' }
  ];

  // Seed sample payments & corresponding transactions
  mockPayments.push({
    id: 'pay_1',
    userId: 'usr_abc',
    amount: 1000.00,
    status: 'succeeded',
    save: async function() { return this; }
  });

  mockTransactions.push({
    id: 'tx_1',
    userId: 'usr_abc',
    centerId: 'ctr_delhi',
    amount: 1000.00,
    type: 'payment',
    status: 'completed',
    centerShare: 700.00,
    platformShare: 300.00,
    paymentId: 'pay_1',
    invoiceId: 'inv_1',
    reconciledAt: null,
    reconciliationNotes: null,
    save: async function() { return this; }
  });

  const mockModels = {
    Sequelize: {
      Op: {
        gte: Symbol('gte'),
        lte: Symbol('lte')
      }
    },
    FinancialTransaction: {
      findAll: async (options) => {
        let list = [...mockTransactions];
        if (options?.where?.centerId) {
          list = list.filter(t => t.centerId === options.where.centerId);
        }
        if (options?.where?.type) {
          list = list.filter(t => t.type === options.where.type);
        }
        return list;
      },
      findByPk: async (id) => mockTransactions.find(t => t.id === id) || null,
      create: async (input) => {
        const row = {
          ...input,
          createdAt: new Date(),
          save: async function() { return this; }
        };
        mockTransactions.push(row);
        return row;
      }
    },
    Payment: {
      findByPk: async (id) => mockPayments.find(p => p.id === id) || null
    },
    Invoice: {
      create: async (input) => {
        const row = {
          ...input,
          save: async function() { return this; }
        };
        mockInvoices.push(row);
        return row;
      }
    },
    User: {
      findByPk: async (id) => mockUsers.find(u => u.id === id) || null
    },
    Center: {
      findByPk: async (id) => mockCenters.find(c => c.id === id) || null
    }
  };

  const mockSequelize = {
    transaction: async (cb) => {
      return cb({});
    }
  };

  const service = new FinanceService(mockModels, mockSequelize);

  // 1. Fetch initial financial report
  const initialReport = await service.getFinancialReport(null, null, null);
  assert.equal(initialReport.totalRevenue, 1000.00);
  assert.equal(initialReport.totalRefunds, 0.00);
  assert.equal(initialReport.netRevenue, 1000.00);
  assert.equal(initialReport.totalCenterShare, 700.00);
  assert.equal(initialReport.totalPlatformShare, 300.00);
  assert.equal(initialReport.transactionCount, 1);
  assert.equal(initialReport.reconciledCount, 0);

  // 2. Fetch list of transactions
  const txsList = await service.getFinancialTransactions('ctr_delhi', 'payment');
  assert.equal(txsList.length, 1);
  assert.equal(txsList[0].id, 'tx_1');

  // 3. Mark transaction as reconciled (security gate + action)
  await assert.rejects(
    service.reconcileTransaction(VIEWER_MOTHER, 'tx_1', 'Audit okay'),
    /Unauthorized access/
  );

  const reconciledTx = await service.reconcileTransaction(VIEWER_STAFF, 'tx_1', 'Bank settlement matches batch 42');
  assert.ok(reconciledTx.reconciledAt);
  assert.equal(reconciledTx.reconciliationNotes, 'Bank settlement matches batch 42');

  const reportAfterReconcile = await service.getFinancialReport(null, null, null);
  assert.equal(reportAfterReconcile.reconciledCount, 1);

  // 4. Refund handling (security gate + reverse ledger entry creation)
  await assert.rejects(
    service.refundTransaction(VIEWER_MOTHER, 'pay_1', 200.00, 'Customer changed mind'),
    /Unauthorized access/
  );

  await assert.rejects(
    service.refundTransaction(VIEWER_STAFF, 'pay_1', 1200.00, 'Too much refund'),
    /Refund amount exceeds original payment amount/
  );

  const refundTx = await service.refundTransaction(VIEWER_STAFF, 'pay_1', 400.00, 'Partial refund');
  assert.equal(refundTx.type, 'refund');
  assert.equal(refundTx.amount, 400.00);
  assert.equal(refundTx.centerShare, 280.00); // 70% of 400
  assert.equal(refundTx.platformShare, 120.00); // 30% of 400

  // 5. Verify revised aggregates after partial refund
  const finalReport = await service.getFinancialReport(null, null, null);
  assert.equal(finalReport.totalRevenue, 1000.00); // Gross revenue unchanged
  assert.equal(finalReport.totalRefunds, 400.00); // Refund tracked
  assert.equal(finalReport.netRevenue, 600.00); // Net revenue reduced
  assert.equal(finalReport.totalCenterShare, 420.00); // Center share reduced: 700 - 280 = 420
  assert.equal(finalReport.totalPlatformShare, 180.00); // Platform share reduced: 300 - 120 = 180
});
