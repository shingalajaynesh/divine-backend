import assert from 'node:assert/strict';
import test from 'node:test';
import { ReportService } from '../src/modules/report/report.service.js';

const VIEWER_STAFF = { id: 'staff_1', role: { roleType: 'STAFF' } };
const VIEWER_MOTHER = { id: 'mother_1', role: { roleType: 'MOTHER' } };

test('ReportService - Template CRUD and dynamic role statistics builders', async () => {
  const mockTemplates = [];
  const mockUsers = [
    { id: 'mother_1', displayName: 'Jane Mother', subscriptionStatus: 'premium', centerId: 'ctr_pune' },
    { id: 'mother_2', displayName: 'Mary Mother', subscriptionStatus: 'standard', centerId: 'ctr_pune' }
  ];
  const mockCenters = [
    { id: 'ctr_pune', name: 'Pune Care Center' }
  ];
  const mockVitals = [
    { id: 'v_1', userId: 'mother_1' },
    { id: 'v_2', userId: 'mother_1' }
  ];
  const mockBookmarks = [
    { id: 'b_1', userId: 'mother_1' }
  ];
  const mockProgress = [
    { id: 'p_1', userId: 'mother_1' }
  ];
  const mockTransactions = [
    { id: 'tx_1', centerId: 'ctr_pune', amount: 1500.00, type: 'payment' }
  ];
  const mockPayments = [
    { id: 'pay_1', amount: 1500.00, status: 'succeeded' }
  ];

  const mockModels = {
    ReportTemplate: {
      create: async (input) => {
        const row = {
          ...input,
          createdAt: new Date(),
          save: async function() { return this; },
          destroy: async function() {
            const idx = mockTemplates.indexOf(this);
            if (idx !== -1) mockTemplates.splice(idx, 1);
          }
        };
        mockTemplates.push(row);
        return row;
      },
      findAll: async (options) => {
        let list = mockTemplates;
        if (options?.where?.role) {
          list = list.filter(t => t.role === options.where.role);
        }
        return list;
      },
      findByPk: async (id) => mockTemplates.find(t => t.id === id) || null
    },
    User: {
      count: async (options) => {
        let list = mockUsers;
        if (options?.where?.centerId) {
          list = list.filter(u => u.centerId === options.where.centerId);
        }
        if (options?.where?.subscriptionStatus) {
          if (Array.isArray(options.where.subscriptionStatus)) {
            list = list.filter(u => options.where.subscriptionStatus.includes(u.subscriptionStatus));
          } else {
            list = list.filter(u => u.subscriptionStatus === options.where.subscriptionStatus);
          }
        }
        return list.length;
      }
    },
    Center: {
      findAll: async () => mockCenters
    },
    VitalsLog: {
      count: async (options) => mockVitals.filter(v => v.userId === options?.where?.userId).length
    },
    ContentBookmark: {
      count: async (options) => mockBookmarks.filter(b => b.userId === options?.where?.userId).length
    },
    ActivityProgress: {
      count: async (options) => mockProgress.filter(p => p.userId === options?.where?.userId).length
    },
    FinancialTransaction: {
      findAll: async (options) => {
        let list = mockTransactions;
        if (options?.where?.centerId) {
          list = list.filter(t => t.centerId === options.where.centerId);
        }
        return list;
      }
    },
    Payment: {
      findAll: async (options) => mockPayments.filter(p => p.status === options?.where?.status)
    }
  };

  const mockSequelize = {};

  const service = new ReportService(mockModels, mockSequelize);

  // 1. Create Report Template
  await assert.rejects(
    service.createReportTemplate(VIEWER_MOTHER, { title: 'Hack', role: 'PLATFORM', widgets: '[]' }),
    /Unauthorized access/
  );

  const template = await service.createReportTemplate(VIEWER_STAFF, {
    title: 'Center Operational Report',
    description: 'Weekly center activity analytics',
    role: 'CENTER',
    filters: JSON.stringify({ centerId: 'ctr_pune' }),
    widgets: JSON.stringify(['active_mothers', 'local_revenue'])
  });
  assert.equal(template.title, 'Center Operational Report');
  assert.equal(mockTemplates.length, 1);

  // 2. Fetch Templates
  const list = await service.getReportTemplates('CENTER');
  assert.equal(list.length, 1);

  const emptyList = await service.getReportTemplates('MOTHER');
  assert.equal(emptyList.length, 0);

  // 3. Compile report metrics for Center scope
  const centerReport = await service.getReportData(VIEWER_STAFF, template.id, JSON.stringify({ centerId: 'ctr_pune' }));
  const centerMetrics = JSON.parse(centerReport.metrics);
  assert.equal(centerMetrics.activeMothers, 2);
  assert.equal(centerMetrics.localRevenue, 1500.00);

  // 4. Create Platform scope report template and test platform compilation
  const platTemplate = await service.createReportTemplate(VIEWER_STAFF, {
    title: 'Platform Summary',
    description: 'Global operations metrics',
    role: 'PLATFORM',
    filters: '{}',
    widgets: '["total_users", "revenue"]'
  });

  const platReport = await service.getReportData(VIEWER_STAFF, platTemplate.id, '{}');
  const platMetrics = JSON.parse(platReport.metrics);
  assert.equal(platMetrics.totalUsers, 2);
  assert.equal(platMetrics.premiumUsers, 1);
  assert.equal(platMetrics.grossRevenue, 1500.00);

  // 5. Delete Report template
  await assert.rejects(
    service.deleteReportTemplate(VIEWER_MOTHER, template.id),
    /Unauthorized access/
  );

  const delResult = await service.deleteReportTemplate(VIEWER_STAFF, template.id);
  assert.equal(delResult, true);
  assert.equal(mockTemplates.find(t => t.id === template.id), undefined);
});
