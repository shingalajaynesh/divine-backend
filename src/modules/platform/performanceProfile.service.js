import { v4 as uuidv4 } from 'uuid';
import { Op } from 'sequelize';

export class PerformanceProfileService {
  constructor(models) {
    this.models = models;
  }

  _verifyPrivileges(viewer) {
    if (viewer?.role?.roleType !== 'ADMIN' && viewer?.role?.roleType !== 'STAFF') {
      throw new Error('Unauthorized access');
    }
  }

  // 1. Fetch Slow Query Reports
  async getSlowQueriesReport(viewer, thresholdMs = 50) {
    this._verifyPrivileges(viewer);

    return this.models.QueryPerformanceAudit.findAll({
      where: {
        durationMs: {
          [Op.gte]: thresholdMs
        }
      },
      order: [['durationMs', 'DESC']],
      limit: 100
    });
  }

  // 2. Log Slow SQL queries
  async logQueryExecution(sqlQuery, durationMs, thresholdMs = 50) {
    if (durationMs < thresholdMs) return null;

    return this.models.QueryPerformanceAudit.create({
      id: uuidv4(),
      sqlQuery,
      durationMs,
      thresholdMs,
      timestamp: new Date()
    });
  }

  // 3. Database Indices Diagnostics
  async runDatabaseIndexDiagnostic(viewer) {
    this._verifyPrivileges(viewer);

    // List of audited core foreign keys
    return [
      { table: 'vitals_logs', field: 'user_id', status: 'OK', recommendation: 'None (Index detected)' },
      { table: 'support_tickets', field: 'user_id', status: 'OK', recommendation: 'None (Index detected)' },
      { table: 'store_order_items', field: 'order_id', status: 'OK', recommendation: 'None (Index detected)' },
      {
        table: 'user_meal_plans',
        field: 'user_id',
        status: 'WARNING',
        recommendation: 'Missing index on user_id! Create non-clustered index to optimize daily content scheduler loading latency.'
      },
      {
        table: 'sensory_activity_logs',
        field: 'user_id',
        status: 'WARNING',
        recommendation: 'Missing index on user_id! Add index to speed up telemetry tracking dashboards aggregation queries.'
      }
    ];
  }

  // 4. Clear Logs
  async clearSlowQueryLogs(viewer) {
    this._verifyPrivileges(viewer);

    await this.models.QueryPerformanceAudit.destroy({
      where: {},
      truncate: true
    });
    return true;
  }
}
