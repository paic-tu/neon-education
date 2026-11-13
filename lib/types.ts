export type UserRole = "student" | "admin" | "instructor" | "manager" | "support" | "event_staff"

export interface User {
  id: string
  name: string
  email?: string
  phone?: string
  role: UserRole
  avatarUrl?: string | null
  coverUrl?: string | null
  bio?: string | null
  headline?: string | null
  websiteUrl?: string | null
  twitterUrl?: string | null
  linkedinUrl?: string | null
  createdAt: string
}

export interface Lesson {
  id: string
  titleAr: string
  titleEn: string
  type: "video" | "text" | "quiz"
  order: number
  durationMin: number
  isLocked: boolean
  videoUrl?: string
  contentAr?: string
  contentEn?: string
  attachments?: { name: string; url: string }[]
  quiz?: {
    questionAr: string
    questionEn: string
    optionsAr: string[]
    optionsEn: string[]
    correctIndex: number
  }[]
}

export interface Module {
  id: string
  titleAr: string
  titleEn: string
  order: number
  lessons: Lesson[]
}

export interface Course {
  id: string
  titleAr: string
  titleEn: string
  category: string
  level: "beginner" | "intermediate" | "advanced"
  durationHours: number
  price: number | null
  thumbnailUrl: string
  instructorName: string
  descriptionAr: string
  descriptionEn: string
  requirementsAr: string[]
  requirementsEn: string[]
  outcomesAr: string[]
  outcomesEn: string[]
  modules: Module[]
}

export interface Enrollment {
  id: string
  userId: string
  courseId: string
  purchased: boolean
  progressPct: number
  completedLessonIds: string[]
  updatedAt: string
}

export type ProductType = "course_access" | "bundle"

export interface Product {
  id: string
  type: ProductType
  titleAr: string
  titleEn: string
  price: number
  includesAr: string[]
  includesEn: string[]
  courseIds?: string[]
}

export interface CartItem {
  id: string
  userId: string
  productId: string
  qty: number
}

export type OrderStatus = "PAID" | "PENDING" | "FAILED"
export type PaymentMethod = "PAID" | "BANK_TRANSFER"

export interface Order {
  id: string
  userId: string
  status: OrderStatus
  paymentMethod: PaymentMethod
  totalAmount: number
  createdAt: string
  items: {
    productId: string
    price: number
    qty: number
  }[]
  receiptUrl?: string
}

export interface Certificate {
  id: string
  userId: string
  courseId: string
  issueDate: string
  revoked: boolean
}
