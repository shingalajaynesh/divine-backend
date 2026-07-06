import { z } from 'zod';

export class PartnerService {
  constructor(models, sequelize) {
    this.models = models;
    this.sequelize = sequelize;
  }

  async getPartnerActivity(dayNumber, language = 'en') {
    const parsedDay = z.number().int().min(1).max(280).parse(dayNumber);
    const activity = await this.models.PartnerActivity.findOne({
      where: { dayNumber: parsedDay }
    });

    if (!activity) {
      return null;
    }

    const isHi = language === 'hi';
    return {
      id: activity.id,
      dayNumber: activity.dayNumber,
      title: isHi ? activity.titleHi : activity.titleEn,
      description: isHi ? activity.descriptionHi : activity.descriptionEn
    };
  }

  async getMyPartnerActivityLog(userId, dayNumber) {
    const parsedDay = z.number().int().min(1).max(280).parse(dayNumber);
    return this.models.PartnerActivityLog.findOne({
      where: { userId, dayNumber: parsedDay }
    });
  }

  async acknowledgePartnerActivity(userId, dayNumber, userPregnancyDay) {
    const parsedDay = z.number().int().min(1).max(280).parse(dayNumber);
    
    // Future validation
    if (parsedDay > userPregnancyDay) {
      throw new Error(`Cannot complete partner activities for future days. Current day is ${userPregnancyDay}.`);
    }

    const activity = await this.models.PartnerActivity.findOne({
      where: { dayNumber: parsedDay }
    });

    if (!activity) {
      throw new Error(`No partner activity details available for Day ${parsedDay}.`);
    }

    return this.sequelize.transaction(async (transaction) => {
      let log = await this.models.PartnerActivityLog.findOne({
        where: { userId, dayNumber: parsedDay },
        transaction,
        lock: transaction.LOCK.UPDATE
      });

      if (log) {
        log.partnerAcknowledged = !log.partnerAcknowledged;
        log.completedAt = log.partnerAcknowledged ? new Date() : null;
        await log.save({ transaction });
      } else {
        log = await this.models.PartnerActivityLog.create({
          userId,
          dayNumber: parsedDay,
          partnerAcknowledged: true,
          completedAt: new Date()
        }, { transaction });
      }

      return log;
    });
  }
}
