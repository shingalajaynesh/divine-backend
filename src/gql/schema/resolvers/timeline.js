import { v4 as uuidv4 } from 'uuid';
import { authenticate } from '../permissions/index.js';
import { DailyProgressService } from '../../../modules/timeline/dailyProgress.service.js';
import { StreakService } from '../../../modules/timeline/streak.service.js';
import { QuizService } from '../../../modules/quiz/quiz.service.js';
import { PartnerService } from '../../../modules/partner/partner.service.js';
import { SensoryService } from '../../../modules/sensory/sensory.service.js';
import { GraphQLError } from 'graphql';
import { ZodError } from 'zod';
import { calculatePregnancyStats } from '../../../util/pregnancy.js';

let mockWorksheetSubmissions = [
  {
    id: 'work-1',
    userId: 'user-mother-1',
    userDisplayName: 'Ananya Sharma',
    title: 'Trimester 1 Emotional Reflection Worksheet',
    submittedAt: '2026-07-06T14:30:00Z',
    fileUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    score: null,
    feedback: null,
    status: 'pending'
  },
  {
    id: 'work-2',
    userId: 'user-mother-2',
    userDisplayName: 'Jayne Patel',
    title: 'Garbh Sanskar Diet and Nutrition Log Sheet',
    submittedAt: '2026-07-05T09:15:00Z',
    fileUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    score: 85,
    feedback: 'Excellent nutritional balance. Maintain hydration levels as suggested!',
    status: 'reviewed'
  }
];

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
  QuizAttempt: {
    question: async (parent, args, context) => {
      if (parent.question) return parent.question;
      if (parent.quizQuestionId) return context.models.QuizQuestion.findByPk(parent.quizQuestionId);
      if (parent.dayNumber) return context.models.QuizQuestion.findOne({ where: { dayNumber: parent.dayNumber } });
      return null;
    },
  },
  PartnerActivityLog: {
    activity: async (parent, args, context) => {
      if (parent.activity) return parent.activity;
      if (parent.partnerActivityId) return context.models.PartnerActivity.findByPk(parent.partnerActivityId);
      if (parent.dayNumber) return context.models.PartnerActivity.findOne({ where: { dayNumber: parent.dayNumber } });
      return null;
    },
  },
  SensoryActivityLog: {
    activity: async (parent, args, context) => {
      if (parent.activity) return parent.activity;
      if (parent.sensoryActivityId) return context.models.SensoryActivity.findByPk(parent.sensoryActivityId);
      if (parent.dayNumber) return context.models.SensoryActivity.findOne({ where: { dayNumber: parent.dayNumber } });
      return null;
    },
  },
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
    myDailyProgress: authenticate(async (parent, { dayNumber, userId }, context) => {
      const targetUserId = (userId && ['STAFF', 'GUIDE', 'ADMIN'].includes(context.viewer.role?.roleType))
        ? userId
        : context.viewer.id;
      return runValidated(() => getService(context).getProgress(targetUserId, dayNumber));
    }),
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
    myJourneyArchive: authenticate(async (parent, args, context) => {
      const userId = context.viewer.id;
      const stats = calculatePregnancyStats(context.viewer.lmpDate, context.viewer.dueDate);
      
      const progressLogs = await context.models.DailyProgress.findAll({
        where: { userId }
      });
      
      const vitalsLogs = await context.models.VitalsLog.findAll({
        where: { userId }
      });

      const getTrimester = (dayNumber) => {
        if (dayNumber <= 84) return 1;
        if (dayNumber <= 168) return 2;
        return 3;
      };

      const summaries = [1, 2, 3].map(tNum => {
        const tProgress = progressLogs.filter(p => getTrimester(p.dayNumber) === tNum);
        let completedActivities = 0;
        for (const p of tProgress) {
          if (p.pqCompleted) completedActivities++;
          if (p.iqCompleted) completedActivities++;
          if (p.eqCompleted) completedActivities++;
          if (p.sqCompleted) completedActivities++;
        }

        const tVitals = vitalsLogs.filter(v => {
          if (!v.loggedAt || !context.viewer.lmpDate) return false;
          const diffMs = new Date(v.loggedAt).getTime() - new Date(context.viewer.lmpDate).getTime();
          const day = Math.floor(diffMs / (24 * 60 * 60 * 1000)) + 1;
          return getTrimester(day) === tNum;
        });

        const loggedVitalsCount = tVitals.length;
        
        const sleepVals = tVitals.filter(v => v.sleepHours != null).map(v => v.sleepHours);
        const hydrationVals = tVitals.filter(v => v.hydrationWater != null).map(v => v.hydrationWater);

        const averageSleepHours = sleepVals.length > 0 
          ? Number((sleepVals.reduce((a, b) => a + b, 0) / sleepVals.length).toFixed(1)) 
          : null;
        const averageHydrationWater = hydrationVals.length > 0 
          ? Number((hydrationVals.reduce((a, b) => a + b, 0) / hydrationVals.length).toFixed(0)) 
          : null;

        const moodCounts = {};
        for (const v of tVitals) {
          if (v.mood) {
            moodCounts[v.mood] = (moodCounts[v.mood] || 0) + 1;
          }
        }
        const moodFrequencyDistribution = Object.entries(moodCounts).map(([mood, count]) => ({
          mood,
          count
        }));

        return {
          trimesterNumber: tNum,
          totalActivitiesCompleted: completedActivities,
          vitalsLoggedCount: loggedVitalsCount,
          averageSleepHours,
          averageHydrationWater,
          moodFrequencyDistribution
        };
      });

      return {
        pregnancyDay: stats.pregnancyDay || 1,
        weekNumber: stats.currentWeek || 1,
        trimesterSummary: summaries
      };
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
    myMonthlyReport: authenticate(async (parent, { monthNumber }, context) =>
      new StreakService(context.models, context.sequelize).getMonthlyReport(context.viewer.id, monthNumber)
    ),
    getDailyQuiz: authenticate(async (parent, { dayNumber }, context) =>
      new QuizService(context.models, context.sequelize).getDailyQuiz(dayNumber, context.viewer.language || 'en')
    ),
    getMyQuizAttempt: authenticate(async (parent, { dayNumber }, context) =>
      new QuizService(context.models, context.sequelize).getMyQuizAttempt(context.viewer.id, dayNumber)
    ),
    getWorksheetSubmissions: authenticate((parent, args, context) => {
      if (context.viewer.role?.roleType !== 'STAFF' && context.viewer.role?.roleType !== 'ADMIN') {
        throw new Error('Unauthorized access');
      }
      return mockWorksheetSubmissions;
    }),
    getPartnerActivity: authenticate(async (parent, { dayNumber }, context) =>
      new PartnerService(context.models, context.sequelize).getPartnerActivity(dayNumber, context.viewer.language || 'en')
    ),
    getMyPartnerActivityLog: authenticate(async (parent, { dayNumber }, context) => {
      const targetUserId = context.viewer.role?.roleType === 'PARTNER' ? context.viewer.partnerId : context.viewer.id;
      if (!targetUserId) return null;
      return new PartnerService(context.models, context.sequelize).getMyPartnerActivityLog(targetUserId, dayNumber);
    }),
    myPartnerStreak: authenticate(async (parent, args, context) => {
      const targetUserId = context.viewer.role?.roleType === 'PARTNER' ? context.viewer.id : context.viewer.partnerId;
      if (!targetUserId) return { currentStreak: 0, longestStreak: 0, lastCompletedDate: null };
      return new PartnerService(context.models, context.sequelize).getPartnerStreak(targetUserId);
    }),
    getPartnerDashboard: authenticate(async (parent, args, context) => {
      const viewer = context.viewer;
      if (viewer.role?.roleType !== 'PARTNER') {
        throw new GraphQLError('Only partner users can view the partner dashboard.', {
          extensions: { code: 'FORBIDDEN' }
        });
      }

      if (!viewer.partnerId) {
        throw new GraphQLError('You are not linked to any mother account yet.', {
          extensions: { code: 'BAD_USER_INPUT' }
        });
      }

      // Fetch mother profile
      const mother = await context.models.User.findByPk(viewer.partnerId, {
        include: [
          { model: context.models.Role, as: 'role' },
          { model: context.models.Center, as: 'center' }
        ]
      });

      if (!mother) {
        throw new GraphQLError('Linked mother account not found.', {
          extensions: { code: 'NOT_FOUND' }
        });
      }

      // Mother stats
      const stats = calculatePregnancyStats(mother.lmpDate, mother.dueDate);
      const dayNumber = stats.pregnancyDay || 1;

      // Get baby growth milestone details
      const babyDev = await context.models.BabyDevelopment.findOne({
        where: { weekNumber: stats.currentWeek || 1 }
      });

      // Get daily progress completion percentage
      const dailyProgress = await new DailyProgressService(context.models, context.sequelize).getProgress(mother.id, dayNumber);
      
      // Get quiz attempt status
      const quizAttempt = await new QuizService(context.models, context.sequelize).getMyQuizAttempt(mother.id, dayNumber);

      // Get partner activity and status
      const partnerActService = new PartnerService(context.models, context.sequelize);
      const partnerAct = await partnerActService.getPartnerActivity(dayNumber, viewer.language || 'en');
      const partnerLog = await partnerActService.getMyPartnerActivityLog(mother.id, dayNumber);

      return {
        motherName: mother.displayName || `${mother.firstName || ''} ${mother.lastName || ''}`.trim() || 'Mother',
        pregnancyDay: dayNumber,
        currentWeek: stats.currentWeek,
        currentTrimester: stats.currentTrimester,
        babySize: babyDev ? (viewer.language === 'hi' ? babyDev.sizeHi : babyDev.sizeEn) : null,
        babyMilestone: babyDev ? (viewer.language === 'hi' ? babyDev.milestoneHi : babyDev.milestoneEn) : null,
        progressPercent: dailyProgress?.progressPercent || 0,
        dailyQuizAttempted: !!quizAttempt,
        partnerActivityCompleted: partnerLog ? partnerLog.partnerAcknowledged : false,
        partnerActivityTitle: partnerAct?.title || null,
        partnerActivityDescription: partnerAct?.description || null
      };
    }),
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
    gradeWorksheetSubmission: authenticate((parent, { id, score, feedback }, context) => {
      if (context.viewer.role?.roleType !== 'STAFF' && context.viewer.role?.roleType !== 'ADMIN') {
        throw new Error('Unauthorized access');
      }
      const submission = mockWorksheetSubmissions.find(s => s.id === id);
      if (!submission) throw new Error('Worksheet submission not found');
      submission.score = score;
      submission.feedback = feedback;
      submission.status = 'reviewed';
      return submission;
    }),
    acknowledgePartnerActivity: authenticate(async (parent, { dayNumber }, context) => {
      let targetUserId = context.viewer.id;
      let lmpDate = context.viewer.lmpDate;
      let dueDate = context.viewer.dueDate;

      if (context.viewer.role?.roleType === 'PARTNER') {
        if (!context.viewer.partnerId) {
          throw new GraphQLError('You are not linked to a mother account.', {
            extensions: { code: 'BAD_USER_INPUT' }
          });
        }
        targetUserId = context.viewer.partnerId;
        // Fetch mother user details
        const mother = await context.models.User.findByPk(targetUserId);
        if (!mother) {
          throw new GraphQLError('Linked mother account not found.', {
            extensions: { code: 'NOT_FOUND' }
          });
        }
        lmpDate = mother.lmpDate;
        dueDate = mother.dueDate;
      }

      const stats = calculatePregnancyStats(lmpDate, dueDate);
      const userPregnancyDay = stats.pregnancyDay || 1;

      return runValidated(() => new PartnerService(context.models, context.sequelize).acknowledgePartnerActivity(
        targetUserId,
        dayNumber,
        userPregnancyDay
      ));
    }),
    linkPartner: authenticate(async (parent, { partnerEmail }, context) => {
      const viewer = context.viewer;
      if (viewer.role?.roleType !== 'MOTHER') {
        throw new GraphQLError('Only mother accounts can link partners.', {
          extensions: { code: 'FORBIDDEN' }
        });
      }

      const emailClean = partnerEmail.trim().toLowerCase();
      if (emailClean === viewer.emailAddress.toLowerCase()) {
        throw new GraphQLError('You cannot link yourself as your own partner.', {
          extensions: { code: 'BAD_USER_INPUT' }
        });
      }

      // Find partner user
      let partner = await context.models.User.findOne({
        where: { emailAddress: emailClean },
        include: [{ model: context.models.Role, as: 'role' }]
      });

      // If partner doesn't exist, create a placeholder user with PARTNER role
      if (!partner) {
        let partnerRole = await context.models.Role.findOne({ where: { roleType: 'PARTNER' } });
        if (!partnerRole) {
          partnerRole = await context.models.Role.create({
            id: uuidv4(),
            name: "Partner",
            description: "Default Partner Role",
            roleType: "PARTNER",
            centerId: viewer.centerId,
            isSystemDefine: true,
            createdBy: viewer.id,
            updatedBy: viewer.id
          });
        }

        partner = await context.models.User.create({
          id: uuidv4(),
          emailAddress: emailClean,
          pwHash: Buffer.from('placeholder-password'),
          centerId: viewer.centerId,
          roleId: partnerRole.id,
          isActive: true,
          inserted: new Date(),
          updated: new Date()
        });
      }

      // Establish link
      viewer.partnerId = partner.id;
      await viewer.save();

      partner.partnerId = viewer.id;
      await partner.save();

      return viewer;
    }),
    sendEncouragement: authenticate(async (parent, { message }, context) => {
      const viewer = context.viewer;
      if (viewer.role?.roleType !== 'PARTNER') {
        throw new GraphQLError('Only partner users can send encouragement.', {
          extensions: { code: 'FORBIDDEN' }
        });
      }

      if (!viewer.partnerId) {
        throw new GraphQLError('You are not linked to a mother account.', {
          extensions: { code: 'BAD_USER_INPUT' }
        });
      }

      await context.models.Notification.create({
        id: uuidv4(),
        userId: viewer.partnerId,
        centerId: viewer.centerId,
        kind: 'partner_encouragement',
        title: viewer.displayName ? `Message from ${viewer.displayName}` : 'Message from your partner',
        body: message,
        status: 'unread',
        data: { senderId: viewer.id },
        createdAt: new Date(),
        updatedAt: new Date()
      });

      return true;
    }),
    updatePartnerSharing: authenticate(async (parent, { shareVitals, shareReports }, context) => {
      const viewer = context.viewer;
      if (viewer.role?.roleType !== 'MOTHER') {
        throw new GraphQLError('Only mothers can update partner sharing permissions.', {
          extensions: { code: 'FORBIDDEN' }
        });
      }

      viewer.shareVitalsWithPartner = shareVitals;
      viewer.shareReportsWithPartner = shareReports;
      await viewer.save();

      return viewer;
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
    submitCoachingFeedback: authenticate(async (parent, { progressId, quotient, feedback }, context) => {
      const viewerRole = context.viewer.role?.roleType;
      return runValidated(() => getService(context).submitFeedback(
        progressId,
        quotient,
        feedback,
        viewerRole
      ));
    }),
    assignPartnerTask: authenticate(async (parent, { dayNumber, title, description }, context) => {
      const targetUserId = context.viewer.role?.roleType === 'PARTNER' ? context.viewer.partnerId : context.viewer.id;
      if (!targetUserId) {
        throw new GraphQLError('No partner linked to this account.', {
          extensions: { code: 'BAD_USER_INPUT' }
        });
      }
      return runValidated(() => new PartnerService(context.models, context.sequelize).assignTask(
        targetUserId,
        dayNumber,
        title,
        description
      ));
    }),
    submitPartnerResponse: authenticate(async (parent, { dayNumber, response, familyNotes }, context) => {
      const targetUserId = context.viewer.role?.roleType === 'PARTNER' ? context.viewer.id : context.viewer.partnerId;
      if (!targetUserId) {
        throw new GraphQLError('No partner linked to this account.', {
          extensions: { code: 'BAD_USER_INPUT' }
        });
      }
      return runValidated(() => new PartnerService(context.models, context.sequelize).submitResponse(
        targetUserId,
        dayNumber,
        response,
        familyNotes
      ));
    }),
  },
};
