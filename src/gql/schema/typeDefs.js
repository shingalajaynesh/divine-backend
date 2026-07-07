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
    firebaseUid: String
    emailAddress: String
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
    partner: User
    shareVitalsWithPartner: Boolean!
    shareReportsWithPartner: Boolean!
  }

  type PartnerDashboardData {
    motherName: String!
    pregnancyDay: Int
    currentWeek: Int
    currentTrimester: Int
    babySize: String
    babyMilestone: String
    progressPercent: Int!
    dailyQuizAttempted: Boolean!
    partnerActivityCompleted: Boolean!
    partnerActivityTitle: String
    partnerActivityDescription: String
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
    reported: Boolean!
    reportsCount: Int!
    createdAt: String!
  }

  type ForumPost {
    id: ID!
    user: User!
    title: String!
    content: String!
    category: String!
    likesCount: Int!
    likedByUsers: String!
    isLiked: Boolean!
    reported: Boolean!
    reportsCount: Int!
    comments: [ForumComment!]!
    createdAt: String!
  }

  type LiveClass {
    id: ID!
    title: String!
    titleEn: String!
    titleHi: String!
    instructor: String!
    startTime: String!
    durationMins: Int!
    videoCallUrl: String!
    replayUrl: String
    isBooked: Boolean!
    booked: Boolean!
    attended: Boolean!
    feedbackScore: Int
    feedbackNotes: String
  }

  type LiveClassBooking {
    userId: ID!
    liveClassId: ID!
    attended: Boolean!
    feedbackScore: Int
    feedbackNotes: String
    user: User
  }

  type StaffTask {
    id: ID!
    staffId: ID!
    userId: ID
    title: String!
    description: String
    dueDate: String
    completed: Boolean!
    createdAt: String!
    updatedAt: String!
    user: User
  }

  input SubmitLiveClassFeedbackInput {
    liveClassId: ID!
    feedbackScore: Int!
    feedbackNotes: String
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
    symptoms: String
    loggedAt: String!
  }

  type HospitalBagItem {
    id: ID!
    itemName: String!
    packed: Boolean!
    category: String!
  }

  type Appointment {
    id: ID!
    title: String!
    doctorName: String
    appointmentDate: String!
    notes: String
  }

  type MedicineReminder {
    id: ID!
    name: String!
    dosage: String!
    timeOfDay: String!
    active: Boolean!
  }

  input LogVitalsAndSymptomsInput {
    weight: Float
    systolicBp: Int
    diastolicBp: Int
    kickCount: Int
    bloodSugar: Float
    symptoms: [String!]
  }

  input AddAppointmentInput {
    title: String!
    doctorName: String
    appointmentDate: String!
    notes: String
  }

  input AddMedicineInput {
    name: String!
    dosage: String!
    timeOfDay: String!
  }

  input AddHospitalBagItemInput {
    itemName: String!
    category: String
  }

  type Payment {
    id: ID!
    stripeSessionId: String
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
    caseNotes: String
    followUpTasks: String
  }

  input SubmitCaseNotesInput {
    bookingId: ID!
    caseNotes: String!
    followUpTasks: [String!]
  }

  type SupportTicket {
    id: ID!
    subject: String!
    description: String!
    status: String!
    priority: String!
    category: String!
    satisfactionScore: Int
    satisfactionFeedback: String
    whatsappHandoffRequested: Boolean!
    slaBreached: Boolean!
    slaExpiresAt: String!
    createdAt: String!
    messages: [SupportTicketMessage!]!
  }

  type SupportTicketMessage {
    id: ID!
    ticketId: ID!
    senderId: ID!
    senderType: String!
    message: String!
    createdAt: String!
    sender: User
  }

  input CreateSupportTicketInput {
    subject: String!
    description: String!
    priority: String
    category: String
  }

  input AddSupportTicketMessageInput {
    ticketId: ID!
    message: String!
  }

  input CloseSupportTicketInput {
    ticketId: ID!
    satisfactionScore: Int
    satisfactionFeedback: String
  }

  type Product {
    id: ID!
    title: String!
    description: String
    price: Float!
    imageUrl: String
    inventoryCount: Int!
    category: String!
  }

  type CartItem {
    id: ID!
    productId: ID!
    quantity: Int!
    product: Product!
  }

  type UserAddress {
    id: ID!
    fullName: String!
    addressLine1: String!
    addressLine2: String
    city: String!
    state: String!
    postalCode: String!
    phone: String!
  }

  type StoreOrderReturn {
    id: ID!
    orderId: ID!
    reason: String!
    status: String!
    adminNotes: String
    createdAt: String!
    updatedAt: String!
  }

  type StoreOrder {
    id: ID!
    totalAmount: Float!
    status: String!
    createdAt: String!
    address: UserAddress
    items: [StoreOrderItem!]!
    carrier: String
    trackingNumber: String
    estimatedDeliveryDate: String
    shippedAt: String
    deliveredAt: String
    returnRequest: StoreOrderReturn
  }

  type StoreOrderItem {
    id: ID!
    quantity: Int!
    price: Float!
    product: Product!
  }

  type SubscriptionPlan {
    id: ID!
    name: String!
    description: String
    price: Float!
    billingPeriod: String!
    trialDays: Int!
    features: [String!]!
  }

  type RazorpayOrder {
    id: String!
    amount: Int!
    currency: String!
    receipt: String!
  }

  type UserSubscription {
    id: ID!
    userId: ID!
    planId: ID!
    status: String!
    trialStartDate: String
    trialEndDate: String
    currentPeriodStartDate: String!
    currentPeriodEndDate: String!
    cancelledAt: String
    plan: SubscriptionPlan
  }

  type Coupon {
    id: ID!
    code: String!
    discountPercent: Int
    discountAmount: Float
    validFrom: String!
    validUntil: String!
    maxRedemptions: Int
    redemptionsCount: Int!
  }

  type CrmUser {
    id: ID!
    displayName: String!
    email: String!
    phone: String
    pregnancyStartDate: String
    pregnancyDay: Int
    role: Role
    subscriptions: [UserSubscription!]!
  }

  type CrmNote {
    id: ID!
    userId: ID!
    authorId: ID!
    note: String!
    createdAt: String!
    updatedAt: String!
    author: User
  }

  type AdminAuditLog {
    id: ID!
    userId: ID!
    action: String!
    targetType: String
    targetId: String
    payload: String
    createdAt: String!
    user: User
  }

  input AddAddressInput {
    fullName: String!
    addressLine1: String!
    addressLine2: String
    city: String!
    state: String!
    postalCode: String!
    phone: String!
  }

  input CartItemInput {
    productId: ID!
    quantity: Int!
  }

  type InquiryResponse {
    id: ID!
    content: String!
    author: User!
    createdAt: String!
  }

  type Inquiry {
    id: ID!
    name: String!
    email: String
    phone: String!
    city: String!
    language: String!
    preferredCallTime: String
    message: String
    source: String!
    status: String!
    responses: [InquiryResponse!]!
    createdAt: String!
    updatedAt: String!
  }

  type InquiryConnection {
    items: [Inquiry!]!
    total: Int!
  }

  type ProgramActivity {
    id: ID!
    slug: String!
    title: String!
    instructions: String!
    quotient: String!
    activityType: String!
    mediaUrl: String
    estimatedMins: Int!
    requiresSubmission: Boolean!
    points: Int!
  }

  type ProgramLesson {
    id: ID!
    slug: String!
    title: String!
    summary: String
    lessonType: String!
    durationMins: Int
    releaseDay: Int
    activities: [ProgramActivity!]!
  }

  type ProgramModule {
    id: ID!
    title: String!
    description: String
    coverUrl: String
    unlockDay: Int
    lessons: [ProgramLesson!]!
  }

  type Program {
    id: ID!
    slug: String!
    name: String!
    summary: String
    coverUrl: String
    language: String!
    journeyStage: String!
    isPremium: Boolean!
    modules: [ProgramModule!]!
  }

  type ActivityProgress {
    id: ID!
    activityId: ID!
    status: String!
    attempts: Int!
    score: Float
    durationSeconds: Int!
    lastPositionSeconds: Int!
    notes: String
    evidenceUrl: String
    startedAt: String
    completedAt: String
  }

  type ProgramEnrollment {
    id: ID!
    status: String!
    source: String!
    enrolledAt: String!
    startedAt: String
    completedAt: String
    accessStartsAt: String
    accessEndsAt: String
    program: Program!
    activityProgress: [ActivityProgress!]!
  }

  input ActivityProgressInput {
    status: String
    attempts: Int
    score: Float
    durationSeconds: Int
    lastPositionSeconds: Int
    notes: String
    evidenceUrl: String
  }

  type ContentCategory { id: ID!, slug: String!, name: String!, description: String, icon: String }
  type MediaAsset { id: ID!, url: String, mimeType: String!, kind: String!, status: String!, altText: String }
  type ContentTranslation { id: ID!, language: String!, title: String!, summary: String, body: String }
  type ContentItem {
    id: ID!, slug: String!, contentType: String!, status: String!, visibility: String!, publishAt: String, unpublishAt: String
    category: ContentCategory, coverAsset: MediaAsset, translations: [ContentTranslation!]!, translation: ContentTranslation
    trimester1Safe: Boolean, trimester2Safe: Boolean, trimester3Safe: Boolean, contraindications: String
    medicalReviewed: Boolean
  }
  input ContentTranslationInput { language: String!, title: String!, summary: String, body: String }
  input CreateContentItemInput {
    slug: String!, contentType: String!, visibility: String, categoryId: ID, coverAssetId: ID,
    publishAt: String, unpublishAt: String, translations: [ContentTranslationInput!]!
  }
  input RegisterMediaAssetInput { url: String!, mimeType: String!, kind: String!, sizeBytes: Int, durationSeconds: Int, altText: String }
  type RecentSearch { id: ID!, query: String!, resultCount: Int!, searchedAt: String! }
  type BookmarkState { contentItemId: ID!, kind: String!, saved: Boolean! }
  type ContentViewHistory { id: ID!, contentItemId: ID, dailyContentId: ID, lastPositionSeconds: Int!, progressPercent: Float!, completed: Boolean!, viewCount: Int!, viewedAt: String! }
  input ContentBookmarkInput { contentItemId: ID!, kind: String, saved: Boolean! }
  input ContentViewInput { contentItemId: ID, dailyContentId: ID, lastPositionSeconds: Int, progressPercent: Float, completed: Boolean }
  input DailyActivityDetailsInput {
    dayNumber: Int!
    quotient: String!
    durationMins: Int
    evidence: String
    notes: String
  }
  type Notification { id: ID!, kind: String!, title: String!, body: String!, actionUrl: String, status: String!, readAt: String, scheduledAt: String, expiresAt: String, createdAt: String! }
  type NotificationInbox { items: [Notification!]!, unreadCount: Int! }
  type NotificationPreference { id: ID!, pushEnabled: Boolean!, emailEnabled: Boolean!, whatsappEnabled: Boolean!, marketingAllowed: Boolean!, quietStart: String, quietEnd: String, timezone: String! }
  type ReminderSchedule { id: ID!, reminderType: String!, label: String!, localTime: String!, daysOfWeek: [Int!]!, channel: String!, enabled: Boolean! }
  input NotificationPreferenceInput { pushEnabled: Boolean, emailEnabled: Boolean, whatsappEnabled: Boolean, marketingAllowed: Boolean, quietStart: String, quietEnd: String, timezone: String }
  input ReminderScheduleInput { id: ID, reminderType: String, label: String!, localTime: String!, daysOfWeek: [Int!]!, channel: String, enabled: Boolean }
  
  type DietPreference {
    userId: ID!
    dietType: String!
    allergens: String
    notes: String
  }

  type UserMealPlan {
    id: ID!
    userId: ID!
    dayNumber: Int!
    mealType: String!
    contentItemId: ID
    customMealName: String
    completed: Boolean!
  }

  type ShoppingListItem {
    id: ID!
    userId: ID!
    ingredientName: String!
    quantity: String
    purchased: Boolean!
  }

  input UpdateDietPreferenceInput {
    dietType: String!
    allergens: [String!]
    notes: String
  }

  input AddShoppingItemInput {
    ingredientName: String!
    quantity: String
  }

  type AudioPlaylist {
    id: ID!
    userId: ID!
    name: String!
    description: String
    items: [AudioPlaylistItem!]!
    createdAt: String!
    updatedAt: String!
  }

  type AudioPlaylistItem {
    id: ID!
    playlistId: ID!
    contentItem: ContentItem!
    sortOrder: Int!
    createdAt: String!
    updatedAt: String!
  }

  type UserStreak {
    id: ID!
    userId: ID!
    currentStreak: Int!
    longestStreak: Int!
    lastCompletedDate: String
  }

  type UserAchievement {
    id: ID!
    userId: ID!
    badgeKey: String!
    unlockedAt: String!
  }

  type WeeklyReportDay {
    dayNumber: Int!
    completed: Boolean!
    pqCompleted: Boolean!
    iqCompleted: Boolean!
    eqCompleted: Boolean!
    sqCompleted: Boolean!
    totalDurationMins: Int!
    reflections: [String!]!
  }

  type WeeklyReport {
    weekNumber: Int!
    completedDaysCount: Int!
    totalWeekDurationMins: Int!
    days: [WeeklyReportDay!]!
  }

  type QuizQuestion {
    id: ID!
    dayNumber: Int!
    questionText: String!
    options: [String!]!
    correctOptionIndex: Int!
    explanation: String!
  }

  type QuizAttempt {
    id: ID!
    userId: ID!
    dayNumber: Int!
    selectedOptionIndex: Int!
    isCorrect: Boolean!
    attemptedAt: String!
  }

  type PartnerActivity {
    id: ID!
    dayNumber: Int!
    title: String!
    description: String!
  }

  type PartnerActivityLog {
    id: ID!
    userId: ID!
    dayNumber: Int!
    partnerAcknowledged: Boolean!
    completedAt: String
  }

  type SensoryActivity {
    id: ID!
    dayNumber: Int!
    senseType: String!
    title: String!
    description: String!
  }

  type SensoryActivityLog {
    id: ID!
    userId: ID!
    dayNumber: Int!
    completed: Boolean!
    completedAt: String
  }

  type DailyProgress {
    id: ID!
    userId: ID!
    dayNumber: Int!
    pqCompleted: Boolean!
    iqCompleted: Boolean!
    eqCompleted: Boolean!
    sqCompleted: Boolean!
    pqDurationMins: Int
    iqDurationMins: Int
    eqDurationMins: Int
    sqDurationMins: Int
    pqEvidence: String
    iqEvidence: String
    eqEvidence: String
    sqEvidence: String
    pqNotes: String
    iqNotes: String
    eqNotes: String
    sqNotes: String
    notes: String
    completedAt: String
    createdAt: String!
    updatedAt: String!
  }

  type TimelineDayStatus {
    dayNumber: Int!
    locked: Boolean!
    completed: Boolean!
    pqCompleted: Boolean!
    iqCompleted: Boolean!
    eqCompleted: Boolean!
    sqCompleted: Boolean!
  }

  type TimelineOverview {
    currentDay: Int!
    currentWeek: Int!
    currentTrimester: Int!
    selectedDay: Int!
    selectedWeek: Int!
    selectedMonth: Int!
    selectedTrimester: Int!
    weekStartDay: Int!
    weekEndDay: Int!
    isLocked: Boolean!
    unlockDate: String
    completedCount: Int!
    progressPercent: Int!
    selectedProgress: DailyProgress
    days: [TimelineDayStatus!]!
  }

  input SubmitInquiryInput {
    name: String!
    email: String
    phone: String!
    city: String!
    language: String!
    preferredCallTime: String
    message: String
    source: String
  }

  type CenterKpis {
    totalMothers: Int!
    activeStaff: Int!
    premiumEnrollments: Int!
    slaBreachedTickets: Int!
    enrollmentTrend: [EnrollmentTrendPoint!]!
    staffHealth: [StaffHealthPoint!]!
    escalatedTickets: [SupportTicket!]!
  }

  type EnrollmentTrendPoint {
    weekLabel: String!
    count: Int!
  }

  type StaffHealthPoint {
    staffId: ID!
    displayName: String!
    email: String!
    pendingTasksCount: Int!
    completedTasksCount: Int!
  }

  type Query {
    getCenterKpis: CenterKpis!
    me: User
    getUser(id: ID!): User
    getUsers(isActive: Boolean): [User!]!
    getDailyContent(dayNumber: Int!): DailyContent
    getContentLibrary(category: String!): [DailyContent!]!
    getBabyDevelopment(weekNumber: Int!): BabyDevelopment
    getForumPosts(category: String): [ForumPost!]!
    getLiveClasses: [LiveClass!]!
    getGuidedAudioSessions: [DailyContent!]!
    getMyDevices: [RegisteredDevice!]!
    getParameterConfig(key: String!): String
    getMyVitals: [VitalsLog!]!
    getExpertSchedules: [ExpertSchedule!]!
    getExpertBookings(expertId: ID!): [ConsultationBooking!]!
    getMyConsultations: [ConsultationBooking!]!
    getMyBillingHistory: [Payment!]!
    getInquiries(status: String, search: String, limit: Int, offset: Int): InquiryConnection!
    programCatalog: [Program!]!
    myProgramEnrollments: [ProgramEnrollment!]!
    contentFeed(language: String, categorySlug: String, contentType: String, limit: Int, offset: Int): [ContentItem!]!
    manageContent(status: String, search: String, limit: Int, offset: Int): [ContentItem!]!
    searchContent(query: String!, language: String, categorySlug: String, contentType: String, limit: Int, offset: Int): [ContentItem!]!
    recentContentSearches: [RecentSearch!]!
    savedContent(kind: String, language: String): [ContentItem!]!
    myNotifications(status: String, limit: Int, offset: Int): NotificationInbox!
    myNotificationPreferences: NotificationPreference!
    myReminderSchedules: [ReminderSchedule!]!
    myTimelineOverview(dayNumber: Int): TimelineOverview!
    myDailyProgress(dayNumber: Int!): DailyProgress
    myDailyProgressRange(startDay: Int!, endDay: Int!): [DailyProgress!]!
    myStreak: UserStreak
    myAchievements: [UserAchievement!]!
    myWeeklyReport(weekNumber: Int!): WeeklyReport!
    getDailyQuiz(dayNumber: Int!): QuizQuestion
    getMyQuizAttempt(dayNumber: Int!): QuizAttempt
    getPartnerActivity(dayNumber: Int!): PartnerActivity
    getMyPartnerActivityLog(dayNumber: Int!): PartnerActivityLog
    getSensoryActivity(dayNumber: Int!): SensoryActivity
    getMySensoryActivityLog(dayNumber: Int!): SensoryActivityLog
    getContentViewHistory(contentItemId: ID, dailyContentId: ID): ContentViewHistory
    getMyPlaylists: [AudioPlaylist!]!
    getPlaylistDetails(id: ID!): AudioPlaylist!
    getDietPreference: DietPreference!
    getMyMealPlans(dayNumber: Int!): [UserMealPlan!]!
    getShoppingList: [ShoppingListItem!]!
    getLiveClassesDetailed: [LiveClass!]!
    getPrescriptionSummary: [ConsultationBooking!]!
    getAppointments: [Appointment!]!
    getMedicineReminders: [MedicineReminder!]!
    getHospitalBagItems: [HospitalBagItem!]!
    getSupportTickets: [SupportTicket!]!
    getSupportTicketDetails(id: ID!): SupportTicket
    getProducts: [Product!]!
    getCart: [CartItem!]!
    getAddresses: [UserAddress!]!
    getMyOrders: [StoreOrder!]!
    getAdminOrders: [StoreOrder!]!
    getPlans: [SubscriptionPlan!]!
    getMySubscription: UserSubscription
    validateCoupon(code: String!): Coupon
    getCrmUsers: [CrmUser!]!
    getCrmNotes(userId: ID!): [CrmNote!]!
    getAuditLogs: [AdminAuditLog!]!
    getPartnerDashboard: PartnerDashboardData
    getLiveClassBookings(classId: ID!): [LiveClassBooking!]!
    getStaffTasks: [StaffTask!]!
  }

  type Mutation {
    syncUser: User!
    updateUser(id: ID!, firstName: String, lastName: String, displayName: String, mobileNo: String): User!
    saveOnboarding(lmpDate: String, dueDate: String, language: String!): User!
    addForumPost(title: String!, content: String!, category: String): ForumPost!
    addForumComment(postId: ID!, content: String!): ForumComment!
    togglePostLike(postId: ID!): ForumPost!
    reportPost(postId: ID!): ForumPost!
    reportComment(commentId: ID!): ForumComment!
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
    submitInquiry(input: SubmitInquiryInput!): Inquiry!
    updateInquiryStatus(id: ID!, status: String!): Inquiry!
    replyToInquiry(id: ID!, content: String!): Inquiry!
    enrollInProgram(programId: ID!): ProgramEnrollment!
    updateActivityProgress(activityId: ID!, input: ActivityProgressInput!): ActivityProgress!
    createContentItem(input: CreateContentItemInput!): ContentItem!
    publishContentItem(id: ID!): ContentItem!
    reviewContentItem(id: ID!, reviewed: Boolean!): ContentItem!
    registerMediaAsset(input: RegisterMediaAssetInput!): MediaAsset!
    setContentBookmark(input: ContentBookmarkInput!): BookmarkState!
    clearRecentContentSearches: Boolean!
    recordContentView(input: ContentViewInput!): ContentViewHistory!
    setNotificationStatus(id: ID!, status: String!): Notification!
    markAllNotificationsRead: Boolean!
    updateNotificationPreferences(input: NotificationPreferenceInput!): NotificationPreference!
    saveReminderSchedule(input: ReminderScheduleInput!): ReminderSchedule!
    deleteReminderSchedule(id: ID!): Boolean!
    toggleDailyActivity(dayNumber: Int!, quotient: String!): DailyProgress!
    saveDailyActivityDetails(input: DailyActivityDetailsInput!): DailyProgress!
    submitQuizAnswer(dayNumber: Int!, selectedOptionIndex: Int!): QuizAttempt!
    acknowledgePartnerActivity(dayNumber: Int!): PartnerActivityLog!
    toggleSensoryActivity(dayNumber: Int!): SensoryActivityLog!
    linkPartner(partnerEmail: String!): User!
    sendEncouragement(message: String!): Boolean!
    updatePartnerSharing(shareVitals: Boolean!, shareReports: Boolean!): User!
    createPlaylist(name: String!, description: String): AudioPlaylist!
    deletePlaylist(id: ID!): Boolean!
    addPlaylistItem(playlistId: ID!, contentItemId: ID!): AudioPlaylistItem!
    removePlaylistItem(playlistId: ID!, contentItemId: ID!): Boolean!
    reorderPlaylistItem(playlistId: ID!, contentItemId: ID!, newPosition: Int!): Boolean!
    updateDietPreference(input: UpdateDietPreferenceInput!): DietPreference!
    toggleMealPlan(mealPlanId: ID!, completed: Boolean!): UserMealPlan!
    addShoppingListItem(input: AddShoppingItemInput!): ShoppingListItem!
    toggleShoppingListItem(itemId: ID!, purchased: Boolean!): ShoppingListItem!
    clearPurchasedShoppingList: Boolean!
    bookLiveClassDetailed(liveClassId: ID!): LiveClassBooking!
    submitLiveClassFeedback(input: SubmitLiveClassFeedbackInput!): LiveClassBooking!
    updateLiveClassReplay(liveClassId: ID!, replayUrl: String!): LiveClass!
    submitCaseNotes(input: SubmitCaseNotesInput!): ConsultationBooking!
    logVitalsAndSymptoms(input: LogVitalsAndSymptomsInput!): VitalsLog!
    addAppointment(input: AddAppointmentInput!): Appointment!
    deleteAppointment(id: ID!): Boolean!
    addMedicineReminder(input: AddMedicineInput!): MedicineReminder!
    toggleMedicineReminder(id: ID!, active: Boolean!): MedicineReminder!
    deleteMedicineReminder(id: ID!): Boolean!
    addHospitalBagItem(input: AddHospitalBagItemInput!): HospitalBagItem!
    toggleHospitalBagItem(id: ID!, packed: Boolean!): HospitalBagItem!
    clearPackedHospitalBagItems: Boolean!
    createSupportTicket(input: CreateSupportTicketInput!): SupportTicket!
    addSupportTicketMessage(input: AddSupportTicketMessageInput!): SupportTicketMessage!
    closeSupportTicket(input: CloseSupportTicketInput!): SupportTicket!
    requestWhatsappHandoff(id: ID!): SupportTicket!
    addToCart(input: CartItemInput!): CartItem!
    updateCartQuantity(input: CartItemInput!): CartItem!
    removeFromCart(productId: ID!): Boolean!
    addAddress(input: AddAddressInput!): UserAddress!
    deleteAddress(id: ID!): Boolean!
    placeOrder(addressId: ID!): StoreOrder!
    updateOrderTracking(orderId: ID!, carrier: String!, trackingNumber: String!, estimatedDeliveryDate: String): StoreOrder!
    updateOrderStatus(orderId: ID!, status: String!): StoreOrder!
    requestOrderReturn(orderId: ID!, reason: String!): StoreOrderReturn!
    reviewOrderReturn(orderReturnId: ID!, status: String!, adminNotes: String): StoreOrderReturn!
    startTrial(planId: ID!): UserSubscription!
    subscribeToPlan(planId: ID!, couponCode: String): UserSubscription!
    cancelSubscription: UserSubscription!
    createRazorpayOrder(planId: ID!, couponCode: String): RazorpayOrder!
    verifyRazorpayPayment(planId: ID!, razorpayOrderId: String!, razorpayPaymentId: String!, razorpaySignature: String!): UserSubscription!
    addCrmNote(userId: ID!, note: String!): CrmNote!
    logAdminAction(action: String!, targetType: String, targetId: String, payload: String): AdminAuditLog!
    recordClassAttendance(classId: ID!, userId: ID!, attended: Boolean!): LiveClassBooking!
    createStaffTask(userId: ID, title: String!, description: String, dueDate: String): StaffTask!
    toggleStaffTask(id: ID!): StaffTask!
    deleteStaffTask(id: ID!): Boolean!
    createExpertSchedule(dayOfWeek: Int!, startTime: String!, endTime: String!, slotDurationMins: Int!): ExpertSchedule!
    deleteExpertSchedule(id: ID!): Boolean!
    updateConsultationStatus(bookingId: ID!, status: String!): ConsultationBooking!
  }
`;
