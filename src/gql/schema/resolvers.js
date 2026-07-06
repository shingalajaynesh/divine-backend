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

export const resolvers = {
  User: {
    ...userResolvers.User,
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
  LiveClass: {
    ...liveClassResolvers.LiveClass,
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
  StoreOrder: {
    ...storeResolvers.StoreOrder,
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
  }
};
