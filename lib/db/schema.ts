import {
  pgTable,
  uuid,
  text,
  varchar,
  timestamp,
  integer,
  boolean,
  jsonb,
  decimal,
  pgEnum,
  primaryKey,
  uniqueIndex,
} from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm"

// Enums
export const roleEnum = pgEnum("role", ["student", "instructor", "admin"])
export const difficultyEnum = pgEnum("difficulty", ["beginner", "intermediate", "advanced"])
export const lessonTypeEnum = pgEnum("lesson_type", ["video", "article", "quiz", "assignment", "resource"])
export const videoProviderEnum = pgEnum("video_provider", ["upload", "youtube", "vimeo", "mux"])
export const orderStatusEnum = pgEnum("order_status", ["pending", "paid", "shipped", "delivered", "cancelled"])
export const certificateStatusEnum = pgEnum("certificate_status", ["pending", "issued", "revoked"])
export const contestStatusEnum = pgEnum("contest_status", ["upcoming", "active", "completed"])
export const challengeTypeEnum = pgEnum("challenge_type", ["quiz", "coding", "project"])
export const cohortStatusEnum = pgEnum("cohort_status", ["draft", "open", "running", "ended"])
export const cohortMemberRoleEnum = pgEnum("cohort_member_role", ["student", "mentor", "instructor"])
export const cohortMemberStatusEnum = pgEnum("cohort_member_status", ["active", "waitlist", "removed"])
export const scheduleTypeEnum = pgEnum("schedule_type", ["live", "deadline", "exam", "workshop"])
export const bookingStatusEnum = pgEnum("booking_status", ["requested", "confirmed", "completed", "cancelled"])
export const conversationTypeEnum = pgEnum("conversation_type", ["individual", "group", "community"])
export const consultationSlotStatusEnum = pgEnum("consultation_slot_status", ["available", "booked", "cancelled"])
export const consultationBookingStatusEnum = pgEnum("consultation_booking_status", ["requested", "confirmed", "completed", "cancelled"])
export const supportTicketStatusEnum = pgEnum("support_ticket_status", ["open", "in_progress", "waiting_customer", "resolved", "closed"])
export const supportTicketCategoryEnum = pgEnum("support_ticket_category", ["technical", "billing", "course_content", "account", "other"])

// Site Settings (single-row key/value)
export const siteSettings = pgTable("site_settings", {
  id: varchar("id", { length: 64 }).primaryKey().default("global"),
  siteName: varchar("site_name", { length: 255 }).notNull().default("Neon Educational Platform"),
  supportEmail: varchar("support_email", { length: 255 }).notNull().default("support@neon.edu"),
  maintenanceMode: boolean("maintenance_mode").notNull().default(false),
  allowRegistration: boolean("allow_registration").notNull().default(true),
  currency: varchar("currency", { length: 16 }).notNull().default("SAR"),
  email: jsonb("email").$type<{ smtpHost?: string; smtpPort?: number; smtpUser?: string; smtpPassword?: string; notifications?: boolean }>().default({}),
  features: jsonb("features").$type<{ showStore?: boolean; showMentors?: boolean; enableLive?: boolean }>().default({}),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
})

// Users table
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  role: roleEnum("role").notNull().default("student"),
  avatarUrl: text("avatar_url"),
  coverUrl: text("cover_url"),
  bio: text("bio"),
  headline: varchar("headline", { length: 255 }), // Instructor title
  websiteUrl: text("website_url"),
  twitterUrl: text("twitter_url"),
  linkedinUrl: text("linkedin_url"),
  phoneNumber: varchar("phone_number", { length: 32 }),
  streamConsumerId: uuid("stream_consumer_id"),
  // Legacy/External columns (kept to avoid data loss during push)
  phone: varchar("phone", { length: 256 }),
  preferences: jsonb("preferences"),
  points: integer("points").notNull().default(0),
  level: integer("level").notNull().default(1),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
})

export const docsPages = pgTable(
  "docs_pages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: varchar("slug", { length: 255 }).notNull(),
    lang: varchar("lang", { length: 10 }).notNull().default("ar"),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    contentMd: text("content_md").notNull().default(""),
    isPublic: boolean("is_public").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    updatedByUserId: uuid("updated_by_user_id").references(() => users.id),
  },
  (t) => ({
    slugLangUnique: uniqueIndex("docs_pages_slug_lang_unique").on(t.slug, t.lang),
  }),
)

// Sessions table for authentication
export const sessions = pgTable("sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

// Categories table
export const categories = pgTable("categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  nameEn: varchar("name_en", { length: 255 }).notNull(),
  nameAr: varchar("name_ar", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  descriptionEn: text("description_en"),
  descriptionAr: text("description_ar"),
  iconUrl: text("icon_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

// Courses table
export const courses = pgTable("courses", {
  id: uuid("id").defaultRandom().primaryKey(),
  titleEn: varchar("title_en", { length: 255 }).notNull(),
  titleAr: varchar("title_ar", { length: 255 }).notNull(),
  subtitleEn: varchar("subtitle_en", { length: 255 }),
  subtitleAr: varchar("subtitle_ar", { length: 255 }),
  descriptionEn: text("description_en").notNull(),
  descriptionAr: text("description_ar").notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  thumbnailUrl: text("thumbnail_url"),
  previewVideoUrl: text("preview_video_url"),
  instructorId: uuid("instructor_id")
    .notNull()
    .references(() => users.id),
  categoryId: uuid("category_id").references(() => categories.id),
  difficulty: difficultyEnum("difficulty").notNull().default("beginner"),
  language: varchar("language", { length: 10 }).default("ar"), // Primary language of the course
  duration: integer("duration"), // in minutes
  price: decimal("price", { precision: 10, scale: 2 }).notNull().default("0"),
  streamProductId: uuid("stream_product_id"),
  isFree: boolean("is_free").notNull().default(true),
  isLive: boolean("is_live").notNull().default(false),
  isStreaming: boolean("is_streaming").notNull().default(false), // Indicates if the live stream is currently active
  isPublished: boolean("is_published").notNull().default(false),

  // --- Admin Moderation / Approval Workflow ---
  // Courses created by instructors start with isApproved = false (pending review).
  // They are not publicly visible nor enrollable until an admin approves them.
  isApproved: boolean("is_approved").notNull().default(false),
  approvedAt: timestamp("approved_at"),
  approvedBy: uuid("approved_by").references(() => users.id),
  approvalNote: text("approval_note"), // Optional admin note (rejection reason or comment)

  // --- Soft Deletion via Admin Approval ---
  // Instructors cannot delete courses directly. They can *request* deletion;
  // an admin must review and approve the deletion for the row to actually be removed (or soft-deleted).
  deletionRequested: boolean("deletion_requested").notNull().default(false),
  deletionRequestedAt: timestamp("deletion_requested_at"),
  deletionRequestedReason: text("deletion_requested_reason"),
  deletionReviewedBy: uuid("deletion_reviewed_by").references(() => users.id),
  deletionReviewedAt: timestamp("deletion_reviewed_at"),
  deletionRejectedReason: text("deletion_rejected_reason"),

  tags: jsonb("tags").$type<string[]>().default([]),
  requirements: jsonb("requirements").$type<string[]>().default([]),
  learningOutcomes: jsonb("learning_outcomes").$type<string[]>().default([]),
  enrollmentCount: integer("enrollment_count").notNull().default(0),
  rating: decimal("rating", { precision: 3, scale: 2 }).default("0"),
  reviewsCount: integer("reviews_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
})

// Modules table
export const modules = pgTable("modules", {
  id: uuid("id").defaultRandom().primaryKey(),
  courseId: uuid("course_id")
    .notNull()
    .references(() => courses.id, { onDelete: "cascade" }),
  titleEn: varchar("title_en", { length: 255 }).notNull(),
  titleAr: varchar("title_ar", { length: 255 }).notNull(),
  orderIndex: integer("order_index").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

// Lessons table
export const lessons = pgTable("lessons", {
  id: uuid("id").defaultRandom().primaryKey(),
  moduleId: uuid("module_id")
    .references(() => modules.id, { onDelete: "cascade" }),
  courseId: uuid("course_id")
    .references(() => courses.id, { onDelete: "cascade" }), // Kept for flexibility/legacy, but module_id is preferred
  titleEn: varchar("title_en", { length: 255 }).notNull(),
  titleAr: varchar("title_ar", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull(),
  descriptionEn: text("description_en"),
  descriptionAr: text("description_ar"),
  type: lessonTypeEnum("type").notNull().default("video"),
  
  // Content fields
  contentEn: text("content_en"), // Rich text for articles
  contentAr: text("content_ar"),
  
  // Video specific
  videoUrl: text("video_url"),
  thumbnailUrl: text("thumbnail_url"),
  videoProvider: videoProviderEnum("video_provider").default("upload"),
  durationMinutes: integer("duration_minutes"),
  
  // Quiz specific
  quizConfig: jsonb("quiz_config"), // Questions, passing score, etc.
  
  // Assignment specific
  assignmentConfig: jsonb("assignment_config"), // Instructions, allowed file types
  
  // Resources
  attachments: jsonb("attachments").$type<Array<{ name: string; url: string; size?: string }>>().default([]),
  
  orderIndex: integer("order_index").notNull(),
  status: varchar("status", { length: 50 }).notNull().default("draft"),
  isPreview: boolean("is_preview").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
})

// Enrollments table
export const enrollments = pgTable("enrollments", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  courseId: uuid("course_id")
    .notNull()
    .references(() => courses.id, { onDelete: "cascade" }),
  status: varchar("status", { length: 50 }).notNull().default("active"),
  completedLessons: jsonb("completed_lessons").$type<string[]>().default([]), // JSON array of lesson IDs
  progress: integer("progress").notNull().default(0),
  lastAccessedAt: timestamp("last_accessed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
})

// Detailed Progress Tracking
export const progress = pgTable("progress", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  lessonId: uuid("lesson_id")
    .notNull()
    .references(() => lessons.id, { onDelete: "cascade" }),
  isCompleted: boolean("is_completed").default(false),
  progressPercentage: integer("progress_percentage").default(0), // For video watch time %
  lastTime: integer("last_time").default(0), // Last timestamp in seconds (for video)
  lastAccessed: timestamp("last_accessed").defaultNow(),
})

// Reviews table
export const reviews = pgTable("reviews", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  courseId: uuid("course_id")
    .notNull()
    .references(() => courses.id, { onDelete: "cascade" }),
  rating: integer("rating").notNull(), // 1-5 (Course Rating)
  instructorRating: integer("instructor_rating").default(0), // 1-5 (Instructor Rating)
  comment: text("comment"),
  isPublished: boolean("is_published").default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
})

// Bookmarks table
export const bookmarks = pgTable("bookmarks", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  courseId: uuid("course_id")
    .notNull()
    .references(() => courses.id, { onDelete: "cascade" }),
  lessonId: uuid("lesson_id").references(() => lessons.id, { onDelete: "cascade" }), // Optional, can bookmark course or lesson
  note: text("note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

// Notes table (Student personal notes)
export const notes = pgTable("notes", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  lessonId: uuid("lesson_id")
    .notNull()
    .references(() => lessons.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  timestamp: integer("timestamp"), // Video timestamp reference
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
})

// Carts table
export const carts = pgTable("carts", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
})

export const cartItems = pgTable("cart_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  cartId: uuid("cart_id").notNull().references(() => carts.id, { onDelete: "cascade" }),
  courseId: uuid("course_id").references(() => courses.id),
  productId: uuid("product_id").references(() => products.id),
  quantity: integer("quantity").notNull().default(1),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

// Products/Store Items table
export const products = pgTable("products", {
  id: uuid("id").defaultRandom().primaryKey(),
  nameEn: varchar("name_en", { length: 255 }).notNull(),
  nameAr: varchar("name_ar", { length: 255 }).notNull(),
  descriptionEn: text("description_en"),
  descriptionAr: text("description_ar"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  pointsCost: integer("points_cost"),
  streamProductId: uuid("stream_product_id"),
  imageUrl: text("image_url"),
  stockQuantity: integer("stock_quantity").notNull().default(0),
  categoryId: uuid("category_id").references(() => categories.id),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
})

// Orders table
export const orders = pgTable("orders", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  status: orderStatusEnum("status").notNull().default("pending"),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  originalAmount: decimal("original_amount", { precision: 10, scale: 2 }),
  discountAmount: decimal("discount_amount", { precision: 10, scale: 2 }),
  couponIds: jsonb("coupon_ids"),
  paymentIntentId: varchar("payment_intent_id", { length: 255 }),
  paymentProvider: varchar("payment_provider", { length: 64 }),
  paymentLinkId: varchar("payment_link_id", { length: 255 }),
  paymentLinkUrl: text("payment_link_url"),
  invoiceId: varchar("invoice_id", { length: 255 }),
  paymentId: varchar("payment_id", { length: 255 }),
  branchId: varchar("branch_id", { length: 255 }),
  gatewayStatus: varchar("gateway_status", { length: 64 }),
  gatewayPayload: jsonb("gateway_payload"),
  paidAt: timestamp("paid_at"),
  lastWebhookAt: timestamp("last_webhook_at"),
  shippingAddress: text("shipping_address"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
})

// Order Items table
export const orderItems = pgTable("order_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  productId: uuid("product_id").references(() => products.id),
  courseId: uuid("course_id").references(() => courses.id),
  quantity: integer("quantity").notNull().default(1),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
})

// Certificates table
export const certificates = pgTable("certificates", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  courseId: uuid("course_id").references(() => courses.id),
  certificateNumber: varchar("certificate_number", { length: 255 }).notNull().unique(),
  titleEn: varchar("title_en", { length: 255 }).notNull(),
  titleAr: varchar("title_ar", { length: 255 }).notNull(),
  status: certificateStatusEnum("status").notNull().default("issued"),
  imageUrl: text("image_url"),
  verificationCode: varchar("verification_code", { length: 255 }).unique(),
  issuedAt: timestamp("issued_at").notNull().defaultNow(),
})

// Challenges table (Existing)
export const challenges = pgTable("challenges", {
  id: uuid("id").defaultRandom().primaryKey(),
  titleEn: varchar("title_en", { length: 255 }).notNull(),
  titleAr: varchar("title_ar", { length: 255 }).notNull(),
  descriptionEn: text("description_en").notNull(),
  descriptionAr: text("description_ar").notNull(),
  type: challengeTypeEnum("type").notNull(),
  difficulty: difficultyEnum("difficulty").notNull(),
  points: integer("points").notNull(),
  timeLimit: integer("time_limit"),
  testCases: jsonb("test_cases"),
  solution: text("solution"),
  categoryId: uuid("category_id").references(() => categories.id),
  instructorId: uuid("instructor_id").references(() => users.id),
  courseId: uuid("course_id").references(() => courses.id),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

export const challengeSubmissions = pgTable("challenge_submissions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  challengeId: uuid("challenge_id")
    .notNull()
    .references(() => challenges.id, { onDelete: "cascade" }),
  code: text("code"),
  result: jsonb("result"),
  score: integer("score"),
  isPassed: boolean("is_passed").notNull().default(false),
  submittedAt: timestamp("submitted_at").notNull().defaultNow(),
})

// Contests table (Existing)
export const contests = pgTable("contests", {
  id: uuid("id").defaultRandom().primaryKey(),
  titleEn: varchar("title_en", { length: 255 }).notNull(),
  titleAr: varchar("title_ar", { length: 255 }).notNull(),
  descriptionEn: text("description_en").notNull(),
  descriptionAr: text("description_ar").notNull(),
  imageUrl: text("image_url"),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  status: contestStatusEnum("status").notNull().default("upcoming"),
  prizePool: text("prize_pool"),
  maxParticipants: integer("max_participants"),
  participantCount: integer("participant_count").notNull().default(0),
  rules: jsonb("rules"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

export const contestParticipants = pgTable("contest_participants", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  contestId: uuid("contest_id")
    .notNull()
    .references(() => contests.id, { onDelete: "cascade" }),
  score: integer("score").notNull().default(0),
  rank: integer("rank"),
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
})

// Cohorts System Tables
export const cohorts = pgTable("cohorts", {
  id: uuid("id").defaultRandom().primaryKey(),
  titleEn: varchar("title_en", { length: 255 }).notNull(),
  titleAr: varchar("title_ar", { length: 255 }).notNull(),
  descriptionEn: text("description_en"),
  descriptionAr: text("description_ar"),
  thumbnailUrl: text("thumbnail_url"),
  startsAt: timestamp("starts_at").notNull(),
  endsAt: timestamp("ends_at").notNull(),
  capacity: integer("capacity").notNull().default(30),
  status: cohortStatusEnum("status").notNull().default("draft"),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
})

export const cohortCourses = pgTable("cohort_courses", {
  id: uuid("id").defaultRandom().primaryKey(),
  cohortId: uuid("cohort_id")
    .notNull()
    .references(() => cohorts.id, { onDelete: "cascade" }),
  courseId: uuid("course_id")
    .notNull()
    .references(() => courses.id, { onDelete: "cascade" }),
  orderIndex: integer("order_index").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

export const cohortMembers = pgTable("cohort_members", {
  id: uuid("id").defaultRandom().primaryKey(),
  cohortId: uuid("cohort_id")
    .notNull()
    .references(() => cohorts.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  role: cohortMemberRoleEnum("role").notNull().default("student"),
  status: cohortMemberStatusEnum("status").notNull().default("active"),
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
})

export const cohortSchedule = pgTable("cohort_schedule", {
  id: uuid("id").defaultRandom().primaryKey(),
  cohortId: uuid("cohort_id")
    .notNull()
    .references(() => cohorts.id, { onDelete: "cascade" }),
  titleEn: varchar("title_en", { length: 255 }).notNull(),
  titleAr: varchar("title_ar", { length: 255 }).notNull(),
  startsAt: timestamp("starts_at").notNull(),
  endsAt: timestamp("ends_at").notNull(),
  type: scheduleTypeEnum("type").notNull(),
  locationUrl: text("location_url"),
  notesEn: text("notes_en"),
  notesAr: text("notes_ar"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

export const cohortAnnouncements = pgTable("cohort_announcements", {
  id: uuid("id").defaultRandom().primaryKey(),
  cohortId: uuid("cohort_id")
    .notNull()
    .references(() => cohorts.id, { onDelete: "cascade" }),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  titleEn: varchar("title_en", { length: 255 }).notNull(),
  titleAr: varchar("title_ar", { length: 255 }).notNull(),
  bodyEn: text("body_en").notNull(),
  bodyAr: text("body_ar").notNull(),
  pinned: boolean("pinned").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

// Mentorship System Tables
export const mentors = pgTable("mentors", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  bioEn: text("bio_en"),
  bioAr: text("bio_ar"),
  skills: jsonb("skills").default([]),
  hourlyRate: decimal("hourly_rate", { precision: 10, scale: 2 }),
  isActive: boolean("is_active").notNull().default(true),
  rating: decimal("rating", { precision: 3, scale: 2 }).default("0"),
  totalSessions: integer("total_sessions").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
})

export const mentorAvailability = pgTable("mentor_availability", {
  id: uuid("id").defaultRandom().primaryKey(),
  mentorId: uuid("mentor_id")
    .notNull()
    .references(() => mentors.id, { onDelete: "cascade" }),
  weekday: integer("weekday").notNull(), // 0-6
  startTime: varchar("start_time", { length: 10 }).notNull(),
  endTime: varchar("end_time", { length: 10 }).notNull(),
  timezone: varchar("timezone", { length: 50 }).notNull().default("Asia/Riyadh"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

export const bookings = pgTable("bookings", {
  id: uuid("id").defaultRandom().primaryKey(),
  mentorId: uuid("mentor_id")
    .notNull()
    .references(() => mentors.id, { onDelete: "cascade" }),
  studentId: uuid("student_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  startAt: timestamp("start_at").notNull(),
  endAt: timestamp("end_at").notNull(),
  status: bookingStatusEnum("status").notNull().default("requested"),
  topic: varchar("topic", { length: 255 }).notNull(),
  notes: text("notes"),
  meetingUrl: text("meeting_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
})

export const bookingReviews = pgTable("booking_reviews", {
  id: uuid("id").defaultRandom().primaryKey(),
  bookingId: uuid("booking_id")
    .notNull()
    .references(() => bookings.id, { onDelete: "cascade" }),
  rating: integer("rating").notNull(), // 1-5
  feedbackEn: text("feedback_en"),
  feedbackAr: text("feedback_ar"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

export const consultationExperts = pgTable("consultation_experts", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  nameEn: varchar("name_en", { length: 255 }).notNull(),
  nameAr: varchar("name_ar", { length: 255 }).notNull(),
  fieldEn: varchar("field_en", { length: 255 }).notNull(),
  fieldAr: varchar("field_ar", { length: 255 }).notNull(),
  imageUrl: text("image_url"),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
})

export const consultationSlots = pgTable(
  "consultation_slots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    expertId: uuid("expert_id")
      .notNull()
      .references(() => consultationExperts.id, { onDelete: "cascade" }),
    startAt: timestamp("start_at").notNull(),
    endAt: timestamp("end_at").notNull(),
    status: consultationSlotStatusEnum("status").notNull().default("available"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    expertStartUnique: uniqueIndex("consultation_slots_expert_start_unique").on(t.expertId, t.startAt),
  }),
)

export const consultationBookings = pgTable(
  "consultation_bookings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    expertId: uuid("expert_id")
      .notNull()
      .references(() => consultationExperts.id, { onDelete: "cascade" }),
    assignedUserId: uuid("assigned_user_id").references(() => users.id, { onDelete: "set null" }),
    slotId: uuid("slot_id")
      .notNull()
      .references(() => consultationSlots.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    requesterName: varchar("requester_name", { length: 255 }).notNull(),
    requesterEmail: varchar("requester_email", { length: 255 }).notNull(),
    requesterPhone: varchar("requester_phone", { length: 32 }),
    status: consultationBookingStatusEnum("status").notNull().default("requested"),
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    slotUnique: uniqueIndex("consultation_bookings_slot_unique").on(t.slotId),
  }),
)

// Audit Logs table
export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  action: varchar("action", { length: 255 }).notNull(),
  resource: varchar("resource", { length: 255 }).notNull(),
  resourceId: uuid("resource_id"),
  changes: jsonb("changes"),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

// Relations
export const usersRelations = relations(users, ({ many, one }) => ({
  sessions: many(sessions),
  enrollments: many(enrollments),
  orders: many(orders),
  challengeSubmissions: many(challengeSubmissions),
  contestParticipants: many(contestParticipants),
  certificates: many(certificates),
  instructorCourses: many(courses),
  cart: many(carts),
  reviews: many(reviews),
  bookmarks: many(bookmarks),
  notes: many(notes),
  createdCohorts: many(cohorts),
  cohortMemberships: many(cohortMembers),
  mentorProfile: one(mentors, { fields: [users.id], references: [mentors.userId] }),
  studentBookings: many(bookings),
  conversations: many(conversationParticipants),
  sentMessages: many(messages),
  createdSupportTickets: many(supportTickets, { relationName: "ticket_creator" }),
  assignedSupportTickets: many(supportTickets, { relationName: "ticket_assignee" }),
  supportTicketMessages: many(supportTicketMessages),
}))

export const coursesRelations = relations(courses, ({ one, many }) => ({
  instructor: one(users, {
    fields: [courses.instructorId],
    references: [users.id],
  }),
  category: one(categories, {
    fields: [courses.categoryId],
    references: [categories.id],
  }),
  supportTickets: many(supportTickets),
  modules: many(modules),
  lessons: many(lessons),
  enrollments: many(enrollments),
  certificates: many(certificates),
  reviews: many(reviews),
  cohortCourses: many(cohortCourses),
}))

export const modulesRelations = relations(modules, ({ one, many }) => ({
  course: one(courses, {
    fields: [modules.courseId],
    references: [courses.id],
  }),
  lessons: many(lessons),
}))

export const lessonsRelations = relations(lessons, ({ one, many }) => ({
  module: one(modules, {
    fields: [lessons.moduleId],
    references: [modules.id],
  }),
  course: one(courses, {
    fields: [lessons.courseId],
    references: [courses.id],
  }),
  notes: many(notes),
  progress: many(progress),
}))

export const enrollmentsRelations = relations(enrollments, ({ one }) => ({
  user: one(users, {
    fields: [enrollments.userId],
    references: [users.id],
  }),
  course: one(courses, {
    fields: [enrollments.courseId],
    references: [courses.id],
  }),
}))

export const consultationExpertsRelations = relations(consultationExperts, ({ many }) => ({
  slots: many(consultationSlots),
  bookings: many(consultationBookings),
}))

export const consultationSlotsRelations = relations(consultationSlots, ({ one }) => ({
  expert: one(consultationExperts, {
    fields: [consultationSlots.expertId],
    references: [consultationExperts.id],
  }),
}))

export const consultationBookingsRelations = relations(consultationBookings, ({ one }) => ({
  expert: one(consultationExperts, {
    fields: [consultationBookings.expertId],
    references: [consultationExperts.id],
  }),
  slot: one(consultationSlots, {
    fields: [consultationBookings.slotId],
    references: [consultationSlots.id],
  }),
  user: one(users, {
    fields: [consultationBookings.userId],
    references: [users.id],
  }),
}))

export const progressRelations = relations(progress, ({ one }) => ({
  user: one(users, {
    fields: [progress.userId],
    references: [users.id],
  }),
  lesson: one(lessons, {
    fields: [progress.lessonId],
    references: [lessons.id],
  }),
}))

export const reviewsRelations = relations(reviews, ({ one }) => ({
  user: one(users, { fields: [reviews.userId], references: [users.id] }),
  course: one(courses, { fields: [reviews.courseId], references: [courses.id] }),
}))

export const bookmarksRelations = relations(bookmarks, ({ one }) => ({
  user: one(users, { fields: [bookmarks.userId], references: [users.id] }),
  course: one(courses, { fields: [bookmarks.courseId], references: [courses.id] }),
  lesson: one(lessons, { fields: [bookmarks.lessonId], references: [lessons.id] }),
}))

export const notesRelations = relations(notes, ({ one }) => ({
  user: one(users, { fields: [notes.userId], references: [users.id] }),
  lesson: one(lessons, { fields: [notes.lessonId], references: [lessons.id] }),
}))

export const cartsRelations = relations(carts, ({ one, many }) => ({
  user: one(users, { fields: [carts.userId], references: [users.id] }),
  items: many(cartItems),
}))

export const cartItemsRelations = relations(cartItems, ({ one }) => ({
  cart: one(carts, { fields: [cartItems.cartId], references: [carts.id] }),
  course: one(courses, { fields: [cartItems.courseId], references: [courses.id] }),
  product: one(products, { fields: [cartItems.productId], references: [products.id] }),
}))

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  cartItems: many(cartItems),
  orderItems: many(orderItems),
}))



export const challengesRelations = relations(challenges, ({ one, many }) => ({
  category: one(categories, {
    fields: [challenges.categoryId],
    references: [categories.id],
  }),
  instructor: one(users, {
    fields: [challenges.instructorId],
    references: [users.id],
  }),
  course: one(courses, {
    fields: [challenges.courseId],
    references: [courses.id],
  }),
  submissions: many(challengeSubmissions),
}))

export const certificatesRelations = relations(certificates, ({ one }) => ({
  user: one(users, { fields: [certificates.userId], references: [users.id] }),
  course: one(courses, { fields: [certificates.courseId], references: [courses.id] }),
}))

export const contestsRelations = relations(contests, ({ many }) => ({
  participants: many(contestParticipants),
}))

export const contestParticipantsRelations = relations(contestParticipants, ({ one }) => ({
  user: one(users, {
    fields: [contestParticipants.userId],
    references: [users.id],
  }),
  contest: one(contests, {
    fields: [contestParticipants.contestId],
    references: [contests.id],
  }),
}))

export const cohortsRelations = relations(cohorts, ({ one, many }) => ({
  creator: one(users, { fields: [cohorts.createdBy], references: [users.id] }),
  members: many(cohortMembers),
  courses: many(cohortCourses),
  schedule: many(cohortSchedule),
  announcements: many(cohortAnnouncements),
}))

export const cohortMembersRelations = relations(cohortMembers, ({ one }) => ({
  cohort: one(cohorts, { fields: [cohortMembers.cohortId], references: [cohorts.id] }),
  user: one(users, { fields: [cohortMembers.userId], references: [users.id] }),
}))

export const cohortCoursesRelations = relations(cohortCourses, ({ one }) => ({
  cohort: one(cohorts, { fields: [cohortCourses.cohortId], references: [cohorts.id] }),
  course: one(courses, { fields: [cohortCourses.courseId], references: [courses.id] }),
}))

export const cohortScheduleRelations = relations(cohortSchedule, ({ one }) => ({
  cohort: one(cohorts, { fields: [cohortSchedule.cohortId], references: [cohorts.id] }),
}))

export const cohortAnnouncementsRelations = relations(cohortAnnouncements, ({ one }) => ({
  cohort: one(cohorts, { fields: [cohortAnnouncements.cohortId], references: [cohorts.id] }),
  author: one(users, { fields: [cohortAnnouncements.createdBy], references: [users.id] }),
}))

export const mentorsRelations = relations(mentors, ({ one, many }) => ({
  user: one(users, { fields: [mentors.userId], references: [users.id] }),
  availability: many(mentorAvailability),
  bookings: many(bookings),
}))

export const mentorAvailabilityRelations = relations(mentorAvailability, ({ one }) => ({
  mentor: one(mentors, { fields: [mentorAvailability.mentorId], references: [mentors.id] }),
}))

export const bookingsRelations = relations(bookings, ({ one, many }) => ({
  mentor: one(mentors, { fields: [bookings.mentorId], references: [mentors.id] }),
  student: one(users, { fields: [bookings.studentId], references: [users.id] }),
  review: one(bookingReviews, { fields: [bookings.id], references: [bookingReviews.bookingId] }), // 1:1 relation usually but schema has booking_id unique
}))

export const bookingReviewsRelations = relations(bookingReviews, ({ one }) => ({
  booking: one(bookings, { fields: [bookingReviews.bookingId], references: [bookings.id] }),
}))


// Chat System Tables
export const conversations = pgTable("conversations", {
  id: uuid("id").defaultRandom().primaryKey(),
  type: conversationTypeEnum("type").notNull().default("individual"),
  name: varchar("name", { length: 255 }), // For group chats
  courseId: uuid("course_id").references(() => courses.id, { onDelete: "cascade" }), // Link to course for automated group chats
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
})

export const conversationParticipants = pgTable("conversation_participants", {
  id: uuid("id").defaultRandom().primaryKey(),
  conversationId: uuid("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
  lastReadAt: timestamp("last_read_at"),
  lastTypedAt: timestamp("last_typed_at"),
})

export const messages = pgTable("messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  conversationId: uuid("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  senderId: uuid("sender_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  type: text("type", { enum: ["text", "image", "file", "gif", "sticker"] }).default("text").notNull(),
  attachmentUrl: text("attachment_url"),
  isSystemMessage: boolean("is_system_message").default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
})

// Chat Relations
export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  participants: many(conversationParticipants),
  messages: many(messages),
  course: one(courses, {
    fields: [conversations.courseId],
    references: [courses.id],
  }),
}))

export const conversationParticipantsRelations = relations(conversationParticipants, ({ one }) => ({
  conversation: one(conversations, {
    fields: [conversationParticipants.conversationId],
    references: [conversations.id],
  }),
  user: one(users, {
    fields: [conversationParticipants.userId],
    references: [users.id],
  }),
}))

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
  sender: one(users, {
    fields: [messages.senderId],
    references: [users.id],
  }),
}))

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, {
    fields: [orders.userId],
    references: [users.id],
  }),
  items: many(orderItems),
}))

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  product: one(products, {
    fields: [orderItems.productId],
    references: [products.id],
  }),
  course: one(courses, {
    fields: [orderItems.courseId],
    references: [courses.id],
  }),
}))

// Files table for database storage
export const files = pgTable("files", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  type: varchar("type", { length: 100 }).notNull(), // MIME type
  storage: varchar("storage", { length: 20 }).notNull().default("inline"),
  storageKey: text("storage_key"),
  storageBucket: text("storage_bucket"),
  storageUploadId: text("storage_upload_id"),
  data: text("data"), // Base64 encoded content (inline)
  chunkSize: integer("chunk_size").notNull().default(0),
  chunkCount: integer("chunk_count").notNull().default(0),
  isComplete: boolean("is_complete").notNull().default(true),
  size: integer("size").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

export const fileChunks = pgTable(
  "file_chunks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    fileId: uuid("file_id")
      .notNull()
      .references(() => files.id, { onDelete: "cascade" }),
    chunkIndex: integer("chunk_index").notNull(),
    data: text("data").notNull(),
    size: integer("size").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    fileChunkUnique: uniqueIndex("file_chunks_file_index_unique").on(t.fileId, t.chunkIndex),
  }),
)

export const assignments = pgTable("assignments", {
  id: uuid("id").defaultRandom().primaryKey(),
  courseId: uuid("course_id")
    .notNull()
    .references(() => courses.id, { onDelete: "cascade" }),
  titleEn: varchar("title_en", { length: 255 }).notNull(),
  titleAr: varchar("title_ar", { length: 255 }).notNull(),
  descriptionEn: text("description_en"),
  descriptionAr: text("description_ar"),
  dueAt: timestamp("due_at"),
  maxFileSizeBytes: integer("max_file_size_bytes").notNull().default(524288000),
  isPublished: boolean("is_published").notNull().default(true),
  createdById: uuid("created_by_id").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
})

export const assignmentSubmissions = pgTable(
  "assignment_submissions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    assignmentId: uuid("assignment_id")
      .notNull()
      .references(() => assignments.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    textContent: text("text_content"),
    fileUrl: text("file_url"),
    fileName: varchar("file_name", { length: 255 }),
    fileSize: integer("file_size"),
    mimeType: varchar("mime_type", { length: 100 }),
    attachments: jsonb("attachments").$type<Array<{ url: string; name: string; size?: number; mimeType?: string }>>().default([]),
    status: varchar("status", { length: 50 }).notNull().default("submitted"),
    submittedAt: timestamp("submitted_at").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    onePerUser: uniqueIndex("assignment_submissions_assignment_user_unique").on(t.assignmentId, t.userId),
  }),
)

export const assignmentsRelations = relations(assignments, ({ one, many }) => ({
  course: one(courses, { fields: [assignments.courseId], references: [courses.id] }),
  createdBy: one(users, { fields: [assignments.createdById], references: [users.id] }),
  submissions: many(assignmentSubmissions),
}))

export const assignmentSubmissionsRelations = relations(assignmentSubmissions, ({ one }) => ({
  assignment: one(assignments, { fields: [assignmentSubmissions.assignmentId], references: [assignments.id] }),
  user: one(users, { fields: [assignmentSubmissions.userId], references: [users.id] }),
}))

export const lessonAssignmentSubmissions = pgTable(
  "lesson_assignment_submissions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    textContent: text("text_content"),
    fileUrl: text("file_url"),
    fileName: varchar("file_name", { length: 255 }),
    fileSize: integer("file_size"),
    mimeType: varchar("mime_type", { length: 100 }),
    attachments: jsonb("attachments").$type<Array<{ url: string; name: string; size?: number; mimeType?: string }>>().default([]),
    status: varchar("status", { length: 50 }).notNull().default("submitted"),
    submittedAt: timestamp("submitted_at").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    onePerUser: uniqueIndex("lesson_assignment_submissions_lesson_user_unique").on(t.lessonId, t.userId),
  }),
)

export const lessonAssignmentSubmissionsRelations = relations(lessonAssignmentSubmissions, ({ one }) => ({
  lesson: one(lessons, { fields: [lessonAssignmentSubmissions.lessonId], references: [lessons.id] }),
  user: one(users, { fields: [lessonAssignmentSubmissions.userId], references: [users.id] }),
}))

// IBM External Course Submissions
export const ibmSubmissions = pgTable("ibm_submissions", {
  id: uuid("id").defaultRandom().primaryKey(),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  phoneNumber: varchar("phone_number", { length: 32 }),
  completionDate: timestamp("completion_date").notNull(),
  certificateUrl: text("certificate_url").notNull(),
  employmentStatus: varchar("employment_status", { length: 255 }), // باحث عن عمل، طالب، موظف...
  resumeUrl: text("resume_url"),
  notes: text("notes"),
  issuedCertificateUrl: text("issued_certificate_url"), // مجال للشهادة المستقبلية
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

export const ibmSubmissionsRelations = relations(ibmSubmissions, ({ one }) => ({
  user: one(users, { fields: [ibmSubmissions.userId], references: [users.id] }),
}))

// Password Reset Tokens
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 255 }).notNull(),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

// Support Tickets System
export const supportTickets = pgTable("support_tickets", {
  id: uuid("id").defaultRandom().primaryKey(),
  subjectAr: varchar("subject_ar", { length: 255 }).notNull(),
  subjectEn: varchar("subject_en", { length: 255 }).notNull(),
  descriptionAr: text("description_ar").notNull(),
  descriptionEn: text("description_en").notNull(),
  category: supportTicketCategoryEnum("category").notNull().default("technical"),
  status: supportTicketStatusEnum("status").notNull().default("open"),
  priority: varchar("priority", { length: 16 }).notNull().default("normal"),
  createdById: uuid("created_by_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  assignedToId: uuid("assigned_to_id").references(() => users.id, { onDelete: "set null" }),
  relatedCourseId: uuid("related_course_id").references(() => courses.id, { onDelete: "set null" }),
  resolvedAt: timestamp("resolved_at"),
  closedAt: timestamp("closed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
})

export const supportTicketMessages = pgTable("support_ticket_messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  ticketId: uuid("ticket_id")
    .notNull()
    .references(() => supportTickets.id, { onDelete: "cascade" }),
  senderId: uuid("sender_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  attachments: jsonb("attachments").$type<Array<{ name: string; url: string; size?: number; mimeType?: string }>>().default([]),
  isInternal: boolean("is_internal").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

// Support Tickets Relations (AFTER table definitions to avoid hoisting TDZ)
export const supportTicketsRelations = relations(supportTickets, ({ one, many }) => ({
  createdBy: one(users, {
    fields: [supportTickets.createdById],
    references: [users.id],
    relationName: "ticket_creator",
  }),
  assignedTo: one(users, {
    fields: [supportTickets.assignedToId],
    references: [users.id],
    relationName: "ticket_assignee",
  }),
  relatedCourse: one(courses, {
    fields: [supportTickets.relatedCourseId],
    references: [courses.id],
  }),
  messages: many(supportTicketMessages),
}))

export const supportTicketMessagesRelations = relations(supportTicketMessages, ({ one }) => ({
  ticket: one(supportTickets, {
    fields: [supportTicketMessages.ticketId],
    references: [supportTickets.id],
  }),
  sender: one(users, {
    fields: [supportTicketMessages.senderId],
    references: [users.id],
  }),
}))

