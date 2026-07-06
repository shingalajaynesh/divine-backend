import { authenticate } from '../permissions/index.js';
import { DailyProgressService } from '../../../modules/timeline/dailyProgress.service.js';
import { StreakService } from '../../../modules/timeline/streak.service.js';
import { QuizService } from '../../../modules/quiz/quiz.service.js';
import { PartnerService } from '../../../modules/partner/partner.service.js';
import { SensoryService } from '../../../modules/sensory/sensory.service.js';
import { GraphQLError } from 'graphql';
import { ZodError } from 'zod';
import { calculatePregnancyStats } from '../../../util/pregnancy.js';

const getService = (context) => new DailyProgressService(context.models, context.sequelize);

const runValidated = async (operation) => {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof ZodError) {
      throw new GraphQLError('Please check the submitted information.', {
        extensions: {
          code: 'BAD_USER_INPUT',
          fields: error.issues.map((issue) => issue.path.join('.')),
        },
      });
    }
    throw new GraphQLError(error.message, {
      extensions: { code: 'BAD_USER_INPUT' }
    });
  }
};

export const timelineResolvers = {
  DailyProgress: {
    completedAt: (parent) => parent.completedAt ? parent.completedAt.toISOString() : null,
    createdAt: (parent) => parent.createdAt.toISOString(),
    updatedAt: (parent) => parent.updatedAt.toISOString(),
  },
  TimelineOverview: {
    unlockDate: (parent) => parent.unlockDate ? parent.unlockDate.toISOString() : null,
    selectedProgress: (parent) => parent.selectedProgress ?? null,
  },
  UserStreak: {
    lastCompletedDate: (parent) => parent.lastCompletedDate || null,
  },
  UserAchievement: {
    unlockedAt: (parent) => parent.unlockedAt.toISOString(),
  },
  Query: {
    myDailyProgress: authenticate(async (parent, { dayNumber }, context) =>
      runValidated(() => getService(context).getProgress(context.viewer.id, dayNumber))
    ),
    myDailyProgressRange: authenticate(async (parent, { startDay, endDay }, context) =>
      runValidated(() => getService(context).getProgressRange(context.viewer.id, startDay, endDay))
    ),
    myTimelineOverview: authenticate(async (parent, { dayNumber }, context) => {
      const stats = calculatePregnancyStats(context.viewer.lmpDate, context.viewer.dueDate);

      return runValidated(() => getService(context).getTimelineOverview(
        context.viewer.id,
        stats,
        dayNumber
      ));
    }),
    myStreak: authenticate(async (parent, args, context) =>
      new StreakService(context.models, context.sequelize).getStreak(context.viewer.id)
    ),
    myAchievements: authenticate(async (parent, args, context) =>
      new StreakService(context.models, context.sequelize).getAchievements(context.viewer.id)
    ),
    myWeeklyReport: authenticate(async (parent, { weekNumber }, context) =>
      new StreakService(context.models, context.sequelize).getWeeklyReport(context.viewer.id, weekNumber)
    ),
    getDailyQuiz: authenticate(async (parent, { dayNumber }, context) =>
      new QuizService(context.models, context.sequelize).getDailyQuiz(dayNumber, context.viewer.language || 'en')
    ),
    getMyQuizAttempt: authenticate(async (parent, { dayNumber }, context) =>
      new QuizService(context.models, context.sequelize).getMyQuizAttempt(context.viewer.id, dayNumber)
    ),
    getPartnerActivity: authenticate(async (parent, { dayNumber }, context) =>
      new PartnerService(context.models, context.sequelize).getPartnerActivity(dayNumber, context.viewer.language || 'en')
    ),
    getMyPartnerActivityLog: authenticate(async (parent, { dayNumber }, context) =>
      new PartnerService(context.models, context.sequelize).getMyPartnerActivityLog(context.viewer.id, dayNumber)
    ),
    getSensoryActivity: authenticate(async (parent, { dayNumber }, context) =>
      new SensoryService(context.models, context.sequelize).getSensoryActivity(dayNumber, context.viewer.language || 'en')
    ),
    getMySensoryActivityLog: authenticate(async (parent, { dayNumber }, context) =>
      new SensoryService(context.models, context.sequelize).getMySensoryActivityLog(context.viewer.id, dayNumber)
    ),
  },
  Mutation: {
    toggleDailyActivity: authenticate(async (parent, { dayNumber, quotient }, context) => {
      const stats = calculatePregnancyStats(context.viewer.lmpDate, context.viewer.dueDate);
      const userPregnancyDay = stats.pregnancyDay || 1;
      
      return runValidated(() => getService(context).toggleActivity(
        context.viewer.id,
        dayNumber,
        quotient,
        userPregnancyDay
      ));
    }),
    saveDailyActivityDetails: authenticate(async (parent, { input }, context) => {
      const stats = calculatePregnancyStats(context.viewer.lmpDate, context.viewer.dueDate);
      const userPregnancyDay = stats.pregnancyDay || 1;

      return runValidated(() => getService(context).saveActivityDetails(
        context.viewer.id,
        input,
        userPregnancyDay
      ));
    }),
    submitQuizAnswer: authenticate(async (parent, { dayNumber, selectedOptionIndex }, context) => {
      const stats = calculatePregnancyStats(context.viewer.lmpDate, context.viewer.dueDate);
      const userPregnancyDay = stats.pregnancyDay || 1;

      return runValidated(() => new QuizService(context.models, context.sequelize).submitQuizAnswer(
        context.viewer.id,
        dayNumber,
        selectedOptionIndex,
        userPregnancyDay
      ));
    }),
    acknowledgePartnerActivity: authenticate(async (parent, { dayNumber }, context) => {
      const stats = calculatePregnancyStats(context.viewer.lmpDate, context.viewer.dueDate);
      const userPregnancyDay = stats.pregnancyDay || 1;

      return runValidated(() => new PartnerService(context.models, context.sequelize).acknowledgePartnerActivity(
        context.viewer.id,
        dayNumber,
        userPregnancyDay
      ));
    }),
    toggleSensoryActivity: authenticate(async (parent, { dayNumber }, context) => {
      const stats = calculatePregnancyStats(context.viewer.lmpDate, context.viewer.dueDate);
      const userPregnancyDay = stats.pregnancyDay || 1;

      return runValidated(() => new SensoryService(context.models, context.sequelize).toggleSensoryActivity(
        context.viewer.id,
        dayNumber,
        userPregnancyDay
      ));
    }),
  },
};
