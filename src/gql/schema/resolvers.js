import { userResolvers } from './resolvers/user.js';
import { contentResolvers } from './resolvers/content.js';
import { forumResolvers } from './resolvers/forum.js';
import { liveClassResolvers } from './resolvers/liveClass.js';
import { deviceResolvers } from './resolvers/device.js';
import { parameterResolvers } from './resolvers/parameter.js';
import { vitalsResolvers } from './resolvers/vitals.js';
import { bookingResolvers } from './resolvers/booking.js';
import { inquiryResolvers } from './resolvers/inquiry.js';

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
  }
};
