import type { LessonSummary, LessonState } from './types'

interface LessonRow {
  id: number
  slug: string
  title: string
  summary: string
  deep_explanation: string
  state: LessonState | null
}

export async function getCurrentLesson(db: D1Database): Promise<LessonSummary | null> {
  let row = await db
    .prepare(
      `SELECT l.id, l.slug, l.title, l.summary, l.deep_explanation, p.state
       FROM lessons l
       JOIN lesson_progress p ON p.lesson_id = l.id
       WHERE p.state NOT IN ('completed', 'scheduled_for_review')
         AND p.review_only = 0
       ORDER BY p.created_at, l.sequence
       LIMIT 1`,
    )
    .first<LessonRow>()

  if (!row) {
    const first = await db
      .prepare(
        `SELECT l.id, l.slug, l.title, l.summary, l.deep_explanation, NULL AS state
         FROM lessons l
         LEFT JOIN lesson_progress p ON p.lesson_id = l.id
         WHERE l.published = 1 AND p.lesson_id IS NULL
         ORDER BY l.sequence
         LIMIT 1`,
      )
      .first<LessonRow>()
    if (!first) return null

    await db
      .prepare(
        `INSERT OR IGNORE INTO lesson_progress (lesson_id, state, review_only)
         VALUES (?, 'pending', 0)`,
      )
      .bind(first.id)
      .run()
    row = { ...first, state: 'pending' }
  }

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    deepExplanation: row.deep_explanation,
    state: row.state ?? 'pending',
  }
}

export async function transitionLessonState(
  db: D1Database,
  lessonId: number,
  allowedFrom: LessonState[],
  state: LessonState,
  reviewOnly?: boolean,
): Promise<boolean> {
  const placeholders = allowedFrom.map(() => '?').join(', ')
  const result = await db
    .prepare(
      `UPDATE lesson_progress
       SET state = ?, review_only = COALESCE(?, review_only), updated_at = CURRENT_TIMESTAMP
       WHERE lesson_id = ? AND state IN (${placeholders})`,
    )
    .bind(state, reviewOnly === undefined ? null : reviewOnly ? 1 : 0, lessonId, ...allowedFrom)
    .run()
  return result.meta.changes === 1
}

export async function claimDailyDelivery(
  db: D1Database,
  deviceId: string,
  lessonId: number,
  date: string,
): Promise<boolean> {
  const result = await db
    .prepare(
      `INSERT OR IGNORE INTO daily_deliveries (learning_date, device_id, lesson_id)
       VALUES (?, ?, ?)`,
    )
    .bind(date, deviceId, lessonId)
    .run()
  return result.meta.changes === 1
}
