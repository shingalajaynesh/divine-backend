export class CrmService {
  constructor(models, sequelize) {
    this.models = models;
    this.sequelize = sequelize;
  }

  // 1. CRM Directory
  async getUsersList() {
    return this.models.User.findAll({
      attributes: ['id', 'displayName', 'email', 'phone', 'pregnancyStartDate', 'pregnancyDay'],
      include: [
        { model: this.models.Role, as: 'role' },
        { 
          model: this.models.UserSubscription, 
          as: 'subscriptions',
          limit: 1,
          order: [['createdAt', 'DESC']],
          include: [{ model: this.models.SubscriptionPlan, as: 'plan' }]
        }
      ],
      order: [['displayName', 'ASC']]
    });
  }

  // 2. Add CRM Note
  async addCrmNote(userId, authorId, note) {
    if (!note || note.trim() === '') {
      throw new Error('CRM note text cannot be empty');
    }
    return this.models.CrmNote.create({
      userId,
      authorId,
      note
    });
  }

  // 3. Get User CRM Notes
  async getCrmNotes(userId) {
    return this.models.CrmNote.findAll({
      where: { userId },
      include: [{ model: this.models.User, as: 'author', attributes: ['displayName'] }],
      order: [['createdAt', 'DESC']]
    });
  }

  // 4. Log Administrative Audit Action
  async logAdminAction(userId, action, targetType, targetId, payload) {
    return this.models.AdminAuditLog.create({
      userId,
      action,
      targetType,
      targetId,
      payload
    });
  }

  // 5. Read Audit Logs
  async getAuditLogs() {
    return this.models.AdminAuditLog.findAll({
      include: [{ model: this.models.User, as: 'user', attributes: ['displayName', 'email'] }],
      order: [['createdAt', 'DESC']],
      limit: 100
    });
  }
}
