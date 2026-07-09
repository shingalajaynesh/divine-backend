import assert from 'node:assert/strict';
import test from 'node:test';
import { ReportScheduleService } from '../src/modules/report/reportSchedule.service.js';

const VIEWER_STAFF = { id: 'staff_1', role: { roleType: 'STAFF' } };
const VIEWER_MOTHER = { id: 'mother_1', role: { roleType: 'MOTHER' } };

test('ReportScheduleService - Schedule creation, Sharing rules, and Dispatch Runner simulation', async () => {
  const mockTemplates = [
    { id: 'tpl_1', title: 'Monthly Center Metrics', role: 'CENTER', filters: '{}', widgets: '[]', sharedWithRoles: null, save: async function() { return this; } }
  ];
  const mockSchedules = [];

  const mockModels = {
    ReportTemplate: {
      findByPk: async (id) => mockTemplates.find(t => t.id === id) || null
    },
    ReportSchedule: {
      create: async (input) => {
        const row = {
          ...input,
          createdAt: new Date(),
          save: async function() { return this; },
          destroy: async function() {
            const idx = mockSchedules.indexOf(this);
            if (idx !== -1) mockSchedules.splice(idx, 1);
          }
        };
        mockSchedules.push(row);
        return row;
      },
      findAll: async (options) => {
        let list = mockSchedules;
        if (options?.where?.isActive === true && options?.where?.nextRunAt) {
          const lteVal = options.where.nextRunAt[mockModels.Sequelize.Op.lte];
          list = list.filter(s => s.isActive && s.nextRunAt <= lteVal);
        }
        return list;
      },
      findByPk: async (id) => mockSchedules.find(s => s.id === id) || null
    },
    Sequelize: {
      Op: {
        lte: Symbol('lte')
      }
    },
    User: { count: async () => 5 },
    Center: { findAll: async () => [] },
    VitalsLog: { count: async () => 0 },
    ContentBookmark: { count: async () => 0 },
    ActivityProgress: { count: async () => 0 },
    FinancialTransaction: { findAll: async () => [] },
    Payment: { findAll: async () => [] }
  };

  const mockSequelize = {};

  const service = new ReportScheduleService(mockModels, mockSequelize);

  // 1. Share Report Template
  await assert.rejects(
    service.shareReportTemplate(VIEWER_MOTHER, 'tpl_1', 'CENTER,FRANCHISE'),
    /Unauthorized access/
  );

  const sharedTpl = await service.shareReportTemplate(VIEWER_STAFF, 'tpl_1', 'CENTER,FRANCHISE');
  assert.equal(sharedTpl.sharedWithRoles, 'CENTER,FRANCHISE');

  // 2. Create Schedule
  await assert.rejects(
    service.createReportSchedule(VIEWER_MOTHER, { templateId: 'tpl_1', frequency: 'weekly', recipientEmails: 'test@mail.com' }),
    /Unauthorized access/
  );

  const sched = await service.createReportSchedule(VIEWER_STAFF, {
    templateId: 'tpl_1',
    frequency: 'daily',
    recipientEmails: 'partner@divine.com, admin@divine.com'
  });
  assert.equal(sched.frequency, 'daily');
  assert.equal(sched.recipientEmails, 'partner@divine.com, admin@divine.com');
  assert.equal(mockSchedules.length, 1);

  // 3. Process Scheduled Reports Simulation
  // Initially nextRunAt is in the future, so nothing should be dispatched
  const emptyDispatches = await service.processScheduledReports();
  assert.equal(emptyDispatches.length, 0);

  // Artificially move nextRunAt to the past to trigger dispatch
  sched.nextRunAt = new Date(Date.now() - 10000);

  const dispatches = await service.processScheduledReports();
  assert.equal(dispatches.length, 1);
  assert.equal(dispatches[0].scheduleId, sched.id);
  assert.equal(dispatches[0].recipientEmails, 'partner@divine.com, admin@divine.com');

  // Assert nextRunAt was incremented to the future (approx 24 hours later)
  assert.ok(sched.nextRunAt > new Date());

  // 4. Delete Schedule
  await assert.rejects(
    service.deleteReportSchedule(VIEWER_MOTHER, sched.id),
    /Unauthorized access/
  );

  const delResult = await service.deleteReportSchedule(VIEWER_STAFF, sched.id);
  assert.equal(delResult, true);
  assert.equal(mockSchedules.length, 0);
});
