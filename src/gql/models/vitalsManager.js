import { BaseManager } from './baseManager.js';

export class VitalsManager extends BaseManager {
  /**
   * Log a new vitals entry for the user.
   */
  async logVitals(userId, input) {
    try {
      const VitalsLog = this.models.VitalsLog;
      
      const newLog = await VitalsLog.create({
        userId,
        weight: input.weight,
        systolicBp: input.systolicBp,
        diastolicBp: input.diastolicBp,
        kickCount: input.kickCount,
        bloodSugar: input.bloodSugar,
        loggedAt: input.loggedAt || new Date()
      });

      this.log.info(`Vitals logged successfully for user ${userId}: (weight: ${input.weight}, BP: ${input.systolicBp}/${input.diastolicBp})`);
      return newLog;
    } catch (error) {
      this.log.error(`Failed to log vitals for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get user's vitals logging history.
   */
  async getVitalsHistory(userId) {
    try {
      const VitalsLog = this.models.VitalsLog;
      return await VitalsLog.findAll({
        where: { userId },
        order: [['loggedAt', 'DESC']]
      });
    } catch (error) {
      this.log.error(`Failed to get vitals history for user ${userId}:`, error);
      return [];
    }
  }
}
