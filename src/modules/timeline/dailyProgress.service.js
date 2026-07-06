import { dayNumberSchema, quotientSchema, saveDailyActivityDetailsSchema } from './dailyProgress.validation.js';
import { StreakService } from './streak.service.js';

export class DailyProgressService {
  constructor(models, sequelize) {
    this.models = models;
    this.sequelize = sequelize;
    this.streakService = new StreakService(models, sequelize);
  }

  buildTimelineOverview(userId, stats, selectedDayInput) {
    const selectedDay = dayNumberSchema.parse(selectedDayInput ?? stats.pregnancyDay ?? 1);
    const selectedWeek = Math.max(1, Math.min(40, Math.floor((selectedDay - 1) / 7) + 1));
    const selectedMonth = Math.max(1, Math.min(10, Math.floor((selectedDay - 1) / 28) + 1));
    const selectedTrimester = Math.max(1, Math.min(3, Math.floor((selectedDay - 1) / 84) + 1));
    const weekStartDay = (selectedWeek - 1) * 7 + 1;
    const weekEndDay = Math.min(280, weekStartDay + 6);

    return {
      userId,
      selectedDay,
      selectedWeek,
      selectedMonth,
      selectedTrimester,
      weekStartDay,
      weekEndDay,
      currentDay: stats.pregnancyDay ?? 1,
      currentWeek: stats.currentWeek ?? 1,
      currentTrimester: stats.currentTrimester ?? 1,
      lmpDate: stats.lmpDate,
      dueDate: stats.dueDate,
    };
  }

  async getProgress(userId, dayNumber) {
    const validatedDay = dayNumberSchema.parse(dayNumber);
    return this.models.DailyProgress.findOne({
      where: { userId, dayNumber: validatedDay }
    });
  }

  async getProgressRange(userId, startDay, endDay) {
    const validatedStart = dayNumberSchema.parse(startDay);
    const validatedEnd = dayNumberSchema.parse(endDay);
    
    return this.models.DailyProgress.findAll({
      where: {
        userId,
        dayNumber: {
          [this.models.Sequelize.Op.between]: [validatedStart, validatedEnd]
        }
      },
      order: [['dayNumber', 'ASC']]
    });
  }

  async toggleActivity(userId, dayNumber, quotient, userPregnancyDay) {
    const validatedDay = dayNumberSchema.parse(dayNumber);
    const validatedQuotient = quotientSchema.parse(quotient);

    // Catch-up validation: cannot complete future days
    if (validatedDay > userPregnancyDay) {
      throw new Error(`Cannot complete activities for future days. Current day is ${userPregnancyDay}.`);
    }

    const field = `${validatedQuotient.toLowerCase()}Completed`;

    return this.sequelize.transaction(async (transaction) => {
      let progress = await this.models.DailyProgress.findOne({
        where: { userId, dayNumber: validatedDay },
        transaction,
        lock: transaction.LOCK.UPDATE
      });

      if (!progress) {
        progress = await this.models.DailyProgress.create({
          userId,
          dayNumber: validatedDay,
          [field]: true
        }, { transaction });
      } else {
        const currentVal = progress[field];
        await progress.update({
          [field]: !currentVal
        }, { transaction });
      }

      // If all quotients are completed, set completedAt, else null
      const allCompleted = progress.pqCompleted && progress.iqCompleted && progress.eqCompleted && progress.sqCompleted;
      await progress.update({
        completedAt: allCompleted ? new Date() : null
      }, { transaction });

      if (allCompleted) {
        await this.streakService.updateStreakOnCompletion(userId, transaction);
      }

      return progress;
    });
  }

  async saveActivityDetails(userId, input, userPregnancyDay) {
    const validatedInput = saveDailyActivityDetailsSchema.parse(input);
    const { dayNumber, quotient, durationMins, evidence, notes } = validatedInput;

    // Catch-up validation
    if (dayNumber > userPregnancyDay) {
      throw new Error(`Cannot save details for future days. Current day is ${userPregnancyDay}.`);
    }

    const qLower = quotient.toLowerCase();
    const durationField = `${qLower}DurationMins`;
    const evidenceField = `${qLower}Evidence`;
    const notesField = `${qLower}Notes`;
    const completedField = `${qLower}Completed`;

    return this.sequelize.transaction(async (transaction) => {
      let progress = await this.models.DailyProgress.findOne({
        where: { userId, dayNumber },
        transaction,
        lock: transaction.LOCK.UPDATE
      });

      if (!progress) {
        progress = await this.models.DailyProgress.create({
          userId,
          dayNumber,
          [completedField]: true,
          [durationField]: durationMins ?? 0,
          [evidenceField]: evidence ?? null,
          [notesField]: notes ?? null
        }, { transaction });
      } else {
        await progress.update({
          [completedField]: true,
          [durationField]: durationMins ?? 0,
          [evidenceField]: evidence ?? null,
          [notesField]: notes ?? null
        }, { transaction });
      }

      // Re-evaluate if day is fully completed
      const allCompleted = progress.pqCompleted && progress.iqCompleted && progress.eqCompleted && progress.sqCompleted;
      await progress.update({
        completedAt: allCompleted ? new Date() : null
      }, { transaction });

      if (allCompleted) {
        await this.streakService.updateStreakOnCompletion(userId, transaction);
      }

      return progress;
    });
  }

  async getTimelineOverview(userId, stats, selectedDayInput) {
    const overview = this.buildTimelineOverview(userId, stats, selectedDayInput);
    const range = await this.getProgressRange(userId, overview.weekStartDay, overview.weekEndDay);
    const selectedProgress = range.find((entry) => entry.dayNumber === overview.selectedDay)
      ?? await this.getProgress(userId, overview.selectedDay);

    const completedCount = ['pqCompleted', 'iqCompleted', 'eqCompleted', 'sqCompleted']
      .filter((field) => Boolean(selectedProgress?.[field]))
      .length;
    const progressPercent = Math.round((completedCount / 4) * 100);
    const unlockDate = overview.selectedDay > overview.currentDay && overview.lmpDate
      ? new Date(new Date(overview.lmpDate).getTime() + ((overview.selectedDay - 1) * 24 * 60 * 60 * 1000))
      : null;

    return {
      ...overview,
      isLocked: overview.selectedDay > overview.currentDay,
      unlockDate,
      completedCount,
      progressPercent,
      selectedProgress,
      days: Array.from({ length: overview.weekEndDay - overview.weekStartDay + 1 }, (_, index) => {
        const dayNumber = overview.weekStartDay + index;
        const progress = range.find((entry) => entry.dayNumber === dayNumber);
        const completed = Boolean(
          progress?.pqCompleted &&
          progress?.iqCompleted &&
          progress?.eqCompleted &&
          progress?.sqCompleted
        );

        return {
          dayNumber,
          locked: dayNumber > overview.currentDay,
          completed,
          pqCompleted: Boolean(progress?.pqCompleted),
          iqCompleted: Boolean(progress?.iqCompleted),
          eqCompleted: Boolean(progress?.eqCompleted),
          sqCompleted: Boolean(progress?.sqCompleted),
        };
      }),
    };
  }
}
