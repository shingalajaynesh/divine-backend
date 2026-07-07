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

  async assignTask(userId, dayNumber, title, description) {
    const parsedDay = z.number().int().min(1).max(280).parse(dayNumber);
    const titleClean = z.string().min(1).parse(title);
    const descClean = z.string().optional().parse(description);

    return this.sequelize.transaction(async (transaction) => {
      let log = await this.models.PartnerActivityLog.findOne({
        where: { userId, dayNumber: parsedDay },
        transaction,
        lock: transaction.LOCK.UPDATE
      });

      if (log) {
        await log.update({
          assignedTaskTitle: titleClean,
          assignedTaskDesc: descClean || null
        }, { transaction });
      } else {
        log = await this.models.PartnerActivityLog.create({
          userId,
          dayNumber: parsedDay,
          assignedTaskTitle: titleClean,
          assignedTaskDesc: descClean || null,
          partnerAcknowledged: false
        }, { transaction });
      }

      return log;
    });
  }

  async submitResponse(userId, dayNumber, response, familyNotes) {
    const parsedDay = z.number().int().min(1).max(280).parse(dayNumber);
    const responseClean = z.string().min(1).parse(response);
    const notesClean = z.string().optional().parse(familyNotes);

    return this.sequelize.transaction(async (transaction) => {
      let log = await this.models.PartnerActivityLog.findOne({
        where: { userId, dayNumber: parsedDay },
        transaction,
        lock: transaction.LOCK.UPDATE
      });

      if (log) {
        await log.update({
          partnerResponse: responseClean,
          familyNotes: notesClean || null,
          partnerAcknowledged: true,
          completedAt: new Date()
        }, { transaction });
      } else {
        log = await this.models.PartnerActivityLog.create({
          userId,
          dayNumber: parsedDay,
          partnerResponse: responseClean,
          familyNotes: notesClean || null,
          partnerAcknowledged: true,
          completedAt: new Date()
        }, { transaction });
      }

      return log;
    });
  }

  async getPartnerStreak(userId) {
    const logs = await this.models.PartnerActivityLog.findAll({
      where: { userId, partnerAcknowledged: true },
      order: [['completedAt', 'ASC']]
    });

    if (logs.length === 0) {
      return { currentStreak: 0, longestStreak: 0, lastCompletedDate: null };
    }

    let currentStreak = 0;
    let longestStreak = 0;
    let lastDate = null;

    const uniqueDates = Array.from(new Set(logs.map(l => l.completedAt ? l.completedAt.toISOString().split('T')[0] : null).filter(Boolean))).sort();

    for (let i = 0; i < uniqueDates.length; i++) {
      const currentDate = new Date(uniqueDates[i]);
      if (i === 0) {
        currentStreak = 1;
      } else {
        const prevDate = new Date(uniqueDates[i - 1]);
        const diffTime = Math.abs(currentDate - prevDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
          currentStreak += 1;
        } else {
          currentStreak = 1;
        }
      }
      longestStreak = Math.max(longestStreak, currentStreak);
      lastDate = uniqueDates[i];
    }

    return {
      currentStreak,
      longestStreak,
      lastCompletedDate: lastDate
    };
  }
}
