import { v4 as uuidv4 } from 'uuid';

export class DatabaseTuningService {
  constructor(models) {
    this.models = models;
  }

  _verifyPrivileges(viewer) {
    if (viewer?.role?.roleType !== 'ADMIN' && viewer?.role?.roleType !== 'STAFF') {
      throw new Error('Unauthorized access');
    }
  }

  // 1. Get Database replication & connection pool status
  async getDatabaseClusterStatus(viewer) {
    this._verifyPrivileges(viewer);

    // Fetch replica entries
    const replicas = await this.models.ReplicationStatus.findAll({
      order: [['timestamp', 'DESC']],
      limit: 10
    });

    // Simulated cluster state if empty
    const lagMs = replicas.length > 0 ? replicas[0].lagMs : 14;
    const primaryNodeHealthy = replicas.length > 0 ? replicas[0].isHealthy : true;

    // Simulated connection pool parameters
    const maxPoolSizeSetting = await this.models.SystemSetting.findOne({ where: { key: 'db_max_connections' } });
    const idleTimeoutSetting = await this.models.SystemSetting.findOne({ where: { key: 'db_idle_timeout' } });

    const maxPoolSize = maxPoolSizeSetting ? parseInt(maxPoolSizeSetting.value) : 20;
    const idleTimeoutMs = idleTimeoutSetting ? parseInt(idleTimeoutSetting.value) : 10000;

    return {
      primaryNodeHealthy,
      replicaLagMs: lagMs,
      activeConnections: 6,
      maxPoolSize,
      idleConnections: 14
    };
  }

  // 2. Adjust Pool Sizes
  async updateConnectionPoolConfig(viewer, maxConnections, idleTimeoutMs) {
    this._verifyPrivileges(viewer);

    // Upsert key values in SystemSetting
    await this.models.SystemSetting.upsert({
      id: uuidv4(),
      key: 'db_max_connections',
      value: String(maxConnections),
      description: 'Maximum database connections pool size'
    });

    await this.models.SystemSetting.upsert({
      id: uuidv4(),
      key: 'db_idle_timeout',
      value: String(idleTimeoutMs),
      description: 'Idle connections database timeout in milliseconds'
    });

    return true;
  }

  // 3. Trigger manual failover simulation
  async triggerFailoverSimulation(viewer) {
    this._verifyPrivileges(viewer);

    // Write a healthy primary state and a lagging replica log entry
    await this.models.ReplicationStatus.create({
      id: uuidv4(),
      nodeName: 'replica-node-east-01',
      role: 'replica',
      lagMs: 0, // Reset lag on failover target node promotion
      isHealthy: true,
      timestamp: new Date()
    });

    return true;
  }
}
