export class StreakService {
  constructor(models, sequelize) {
    this.models = models;
    this.sequelize = sequelize;
  }

  async getStreak(userId) {
    let streak = await this.models.UserStreak.findOne({
      where: { userId }
    });

    if (!streak) {
      streak = await this.models.UserStreak.create({
        userId,
        currentStreak: 0,
        longestStreak: 0,
        lastCompletedDate: null
      });
    }

    return streak;
  }

  async getAchievements(userId) {
    return this.models.UserAchievement.findAll({
      where: { userId },
      order: [['unlockedAt', 'DESC']]
    });
  }

  // Calculate and update streaks & check for new achievements
  async updateStreakOnCompletion(userId, transaction) {
    // 1. Get streak record
    let streak = await this.models.UserStreak.findOne({
      where: { userId },
      transaction,
      lock: transaction.LOCK.UPDATE
    });

    if (!streak) {
      streak = await this.models.UserStreak.create({
        userId,
        currentStreak: 0,
        longestStreak: 0,
        lastCompletedDate: null
      }, { transaction });
    }

    // Get today's local date
    const todayStr = new Date().toISOString().split('T')[0];

    // If last completed date is already today, do nothing (they completed another day, or re-completed the same day)
    if (streak.lastCompletedDate === todayStr) {
      return streak;
    }

    // Check if they completed yesterday to increment the streak
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    let newCurrent = 1;
    if (streak.lastCompletedDate === yesterdayStr) {
      newCurrent = streak.currentStreak + 1;
    }

    const newLongest = Math.max(streak.longestStreak, newCurrent);

    await streak.update({
      currentStreak: newCurrent,
      longestStreak: newLongest,
      lastCompletedDate: todayStr
    }, { transaction });

    // 2. Evaluate Achievements
    await this.evaluateAchievements(userId, newCurrent, transaction);

    return streak;
  }

  async evaluateAchievements(userId, currentStreak, transaction) {
    // Define achievement triggers:
    // - FIRST_STEPS: Completed first day (currentStreak >= 1)
    // - THREE_DAY_STREAK: 3 days in a row
    // - PERFECT_WEEK: 7 days in a row
    const badgeTriggers = [];
    if (currentStreak >= 1) badgeTriggers.push({ key: 'FIRST_STEPS' });
    if (currentStreak >= 3) badgeTriggers.push({ key: 'THREE_DAY_STREAK' });
    if (currentStreak >= 7) badgeTriggers.push({ key: 'PERFECT_WEEK' });

    for (const badge of badgeTriggers) {
      const exists = await this.models.UserAchievement.findOne({
        where: { userId, badgeKey: badge.key },
        transaction
      });

      if (!exists) {
        await this.models.UserAchievement.create({
          userId,
          badgeKey: badge.key,
          unlockedAt: new Date()
        }, { transaction });
      }
    }
  }

  async getWeeklyReport(userId, weekNumber) {
    const startDay = (weekNumber - 1) * 7 + 1;
    const endDay = weekNumber * 7;

    const progressEntries = await this.models.DailyProgress.findAll({
      where: {
        userId,
        dayNumber: {
          [this.models.Sequelize.Op.between]: [startDay, endDay]
        }
      },
      order: [['dayNumber', 'ASC']]
    });

    const days = Array.from({ length: 7 }, (_, index) => {
      const dayNum = startDay + index;
      const progress = progressEntries.find(p => p.dayNumber === dayNum);
      const totalDuration = (progress?.pqDurationMins || 0) +
                            (progress?.iqDurationMins || 0) +
                            (progress?.eqDurationMins || 0) +
                            (progress?.sqDurationMins || 0);

      const notes = [
        progress?.pqNotes,
        progress?.iqNotes,
        progress?.eqNotes,
        progress?.sqNotes
      ].filter(Boolean);

      return {
        dayNumber: dayNum,
        completed: !!(progress?.pqCompleted && progress?.iqCompleted && progress?.eqCompleted && progress?.sqCompleted),
        pqCompleted: !!progress?.pqCompleted,
        iqCompleted: !!progress?.iqCompleted,
        eqCompleted: !!progress?.eqCompleted,
        sqCompleted: !!progress?.sqCompleted,
        totalDurationMins: totalDuration,
        reflections: notes
      };
    });

    const completedDaysCount = days.filter(d => d.completed).length;
    const totalWeekDuration = days.reduce((sum, d) => sum + d.totalDurationMins, 0);

    return {
      weekNumber,
      completedDaysCount,
      totalWeekDurationMins: totalWeekDuration,
      days
    };
  }

  async getMonthlyReport(userId, monthNumber) {
    const startWeek = (monthNumber - 1) * 4 + 1;
    const endWeek = monthNumber * 4;

    const weeks = [];
    for (let w = startWeek; w <= endWeek; w++) {
      const wReport = await this.getWeeklyReport(userId, w);
      weeks.push(wReport);
    }

    const completedDaysCount = weeks.reduce((sum, w) => sum + w.completedDaysCount, 0);
    const totalMonthDurationMins = weeks.reduce((sum, w) => sum + w.totalWeekDurationMins, 0);

    return {
      monthNumber,
      completedDaysCount,
      totalMonthDurationMins,
      weeks
    };
  }
}
