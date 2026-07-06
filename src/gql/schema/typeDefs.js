export const typeDefs = `#graphql
  type Center {
    id: ID!
    name: String!
    emailAddress: String
    contactno: String
    address: String
    isActive: Boolean!
  }

  type Role {
    id: ID!
    name: String!
    roleType: String!
    description: String
    permissions: String
  }

  type User {
    id: ID!
    clerkId: String
    emailAddress: String!
    displayName: String
    firstName: String
    lastName: String
    gender: String
    mobileNo: String
    isActive: Boolean!
    center: Center
    role: Role
    lmpDate: String
    dueDate: String
    currentWeek: Int
    currentTrimester: Int
    pregnancyDay: Int
    language: String!
    subscriptionStatus: String!
  }

  type DailyContent {
    id: ID!
    dayNumber: Int!
    category: String!
    title: String!
    body: String!
    mediaUrl: String
  }

  type BabyDevelopment {
    id: ID!
    weekNumber: Int!
    size: String!
    weight: String
    milestone: String!
    imageUrl: String
  }

  type ForumComment {
    id: ID!
    user: User!
    content: String!
    createdAt: String!
  }

  type ForumPost {
    id: ID!
    user: User!
    title: String!
    content: String!
    likesCount: Int!
    comments: [ForumComment!]!
    createdAt: String!
  }

  type LiveClass {
    id: ID!
    title: String!
    instructor: String!
    startTime: String!
    durationMins: Int!
    videoCallUrl: String!
    isBooked: Boolean!
  }

  type RegisteredDevice {
    id: ID!
    deviceId: String!
    deviceName: String
    deviceType: String!
    browser: String
    operatingSystem: String
    ipAddress: String
    location: String
    status: String!
    isActive: Boolean!
    lastSeenAt: String
    createdAt: String!
  }

  type SystemParameter {
    id: ID!
    key: String!
    value: String
    centerId: String
  }

  type VitalsLog {
    id: ID!
    weight: Float
    systolicBp: Int
    diastolicBp: Int
    kickCount: Int
    bloodSugar: Float
    loggedAt: String!
  }

  type Payment {
    id: ID!
    stripeSessionId: String!
    amount: Float!
    status: String!
    createdAt: String!
  }

  type ExpertSchedule {
    id: ID!
    expert: User!
    dayOfWeek: Int!
    startTime: String!
    endTime: String!
    slotDurationMins: Int!
  }

  type ConsultationBooking {
    id: ID!
    user: User!
    expert: User!
    scheduleSlot: String!
    videoCallUrl: String!
    status: String!
  }

  type Query {
    me: User
    getUser(id: ID!): User
    getUsers(isActive: Boolean): [User!]!
    getDailyContent(dayNumber: Int!): DailyContent
    getContentLibrary(category: String!): [DailyContent!]!
    getBabyDevelopment(weekNumber: Int!): BabyDevelopment
    getForumPosts: [ForumPost!]!
    getLiveClasses: [LiveClass!]!
    getGuidedAudioSessions: [DailyContent!]!
    getMyDevices: [RegisteredDevice!]!
    getParameterConfig(key: String!): String
    getMyVitals: [VitalsLog!]!
    getExpertSchedules: [ExpertSchedule!]!
    getExpertBookings(expertId: ID!): [ConsultationBooking!]!
    getMyConsultations: [ConsultationBooking!]!
    getMyBillingHistory: [Payment!]!
  }

  type Mutation {
    syncUser(clerkUserPayload: String!): User!
    updateUser(id: ID!, firstName: String, lastName: String, displayName: String, mobileNo: String): User!
    saveOnboarding(lmpDate: String, dueDate: String, language: String!): User!
    addForumPost(title: String!, content: String!): ForumPost!
    addForumComment(postId: ID!, content: String!): ForumComment!
    bookLiveClass(classId: ID!): LiveClass!
    createStripeCheckout(plan: String!): String!
    adminAddContent(
      dayNumber: Int!
      category: String!
      titleEn: String!
      titleHi: String!
      bodyEn: String!
      bodyHi: String!
      mediaUrl: String
    ): DailyContent!
    registerDevice(
      deviceId: String
      deviceName: String
      deviceType: String
      browser: String
      operatingSystem: String
      deviceFingerprint: String
      ipAddress: String
      location: String
    ): RegisteredDevice!
    approveDevice(deviceId: String!): RegisteredDevice!
    rejectDevice(deviceId: String!, reason: String!): RegisteredDevice!
    deauthorizeDevice(deviceId: String!): Boolean!
    setSystemParameter(key: String!, value: String!): SystemParameter!
    logVitals(
      weight: Float
      systolicBp: Int
      diastolicBp: Int
      kickCount: Int
      bloodSugar: Float
      loggedAt: String
    ): VitalsLog!
    bookConsultation(expertId: ID!, scheduleSlot: String!): ConsultationBooking!
    cancelConsultation(bookingId: ID!): Boolean!
    dispatchDailyWhatsAppReminders: Boolean!
  }
`;
