import { userResolvers } from './resolvers/user.js';
import { contentResolvers } from './resolvers/content.js';
import { forumResolvers } from './resolvers/forum.js';
import { liveClassResolvers } from './resolvers/liveClass.js';
import { deviceResolvers } from './resolvers/device.js';
import { parameterResolvers } from './resolvers/parameter.js';
import { vitalsResolvers } from './resolvers/vitals.js';
import { bookingResolvers } from './resolvers/booking.js';
import { inquiryResolvers } from './resolvers/inquiry.js';
import { programResolvers } from './resolvers/program.js';
import { contentCmsResolvers } from './resolvers/contentCms.js';
import { notificationResolvers } from './resolvers/notification.js';
import { timelineResolvers } from './resolvers/timeline.js';
import { playlistResolvers } from './resolvers/playlist.js';
import { dietResolvers } from './resolvers/diet.js';
import { wellnessResolvers } from './resolvers/wellness.js';
import { supportResolvers } from './resolvers/support.js';
import { storeResolvers } from './resolvers/store.js';
import { subscriptionResolvers } from './resolvers/subscription.js';
import { financeResolvers } from './resolvers/finance.js';
import { reportResolvers } from './resolvers/report.js';
import { reportScheduleResolvers } from './resolvers/reportSchedule.js';
import { platformConfigResolvers } from './resolvers/platformConfig.js';
import { systemHealthResolvers } from './resolvers/systemHealth.js';
import { performanceProfileResolvers } from './resolvers/performanceProfile.js';
import { databaseTuningResolvers } from './resolvers/databaseTuning.js';
import { devopsResolvers } from './resolvers/devops.js';
import { crmResolvers } from './resolvers/crm.js';
import { staffTaskResolvers } from './resolvers/staffTask.js';
import { adminResolvers } from './resolvers/admin.js';
import { franchiseResolvers } from './resolvers/franchise.js';
import { superAdminResolvers } from './resolvers/superAdmin.js';
import { recommendationResolvers } from './resolvers/recommendation.js';
import { counselingResolvers } from './resolvers/counseling.js';
import { specialEventResolvers } from './resolvers/specialEvent.js';
import { referralResolvers } from './resolvers/referral.js';

export const resolvers = {
  User: {
    ...userResolvers.User,
  },
  UserReferral: {
    ...referralResolvers.UserReferral,
  },
  Testimonial: {
    ...referralResolvers.Testimonial,
  },
  AmbassadorApplication: {
    ...referralResolvers.AmbassadorApplication,
  },
  DailyContent: {
    ...contentResolvers.DailyContent,
  },
  BabyDevelopment: {
    ...contentResolvers.BabyDevelopment,
  },
  ForumComment: {
    ...forumResolvers.ForumComment,
  },
  ForumPost: {
    ...forumResolvers.ForumPost,
  },
  ForumGroup: {
    ...forumResolvers.ForumGroup,
  },
  LiveClass: {
    ...liveClassResolvers.LiveClass,
  },
  ConsultationBooking: {
    ...bookingResolvers.ConsultationBooking,
  },
  Inquiry: {
    ...inquiryResolvers.Inquiry,
  },
  InquiryResponse: {
    ...inquiryResolvers.InquiryResponse,
  },
  ContentItem: {
    ...contentCmsResolvers.ContentItem,
  },
  DailyProgress: {
    ...timelineResolvers.DailyProgress,
  },
  TimelineOverview: {
    ...timelineResolvers.TimelineOverview,
  },
  VitalsLog: {
    ...wellnessResolvers.VitalsLog,
  },
  Appointment: {
    ...wellnessResolvers.Appointment,
  },
  SupportTicket: {
    ...supportResolvers.SupportTicket,
  },
  SupportTicketMessage: {
    ...supportResolvers.SupportTicketMessage,
  },
  CounselingLead: {
    ...counselingResolvers.CounselingLead,
  },
  CounselingCall: {
    ...counselingResolvers.CounselingCall,
  },
  StoreOrder: {
    ...storeResolvers.StoreOrder,
  },
  UserSubscription: {
    ...subscriptionResolvers.UserSubscription,
  },
  Invoice: {
    ...subscriptionResolvers.Invoice,
  },
  FinancialTransaction: {
    ...financeResolvers.FinancialTransaction,
  },
  ReportTemplate: {
    ...reportResolvers.ReportTemplate,
  },
  ReportSchedule: {
    ...reportScheduleResolvers.ReportSchedule,
  },
  SystemSetting: {
    ...platformConfigResolvers.SystemSetting,
  },
  FeatureFlag: {
    ...platformConfigResolvers.FeatureFlag,
  },
  LocaleString: {
    ...platformConfigResolvers.LocaleString,
  },
  SystemMetric: {
    ...systemHealthResolvers.SystemMetric,
  },
  SlowQueryRecord: {
    ...performanceProfileResolvers.SlowQueryRecord,
  },
  DatabaseBackup: {
    ...devopsResolvers.DatabaseBackup,
  },
  Coupon: {
    ...subscriptionResolvers.Coupon,
  },
  CrmUser: {
    ...crmResolvers.CrmUser,
  },
  CrmNote: {
    ...crmResolvers.CrmNote,
  },
  AdminAuditLog: {
    ...crmResolvers.AdminAuditLog,
  },
  StaffTask: {
    ...staffTaskResolvers.StaffTask,
  },
  LiveClassBooking: {
    ...staffTaskResolvers.LiveClassBooking,
  },
  EventRegistration: {
    ...specialEventResolvers.EventRegistration,
  },
  Query: {
    ...userResolvers.Query,
    ...contentResolvers.Query,
    ...forumResolvers.Query,
    ...liveClassResolvers.Query,
    ...deviceResolvers.Query,
    ...parameterResolvers.Query,
    ...vitalsResolvers.Query,
    ...bookingResolvers.Query,
    ...inquiryResolvers.Query,
    ...programResolvers.Query,
    ...contentCmsResolvers.Query,
    ...notificationResolvers.Query,
    ...timelineResolvers.Query,
    ...playlistResolvers.Query,
    ...dietResolvers.Query,
    ...wellnessResolvers.Query,
    ...supportResolvers.Query,
    ...storeResolvers.Query,
    ...subscriptionResolvers.Query,
    ...financeResolvers.Query,
    ...reportResolvers.Query,
    ...reportScheduleResolvers.Query,
    ...platformConfigResolvers.Query,
    ...systemHealthResolvers.Query,
    ...performanceProfileResolvers.Query,
    ...databaseTuningResolvers.Query,
    ...devopsResolvers.Query,
    ...crmResolvers.Query,
    ...staffTaskResolvers.Query,
    ...adminResolvers.Query,
    ...franchiseResolvers.Query,
    ...superAdminResolvers.Query,
    ...recommendationResolvers.Query,
    ...counselingResolvers.Query,
    ...specialEventResolvers.Query,
    ...referralResolvers.Query,
  },
  Mutation: {
    ...userResolvers.Mutation,
    ...contentResolvers.Mutation,
    ...forumResolvers.Mutation,
    ...liveClassResolvers.Mutation,
    ...deviceResolvers.Mutation,
    ...parameterResolvers.Mutation,
    ...vitalsResolvers.Mutation,
    ...bookingResolvers.Mutation,
    ...inquiryResolvers.Mutation,
    ...programResolvers.Mutation,
    ...contentCmsResolvers.Mutation,
    ...notificationResolvers.Mutation,
    ...timelineResolvers.Mutation,
    ...playlistResolvers.Mutation,
    ...dietResolvers.Mutation,
    ...wellnessResolvers.Mutation,
    ...supportResolvers.Mutation,
    ...storeResolvers.Mutation,
    ...subscriptionResolvers.Mutation,
    ...financeResolvers.Mutation,
    ...reportResolvers.Mutation,
    ...reportScheduleResolvers.Mutation,
    ...platformConfigResolvers.Mutation,
    ...performanceProfileResolvers.Mutation,
    ...databaseTuningResolvers.Mutation,
    ...devopsResolvers.Mutation,
    ...crmResolvers.Mutation,
    ...staffTaskResolvers.Mutation,
    ...superAdminResolvers.Mutation,
    ...counselingResolvers.Mutation,
    ...specialEventResolvers.Mutation,
    ...referralResolvers.Mutation,
  }
};
