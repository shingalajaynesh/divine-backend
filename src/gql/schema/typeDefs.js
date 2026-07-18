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
    postpartumPlan: String
    emergencyContacts: String
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

  type ForumGroup {
    id: ID!
    name: String!
    description: String
    coverUrl: String
    isPrivate: Boolean!
    posts: [ForumPost!]!
    createdAt: String!
  }

  type ReactionStats {
    type: String!
    count: Int!
  }

  type ModerationQueue {
    flaggedPosts: [ForumPost!]!
    flaggedComments: [ForumComment!]!
  }

  type ForumComment {
    id: ID!
    user: User!
    content: String!
    reported: Boolean!
    reportsCount: Int!
    reportedReason: String
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
    reportedReason: String
    group: ForumGroup
    reactionsCount: Int!
    reactionStats: [ReactionStats!]!
    userReaction: String
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
    centerId: ID
    seriesTitle: String
    batchName: String
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
    status: String!
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
    mood: String
    sleepHours: Float
    hydrationWater: Float
    nutritionCalories: Float
    nutritionMealNotes: String
    loggedAt: String!
  }

  type Recommendation {
    id: ID!
    title: String!
    description: String!
    category: String!
    icon: String!
    actionLink: String!
    isPremium: Boolean!
    unlocked: Boolean!
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
    mood: String
    sleepHours: Float
    hydrationWater: Float
    nutritionCalories: Float
    nutritionMealNotes: String
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
    providerStatus: String
    amountMinor: Int
    currency: String
    totalRefundedMinor: Int
    createdAt: String!
    userId: ID
    user: User
    razorpayOrderId: String
    razorpayPaymentId: String
    purpose: String
  }

  type PaymentRefund {
    id: ID!
    paymentId: ID!
    checkoutIntentId: ID
    razorpayPaymentId: String
    razorpayRefundId: String
    requestedAmountMinor: Int!
    processedAmountMinor: Int!
    currency: String!
    status: String!
    providerStatus: String
    requestedAt: String!
    processedAt: String
    reason: String
    createdAt: String!
  }

  type PaymentReconciliationResult {
    referenceId: ID!
    providerOrderStatus: String
    providerPaymentStatus: String
    localStatus: String
    actions: [String!]!
    message: String!
    success: Boolean!
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
    intakeForm: String
    prescriptions: String
    documents: String
    followUpDate: String
  }

  input SubmitCaseNotesInput {
    bookingId: ID!
    caseNotes: String!
    followUpTasks: [String!]
    prescriptions: String
    followUpDate: String
    documents: String
  }

  type CounselingLead {
    id: ID!
    name: String!
    email: String
    phone: String!
    status: String!
    source: String!
    assignedTo: ID
    convertedUserId: ID
    nextFollowUp: String
    convertedAt: String
    createdAt: String!
    counselor: User
    convertedUser: User
    calls: [CounselingCall!]!
  }

  type CounselingCall {
    id: ID!
    leadId: ID!
    scheduledAt: String!
    status: String!
    durationMinutes: Int
    outcome: String
    notes: String
    counselorId: ID!
    createdAt: String!
    counselor: User
  }

  type CounselingDashboardStats {
    totalLeadsCount: Int!
    newLeadsCount: Int!
    contactedLeadsCount: Int!
    scheduledLeadsCount: Int!
    convertedLeadsCount: Int!
    lostLeadsCount: Int!
    conversionRate: Float!
  }

  type CannedReply {
    id: ID!
    title: String!
    content: String!
    category: String!
  }

  type SatisfactionScoreDist {
    score: Int!
    count: Int!
  }

  type SupportDashboardMetrics {
    totalTicketsCount: Int!
    resolvedTicketsCount: Int!
    pendingTicketsCount: Int!
    slaBreachedCount: Int!
    averageSatisfactionScore: Float
    satisfactionDistribution: [SatisfactionScoreDist!]!
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
    user: User
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
    centerId: ID
    center: Center
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
    totalAmountMinor: Int
    currency: String
    paymentStatus: String
    paymentId: ID
    invoiceId: ID
    storeCheckoutIntentId: ID
    status: String!
    createdAt: String!
    user: User
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

  type StoreCheckoutPayload {
    id: ID!
    razorpayOrderId: String!
    amount: Int!
    currency: String!
    receipt: String!
    status: String!
    expiresAt: String!
  }

  type StoreCheckoutStatus {
    id: ID!
    status: String!
    razorpayOrderId: String
    storeOrderId: ID
    paymentId: ID
    invoiceId: ID
    amount: Int!
    currency: String!
    failureCode: String
    failureMessage: String
    expiresAt: String!
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

  type Invoice {
    id: ID!
    userId: ID!
    subscriptionId: ID
    paymentId: ID
    amount: Float!
    status: String!
    invoiceNumber: String!
    billingDate: String!
    dueDate: String!
    user: User
    subscription: UserSubscription
    payment: Payment
    createdAt: String!
    updatedAt: String!
  }

  type ReportTemplate {
    id: ID!
    title: String!
    description: String
    role: String!
    filters: String
    widgets: String!
    sharedWithRoles: String
    createdAt: String!
    updatedAt: String!
  }

  type ReportData {
    templateId: ID!
    metrics: String!
  }

  type ReportSchedule {
    id: ID!
    templateId: ID!
    frequency: String!
    recipientEmails: String!
    nextRunAt: String!
    isActive: Boolean!
    template: ReportTemplate
    createdAt: String!
  }

  type SystemSetting {
    id: ID!
    key: String!
    value: String!
    description: String
    updatedAt: String!
  }

  type FeatureFlag {
    id: ID!
    name: String!
    description: String
    isEnabled: Boolean!
    rules: String
    updatedAt: String!
  }

  type LocaleString {
    id: ID!
    lang: String!
    key: String!
    value: String!
    updatedAt: String!
  }

  type ServerDiagnostics {
    cpuLoad: Float!
    freeMem: Float!
    totalMem: Float!
    processMemory: Float!
    uptimeSeconds: Int!
    activeDbConnections: Int!
    errorCount: Int!
  }

  type SystemMetric {
    id: ID!
    metricType: String!
    value: Float!
    timestamp: String!
  }

  type SlowQueryRecord {
    id: ID!
    sqlQuery: String!
    durationMs: Float!
    thresholdMs: Float!
    timestamp: String!
  }

  type IndexDiagnosticReport {
    table: String!
    field: String!
    status: String!
    recommendation: String!
  }

  type DatabaseClusterStatus {
    primaryNodeHealthy: Boolean!
    replicaLagMs: Int!
    activeConnections: Int!
    maxPoolSize: Int!
    idleConnections: Int!
  }

  type EnvironmentStatus {
    releaseVersion: String!
    envMode: String!
    nodeVersion: String!
    platform: String!
  }

  type DatabaseBackup {
    id: ID!
    fileName: String!
    backupSize: Float!
    status: String!
    timestamp: String!
  }

  type FinancialReport {
    totalRevenue: Float!
    totalRefunds: Float!
    netRevenue: Float!
    totalCenterShare: Float!
    totalPlatformShare: Float!
    transactionCount: Int!
    reconciledCount: Int!
  }

  type FinancialTransaction {
    id: ID!
    userId: ID
    centerId: ID
    amount: Float!
    type: String!
    status: String!
    centerShare: Float!
    platformShare: Float!
    paymentId: ID
    invoiceId: ID
    reconciledAt: String
    reconciliationNotes: String
    user: User
    center: Center
    payment: Payment
    invoice: Invoice
    createdAt: String!
    updatedAt: String!
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
    latestVitals: VitalsLog
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
  type CloudinarySignature {
    signature: String!
    timestamp: Int!
    apiKey: String!
    cloudName: String!
  }
  type ContentTranslation { id: ID!, language: String!, title: String!, summary: String, body: String }
  type ContentItem {
    id: ID!, slug: String!, contentType: String!, status: String!, visibility: String!, publishAt: String, unpublishAt: String
    category: ContentCategory, coverAsset: MediaAsset, translations: [ContentTranslation!]!, translation: ContentTranslation
    trimester1Safe: Boolean, trimester2Safe: Boolean, trimester3Safe: Boolean, contraindications: String
    medicalReviewed: Boolean, reviewedBy: String, feedback: String, completed: Boolean
  }
  input ContentTranslationInput { language: String!, title: String!, summary: String, body: String }
  input CreateContentItemInput {
    slug: String!, contentType: String!, visibility: String, categoryId: ID, coverAssetId: ID,
    publishAt: String, unpublishAt: String, translations: [ContentTranslationInput!]!
  }
  input UpdateContentItemInput {
    slug: String
    contentType: String
    visibility: String
    categoryId: ID
    coverAssetId: ID
    publishAt: String
    unpublishAt: String
    trimester1Safe: Boolean
    trimester2Safe: Boolean
    trimester3Safe: Boolean
    contraindications: String
    medicalReviewed: Boolean
    status: String
    translations: [ContentTranslationInput!]
  }
  input RegisterMediaAssetInput { url: String!, mimeType: String!, kind: String!, sizeBytes: Int, durationSeconds: Int, altText: String }
  type ContentPerformanceReport {
    id: ID!
    slug: String!
    contentType: String!
    title: String!
    totalViews: Int!
    uniqueViewers: Int!
    completionCount: Int!
    completionRate: Float!
    saveCount: Int!
    avgProgress: Float!
    dropOffRate: Float!
  }
  type LearningPath {
    id: ID!
    title: String!
    description: String!
    icon: String!
    progressPercent: Int!
    items: [ContentItem!]!
  }
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
  
  type NotificationDelivery {
    id: ID!
    notificationId: ID!
    channel: String!
    status: String!
    attempts: Int!
    providerMessageId: String
    lastAttemptAt: String
    errorCode: String
    errorMessage: String
    createdAt: String!
    notification: Notification
  }

  type CampaignPerformanceStats {
    totalTargeted: Int!
    deliveredCount: Int!
    failedCount: Int!
    pendingCount: Int!
    channelBreakdown: [ChannelStatPoint!]!
  }

  type ChannelStatPoint {
    channel: String!
    sent: Int!
    delivered: Int!
    failed: Int!
  }

  type ReminderRule {
    id: ID!
    name: String!
    ruleType: String!
    triggerCondition: String!
    templateTitle: String!
    templateBody: String!
    channels: [String!]!
    enabled: Boolean!
    createdAt: String!
  }

  type ReminderRulesEngineReport {
    success: Boolean!
    rulesProcessed: Int!
    notificationsDispatched: Int!
  }

  type NotificationPreference { id: ID!, pushEnabled: Boolean!, emailEnabled: Boolean!, whatsappEnabled: Boolean!, marketingAllowed: Boolean!, quietStart: String, quietEnd: String, timezone: String! }
  type ReminderSchedule { id: ID!, reminderType: String!, label: String!, localTime: String!, daysOfWeek: [Int!]!, channel: String!, enabled: Boolean! }
  input NotificationPreferenceInput { pushEnabled: Boolean, emailEnabled: Boolean, whatsappEnabled: Boolean, marketingAllowed: Boolean, quietStart: String, quietEnd: String, timezone: String }
  input ReminderScheduleInput { id: ID, reminderType: String, label: String!, localTime: String!, daysOfWeek: [Int!]!, channel: String, enabled: Boolean }
  
  type SpecialEvent {
    id: ID!
    title: String!
    description: String!
    eventType: String!
    eventDate: String!
    durationMinutes: Int!
    speakerName: String
    location: String
    maxRegistrations: Int
    replayUrl: String
    createdAt: String!
  }

  type EventRegistration {
    id: ID!
    eventId: ID!
    userId: ID!
    registeredAt: String!
    checkedIn: Boolean!
    checkedInAt: String
    feedbackRating: Int
    feedbackText: String
    user: CrmUser
    event: SpecialEvent
  }

  type UserReferral {
    id: ID!
    referrerId: ID!
    refereeName: String!
    refereeEmail: String
    refereePhone: String!
    status: String!
    rewardPoints: Int!
    createdAt: String!
    referrer: CrmUser
  }

  type Testimonial {
    id: ID!
    userId: ID!
    content: String!
    rating: Int!
    status: String!
    approvedBy: ID
    createdAt: String!
    user: CrmUser
  }

  type AmbassadorApplication {
    id: ID!
    userId: ID!
    socialLinks: String!
    reason: String!
    status: String!
    createdAt: String!
    user: CrmUser
  }

  type ReminderDispatchReport {
    success: Boolean!
    remindersSent: Int!
    details: [String!]!
  }

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

  type MonthlyReport {
    monthNumber: Int!
    completedDaysCount: Int!
    totalMonthDurationMins: Int!
    weeks: [WeeklyReport!]!
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
    quizQuestionId: ID
    question: QuizQuestion
    dayNumber: Int!
    selectedOptionIndex: Int!
    isCorrect: Boolean!
    attemptedAt: String!
  }

  type WorksheetSubmission {
    id: ID!
    userId: ID!
    userDisplayName: String!
    title: String!
    submittedAt: String!
    fileUrl: String!
    score: Int
    feedback: String
    status: String!
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
    partnerActivityId: ID
    activity: PartnerActivity
    dayNumber: Int!
    partnerAcknowledged: Boolean!
    assignedTaskTitle: String
    assignedTaskDesc: String
    partnerResponse: String
    familyNotes: String
    completedAt: String
  }

  type SensoryActivity {
    id: ID!
    dayNumber: Int!
    senseType: String!
    title: String!
    description: String!
    guidance: String
    mediaLinks: String
  }

  type SensoryActivityLog {
    id: ID!
    userId: ID!
    sensoryActivityId: ID
    activity: SensoryActivity
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
    pqFeedback: String
    iqFeedback: String
    eqFeedback: String
    sqFeedback: String
    notes: String
    completedAt: String
    createdAt: String!
    updatedAt: String!
  }

  type MoodFrequency {
    mood: String!
    count: Int!
  }

  type TrimesterArchiveSummary {
    trimesterNumber: Int!
    totalActivitiesCompleted: Int!
    vitalsLoggedCount: Int!
    averageSleepHours: Float
    averageHydrationWater: Float
    moodFrequencyDistribution: [MoodFrequency!]!
  }

  type JourneyArchive {
    pregnancyDay: Int!
    weekNumber: Int!
    trimesterSummary: [TrimesterArchiveSummary!]!
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

  type FranchiseMetrics {
    centersCount: Int!
    totalMothersCount: Int!
    averageStaffResponsePercent: Float!
    slaAlertsCount: Int!
    centerRankings: [CenterRankingPoint!]!
    centerGrowthStats: [CenterGrowthPoint!]!
  }

  type CenterRankingPoint {
    centerId: ID!
    centerName: String!
    mothersCount: Int!
    activeSubscriptionsCount: Int!
    staffResponsePercent: Float!
    rank: Int!
  }

  type CenterGrowthPoint {
    centerName: String!
    months: [MonthGrowthPoint!]!
  }

  type MonthGrowthPoint {
    monthLabel: String!
    count: Int!
  }

  type StaffInvitation {
    id: ID!
    emailAddress: String!
    roleId: ID!
    role: Role!
    centerId: ID!
    center: Center!
    token: String!
    status: String!
    expiresAt: String!
    createdBy: ID!
    creator: User!
    createdAt: String!
  }

  type InventoryMovement {
    id: ID!
    productId: ID!
    product: Product!
    centerId: ID
    center: Center
    reasonCode: String!
    reasonNote: String
    quantityBefore: Int!
    quantityChange: Int!
    quantityAfter: Int!
    referenceType: String
    referenceId: String
    performedBy: ID!
    performer: User!
    requestCorrelationId: String
    createdAt: String!
  }

  type PaymentCheckoutIntent {
    id: ID!
    userId: ID!
    user: User
    subscriptionPlanId: ID!
    plan: SubscriptionPlan
    couponId: ID
    razorpayOrderId: String
    razorpayPaymentId: String
    expectedAmountMinor: Int!
    currency: String!
    purpose: String!
    status: String!
    receipt: String!
    expiresAt: String!
    verifiedAt: String
    processedAt: String
    providerConfirmedAt: String
    providerStatus: String
    totalRefundedMinor: Int!
    paymentId: ID
    invoiceId: ID
    failureReason: String
    createdAt: String!
  }

  type PaymentProviderEvent {
    id: ID!
    provider: String!
    providerEventId: String!
    eventType: String!
    razorpayOrderId: String
    razorpayPaymentId: String
    razorpayRefundId: String
    checkoutIntentId: ID
    storeCheckoutIntentId: ID
    processingStatus: String!
    processingAttempts: Int!
    firstReceivedAt: String!
    lastReceivedAt: String!
    processingStartedAt: String
    processedAt: String
    nextRetryAt: String
    lastErrorCode: String
    lastErrorMessage: String
    correlationId: String
    createdAt: String!
  }

  type UserConnection {
    items: [User!]!
    total: Int!
  }

  type PaymentConnection {
    items: [Payment!]!
    total: Int!
  }

  type CheckoutIntentConnection {
    items: [PaymentCheckoutIntent!]!
    total: Int!
  }

  type ProviderEventConnection {
    items: [PaymentProviderEvent!]!
    total: Int!
  }

  type RefundConnection {
    items: [PaymentRefund!]!
    total: Int!
  }

  type StaffInvitationConnection {
    items: [StaffInvitation!]!
    total: Int!
  }

  type InventoryMovementConnection {
    items: [InventoryMovement!]!
    total: Int!
  }

  type SuperAdminMetrics {
    totalUsersCount: Int!
    totalCentersCount: Int!
    systemStatus: String!
    activeAlertsCount: Int!
    recentAuditLogs: [AdminAuditLog!]!
    approvalsQueueCount: Int!
  }

  type Query {
    adminGetUsers(page: Int, pageSize: Int, search: String, status: String, role: String, centerId: ID, sortField: String, sortDirection: String): UserConnection!
    adminGetPayments(page: Int, pageSize: Int, search: String, status: String, centerId: ID): PaymentConnection!
    adminGetCheckoutIntents(page: Int, pageSize: Int, search: String, status: String, centerId: ID): CheckoutIntentConnection!
    adminGetProviderEvents(page: Int, pageSize: Int, search: String, processingStatus: String): ProviderEventConnection!
    adminGetRefunds(page: Int, pageSize: Int, status: String): RefundConnection!
    adminGetStaffInvitations(page: Int, pageSize: Int, search: String, status: String, centerId: ID): StaffInvitationConnection!
    adminGetInventoryMovements(page: Int, pageSize: Int, productId: ID, centerId: ID, reasonCode: String): InventoryMovementConnection!
    getRoles: [Role!]!
    getCenters: [Center!]!
    getCenterKpis: CenterKpis!
    getFranchiseMetrics: FranchiseMetrics!
    getSuperAdminMetrics: SuperAdminMetrics!
    me: User
    getUser(id: ID!): User
    getUsers(isActive: Boolean): [User!]!
    getDailyContent(dayNumber: Int!): DailyContent
    getContentLibrary(category: String!): [DailyContent!]!
    getBabyDevelopment(weekNumber: Int!): BabyDevelopment
    getForumPosts(category: String, groupId: ID): [ForumPost!]!
    getForumGroups: [ForumGroup!]!
    getModerationQueue: ModerationQueue!
    getLiveClasses: [LiveClass!]!
    getGuidedAudioSessions: [DailyContent!]!
    getMyDevices: [RegisteredDevice!]!
    getParameterConfig(key: String!): String
    getMyVitals: [VitalsLog!]!
    myRecommendations: [Recommendation!]!
    getCloudinarySignature(folder: String!): CloudinarySignature!
    getExpertSchedules: [ExpertSchedule!]!
    getExpertBookings(expertId: ID!): [ConsultationBooking!]!
    getMyConsultations: [ConsultationBooking!]!
    getMyBillingHistory: [Payment!]!
    getInquiries(status: String, search: String, limit: Int, offset: Int): InquiryConnection!
    programCatalog: [Program!]!
    myProgramEnrollments: [ProgramEnrollment!]!
    contentFeed(language: String, categorySlug: String, contentType: String, limit: Int, offset: Int): [ContentItem!]!
    recommendedContentFeed(language: String, limit: Int): [ContentItem!]!
    myLearningPaths(language: String): [LearningPath!]!
    manageContent(status: String, search: String, limit: Int, offset: Int): [ContentItem!]!
    searchContent(query: String!, language: String, categorySlug: String, contentType: String, limit: Int, offset: Int): [ContentItem!]!
    recentContentSearches: [RecentSearch!]!
    savedContent(kind: String, language: String): [ContentItem!]!
    myNotifications(status: String, limit: Int, offset: Int): NotificationInbox!
    myNotificationPreferences: NotificationPreference!
    myReminderSchedules: [ReminderSchedule!]!
    myTimelineOverview(dayNumber: Int): TimelineOverview!
    myDailyProgress(dayNumber: Int!, userId: ID): DailyProgress
    myDailyProgressRange(startDay: Int!, endDay: Int!): [DailyProgress!]!
    myStreak: UserStreak
    myPartnerStreak: UserStreak
    myAchievements: [UserAchievement!]!
    myWeeklyReport(weekNumber: Int!): WeeklyReport!
    myMonthlyReport(monthNumber: Int!): MonthlyReport!
    myJourneyArchive: JourneyArchive!
    getDailyQuiz(dayNumber: Int!): QuizQuestion
    getMyQuizAttempt(dayNumber: Int!): QuizAttempt
    getWorksheetSubmissions: [WorksheetSubmission!]!
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
    getStaffSupportTickets(status: String): [SupportTicket!]!
    getCannedReplies: [CannedReply!]!
    getSupportDashboardMetrics: SupportDashboardMetrics!
    getCounselingLeads(status: String, assignedToMe: Boolean): [CounselingLead!]!
    getCounselingLeadDetails(id: ID!): CounselingLead!
    getCounselingDashboardStats: CounselingDashboardStats!
    getProducts(centerId: ID): [Product!]!
    getCart: [CartItem!]!
    getAddresses: [UserAddress!]!
    getMyOrders: [StoreOrder!]!
    getAdminOrders: [StoreOrder!]!
    getStoreCheckoutStatus(checkoutId: ID!): StoreCheckoutStatus!
    getPlans: [SubscriptionPlan!]!
    getMySubscription: UserSubscription
    validateCoupon(code: String!): Coupon
    getAdminInvoices: [Invoice!]!
    getMyInvoices: [Invoice!]!
    checkUserEntitlement(featureKey: String!): Boolean!
    getCoupons: [Coupon!]!
    getFinancialReport(startDate: String, endDate: String, centerId: ID): FinancialReport!
    getFinancialTransactions(centerId: ID, type: String): [FinancialTransaction!]!
    getReportTemplates(role: String): [ReportTemplate!]!
    getReportData(templateId: ID!, filters: String): ReportData!
    getReportSchedules: [ReportSchedule!]!
    getSystemSettings: [SystemSetting!]!
    getFeatureFlags: [FeatureFlag!]!
    getLocaleStrings(lang: String!): [LocaleString!]!
    checkFeatureFlag(name: String!): Boolean!
    getServerDiagnostics: ServerDiagnostics!
    getSystemMetricsHistory(metricType: String!): [SystemMetric!]!
    exportSystemLogs(limit: Int): String!
    getSlowQueriesReport(thresholdMs: Float): [SlowQueryRecord!]!
    runDatabaseIndexDiagnostic: [IndexDiagnosticReport!]!
    getDatabaseClusterStatus: DatabaseClusterStatus!
    getEnvironmentStatus: EnvironmentStatus!
    getBackupHistory: [DatabaseBackup!]!
    getCrmUsers: [CrmUser!]!
    getCrmNotes(userId: ID!): [CrmNote!]!
    getAuditLogs: [AdminAuditLog!]!
    getPartnerDashboard: PartnerDashboardData
    getLiveClassBookings(classId: ID!): [LiveClassBooking!]!
    getStaffTasks: [StaffTask!]!
    getContentPerformanceAnalytics: [ContentPerformanceReport!]!
    getNotificationDeliveriesReport(limit: Int): [NotificationDelivery!]!
    getCampaignPerformance(notificationId: ID!): CampaignPerformanceStats!
    getReminderRules: [ReminderRule!]!
    getSpecialEvents(eventType: String): [SpecialEvent!]!
    getEventAttendees(eventId: ID!): [EventRegistration!]!
    getMyReferrals: [UserReferral!]!
    getReferralsReport: [UserReferral!]!
    getTestimonials(statusFilter: String): [Testimonial!]!
    getAmbassadorApplications: [AmbassadorApplication!]!
  }

  type Mutation {
    syncUser: User!
    updateUser(id: ID!, firstName: String, lastName: String, displayName: String, mobileNo: String): User!
    saveOnboarding(lmpDate: String, dueDate: String, language: String!): User!
    clearSlowQueryLogs: Boolean!
    updateConnectionPoolConfig(maxConnections: Int!, idleTimeoutMs: Int!): Boolean!
    triggerFailoverSimulation: Boolean!
    triggerBackupDrill: DatabaseBackup!
    triggerRestoreDrill(backupId: ID!): Boolean!
    addForumPost(title: String!, content: String!, category: String, groupId: ID): ForumPost!
    addForumComment(postId: ID!, content: String!): ForumComment!
    togglePostLike(postId: ID!): ForumPost!
    reportPost(postId: ID!, reason: String): ForumPost!
    reportComment(commentId: ID!, reason: String): ForumComment!
    createForumGroup(name: String!, description: String, coverUrl: String, isPrivate: Boolean!): ForumGroup!
    reactToPost(postId: ID!, reactionType: String!): ForumPost!
    moderatePost(postId: ID!, action: String!): Boolean!
    moderateComment(commentId: ID!, action: String!): Boolean!
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
    dispatchDailyReminders: ReminderDispatchReport!
    savePostpartumPlan(planJson: String!): User!
    deleteMyAccount: Boolean!
    saveEmergencyContacts(contactsJson: String!): User!
    submitInquiry(input: SubmitInquiryInput!): Inquiry!
    updateInquiryStatus(id: ID!, status: String!): Inquiry!
    replyToInquiry(id: ID!, content: String!): Inquiry!
    enrollInProgram(programId: ID!): ProgramEnrollment!
    updateActivityProgress(activityId: ID!, input: ActivityProgressInput!): ActivityProgress!
    createContentItem(input: CreateContentItemInput!): ContentItem!
    publishContentItem(id: ID!): ContentItem!
    reviewContentItem(id: ID!, reviewed: Boolean!): ContentItem!
    submitForReview(id: ID!): ContentItem!
    approveMedicalContent(id: ID!, feedback: String): ContentItem!
    flagMedicalContent(id: ID!, feedback: String): ContentItem!
    updateContentItem(id: ID!, input: UpdateContentItemInput!): ContentItem!
    deleteContentItem(id: ID!): Boolean!
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
    gradeWorksheetSubmission(id: ID!, score: Int!, feedback: String!): WorksheetSubmission!
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
    submitIntakeForm(bookingId: ID!, symptoms: [String!]!, gestationalWeeks: Int!, concerns: String!, medicalHistory: String): ConsultationBooking!
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
    createCannedReply(title: String!, content: String!, category: String!): CannedReply!
    addStaffSupportMessage(ticketId: ID!, message: String!): SupportTicketMessage!
    updateSupportTicketStatus(ticketId: ID!, status: String!): SupportTicket!
    checkSlaEscalations: Boolean!
    createCounselingLead(name: String!, email: String, phone: String!, source: String): CounselingLead!
    updateCounselingLeadStatus(id: ID!, status: String!): CounselingLead!
    assignCounselingLead(id: ID!, counselorId: ID!): CounselingLead!
    scheduleCounselingCall(leadId: ID!, scheduledAt: String!): CounselingCall!
    logCounselingCallOutcome(callId: ID!, status: String!, durationMinutes: Int, outcome: String, notes: String): CounselingCall!
    convertLeadToMember(leadId: ID!, centerId: ID!): User!
    addToCart(input: CartItemInput!): CartItem!
    updateCartQuantity(input: CartItemInput!): CartItem!
    removeFromCart(productId: ID!): Boolean!
    addAddress(input: AddAddressInput!): UserAddress!
    deleteAddress(id: ID!): Boolean!
    placeOrder(addressId: ID!): StoreOrder!
    createStoreCheckout(addressId: ID!, couponCode: String): StoreCheckoutPayload!
    verifyStorePayment(razorpayOrderId: String!, razorpayPaymentId: String!, razorpaySignature: String!): StoreOrder!
    updateOrderTracking(orderId: ID!, carrier: String!, trackingNumber: String!, estimatedDeliveryDate: String): StoreOrder!
    updateOrderStatus(orderId: ID!, status: String!): StoreOrder!
    requestOrderReturn(orderId: ID!, reason: String!): StoreOrderReturn!
    reviewOrderReturn(orderReturnId: ID!, status: String!, adminNotes: String): StoreOrderReturn!
    startTrial(planId: ID!): UserSubscription!
    subscribeToPlan(planId: ID!, couponCode: String): UserSubscription!
    cancelSubscription: UserSubscription!
    createRazorpayOrder(planId: ID!, couponCode: String): RazorpayOrder!
    verifyRazorpayPayment(planId: ID, razorpayOrderId: String!, razorpayPaymentId: String!, razorpaySignature: String!): UserSubscription!
    addCrmNote(userId: ID!, note: String!): CrmNote!
    logAdminAction(action: String!, targetType: String, targetId: String, payload: String): AdminAuditLog!
    recordClassAttendance(classId: ID!, userId: ID!, attended: Boolean!): LiveClassBooking!
    createLiveClass(titleEn: String!, titleHi: String!, instructor: String!, startTime: String!, durationMins: Int!, videoCallUrl: String!, seriesTitle: String, batchName: String, centerId: ID): LiveClass!
    updateLiveClass(id: ID!, titleEn: String, titleHi: String, instructor: String, startTime: String, durationMins: Int, videoCallUrl: String, seriesTitle: String, batchName: String, replayUrl: String): LiveClass!
    deleteLiveClass(id: ID!): Boolean!
    sendLiveClassReminder(classId: ID!): Boolean!
    createStaffTask(userId: ID, title: String!, description: String, dueDate: String): StaffTask!
    toggleStaffTask(id: ID!): StaffTask!
    updateStaffTaskStatus(id: ID!, status: String!): StaffTask!
    deleteStaffTask(id: ID!): Boolean!
    createExpertSchedule(dayOfWeek: Int!, startTime: String!, endTime: String!, slotDurationMins: Int!): ExpertSchedule!
    deleteExpertSchedule(id: ID!): Boolean!
    updateConsultationStatus(bookingId: ID!, status: String!): ConsultationBooking!
    updateRolePermissions(roleId: ID!, permissions: String!): Role!
    approveCenter(centerId: ID!, approved: Boolean!): Center!
    submitCoachingFeedback(progressId: ID!, quotient: String!, feedback: String!): DailyProgress!
    assignPartnerTask(dayNumber: Int!, title: String!, description: String): PartnerActivityLog!
    submitPartnerResponse(dayNumber: Int!, response: String!, familyNotes: String): PartnerActivityLog!
    createNotificationCampaign(title: String!, body: String!, channels: [String!]!, targetUserIds: [ID!], centerId: ID, scheduledAt: String): [Notification!]!
    triggerCampaignDispatched(notificationId: ID!): Boolean!
    createReminderRule(name: String!, ruleType: String!, triggerConditionJson: String!, templateTitle: String!, templateBody: String!, channels: [String!]!, enabled: Boolean): ReminderRule!
    updateReminderRule(id: ID!, name: String, ruleType: String, triggerConditionJson: String, templateTitle: String, templateBody: String, channels: [String!], enabled: Boolean): ReminderRule!
    deleteReminderRule(id: ID!): Boolean!
    runReminderRulesEngine: ReminderRulesEngineReport!
    createSpecialEvent(title: String!, description: String!, eventType: String!, eventDate: String!, durationMinutes: Int!, speakerName: String, location: String, maxRegistrations: Int): SpecialEvent!
    updateSpecialEvent(id: ID!, title: String, description: String, eventType: String, eventDate: String, durationMinutes: Int, speakerName: String, location: String, maxRegistrations: Int, replayUrl: String): SpecialEvent!
    deleteSpecialEvent(id: ID!): Boolean!
    registerForEvent(eventId: ID!): EventRegistration!
    checkInToEvent(registrationId: ID!): EventRegistration!
    submitEventFeedback(eventId: ID!, rating: Int!, feedbackText: String): EventRegistration!
    submitReferral(refereeName: String!, refereeEmail: String, refereePhone: String!): UserReferral!
    convertReferral(referralId: ID!, pointsAwarded: Int): UserReferral!
    submitTestimonial(content: String!, rating: Int!): Testimonial!
    moderateTestimonial(id: ID!, status: String!): Testimonial!
    applyForAmbassador(socialLinksJson: String!, reason: String!): AmbassadorApplication!
    moderateAmbassadorApplication(id: ID!, status: String!): AmbassadorApplication!
    createProduct(title: String!, description: String, price: Float!, imageUrl: String, inventoryCount: Int!, category: String!, centerId: ID): Product!
    updateProduct(id: ID!, title: String, description: String, price: Float, imageUrl: String, inventoryCount: Int, category: String, centerId: ID): Product!
    deleteProduct(id: ID!): Boolean!
    createSubscriptionPlan(name: String!, description: String, price: Float!, billingPeriod: String!, trialDays: Int!, features: [String!]!): SubscriptionPlan!
    updateSubscriptionPlan(id: ID!, name: String, description: String, price: Float, billingPeriod: String, trialDays: Int, features: [String!]): SubscriptionPlan!
    deleteSubscriptionPlan(id: ID!): Boolean!
    createCoupon(code: String!, discountPercent: Int, discountAmount: Float, validFrom: String!, validUntil: String!, maxRedemptions: Int): Coupon!
    deleteCoupon(id: ID!): Boolean!
    simulateRenewals: [UserSubscription!]!
    reconcileTransaction(transactionId: ID!, notes: String): FinancialTransaction!
    reconcilePaymentCheckout(checkoutIntentId: ID!): PaymentReconciliationResult!
    reconcileStoreCheckout(checkoutIntentId: ID!): PaymentReconciliationResult!
    reconcilePaymentRefund(refundId: ID!): PaymentReconciliationResult!
    refundTransaction(paymentId: ID!, refundAmount: Float!, reason: String!): FinancialTransaction!
    createReportTemplate(title: String!, description: String, role: String!, filters: String, widgets: String!): ReportTemplate!
    deleteReportTemplate(id: ID!): Boolean!
    shareReportTemplate(templateId: ID!, roles: String!): ReportTemplate!
    createReportSchedule(templateId: ID!, frequency: String!, recipientEmails: String!): ReportSchedule!
    deleteReportSchedule(id: ID!): Boolean!
    processScheduledReports: String!
    updateSystemSetting(key: String!, value: String!): SystemSetting!
    updateFeatureFlag(name: String!, isEnabled: Boolean!, rules: String): FeatureFlag!
    upsertLocaleString(lang: String!, key: String!, value: String!): LocaleString!
    createStaff(emailAddress: String!, displayName: String!, roleId: ID!, centerId: ID!): StaffInvitation!
    resendStaffInvitation(invitationId: ID!): StaffInvitation!
    linkFirebaseStaffAccount(token: String!, firebaseIdToken: String!): User!
    updateUserStatus(id: ID!, isActive: Boolean!): User!
    updateUserRole(id: ID!, roleId: ID!): User!
    updateUserCenter(id: ID!, centerId: ID!): User!
    adminCreateRefund(paymentId: ID!, amountMinor: Int!, reason: String!, idempotencyKey: String!): PaymentRefund!
    adjustInventory(productId: ID!, centerId: ID, reasonCode: String!, reasonNote: String!, quantityChange: Int!, referenceType: String, referenceId: String, idempotencyKey: String!): InventoryMovement!
  }
`;
