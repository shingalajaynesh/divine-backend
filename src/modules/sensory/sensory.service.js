import { z } from 'zod';

export class SensoryService {
  constructor(models, sequelize) {
    this.models = models;
    this.sequelize = sequelize;
  }

  async getSensoryActivity(dayNumber, language = 'en') {
    const parsedDay = z.number().int().min(1).max(280).parse(dayNumber);
    const activity = await this.models.SensoryActivity.findOne({
      where: { dayNumber: parsedDay }
    });

    if (!activity) {
      return null;
    }

    const isHi = language === 'hi';
    return {
      id: activity.id,
      dayNumber: activity.dayNumber,
      senseType: activity.senseType,
      title: isHi ? activity.titleHi : activity.titleEn,
      description: isHi ? activity.descriptionHi : activity.descriptionEn,
      guidance: isHi ? activity.guidanceHi : activity.guidanceEn,
      mediaLinks: activity.mediaLinks
    };
  }

  async getMySensoryActivityLog(userId, dayNumber) {
    const parsedDay = z.number().int().min(1).max(280).parse(dayNumber);
    return this.models.SensoryActivityLog.findOne({
      where: { userId, dayNumber: parsedDay }
    });
  }

  async toggleSensoryActivity(userId, dayNumber, userPregnancyDay) {
    const parsedDay = z.number().int().min(1).max(280).parse(dayNumber);
    
    // Future validation
    if (parsedDay > userPregnancyDay) {
      throw new Error(`Cannot complete sensory activities for future days. Current day is ${userPregnancyDay}.`);
    }

    const activity = await this.models.SensoryActivity.findOne({
      where: { dayNumber: parsedDay }
    });

    if (!activity) {
      throw new Error(`No sensory activity details available for Day ${parsedDay}.`);
    }

    return this.sequelize.transaction(async (transaction) => {
      let log = await this.models.SensoryActivityLog.findOne({
        where: { userId, dayNumber: parsedDay },
        transaction,
        lock: transaction.LOCK.UPDATE
      });

      if (log) {
        log.completed = !log.completed;
        log.completedAt = log.completed ? new Date() : null;
        await log.save({ transaction });
      } else {
        log = await this.models.SensoryActivityLog.create({
          userId,
          sensoryActivityId: activity.id,
          dayNumber: parsedDay,
          completed: true,
          completedAt: new Date()
        }, { transaction });
      }

      return log;
    });
  }
}
