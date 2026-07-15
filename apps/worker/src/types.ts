export type LessonState =
  | 'pending'
  | 'notified'
  | 'opened'
  | 'quiz_pending'
  | 'completed'
  | 'review_later'
  | 'scheduled_for_review'

export interface Bindings {
  DB: D1Database
  ASSETS: Fetcher
  ENVIRONMENT: 'development' | 'production'
  DEVICE_REGISTRATION_SECRET?: string
}

export interface LessonSummary {
  id: number
  slug: string
  title: string
  summary: string
  deepExplanation: string
  state: LessonState
}
