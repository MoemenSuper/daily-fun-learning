import { Hono } from 'hono'
import { z } from 'zod'
import { isNotificationDue, learningDate } from './learning-day'
import { claimDailyDelivery, getCurrentLesson, setLessonState } from './repository'
import type { Bindings } from './types'

const app = new Hono<{ Bindings: Bindings }>()

app.get('/api/health', (c) => c.json({ ok: true }))

app.get('/api/lessons/current', async (c) => {
  const lesson = await getCurrentLesson(c.env.DB)
  if (!lesson) return c.json({ error: 'No published lesson is available.' }, 404)

  const [sections, sources, quiz] = await Promise.all([
    c.env.DB
      .prepare('SELECT heading, body, position FROM lesson_sections WHERE lesson_id = ? ORDER BY position')
      .bind(lesson.id)
      .all(),
    c.env.DB
      .prepare('SELECT title, url, publisher, relevant_section FROM sources WHERE lesson_id = ?')
      .bind(lesson.id)
      .all(),
    c.env.DB
      .prepare('SELECT id, prompt, options_json FROM quiz_questions WHERE lesson_id = ? ORDER BY position LIMIT 1')
      .bind(lesson.id)
      .first<{ id: number; prompt: string; options_json: string }>(),
  ])

  return c.json({
    lesson,
    sections: sections.results,
    sources: sources.results,
    quiz: quiz ? { id: quiz.id, prompt: quiz.prompt, options: JSON.parse(quiz.options_json) } : null,
  })
})

app.post('/api/delivery/check', async (c) => {
  const body = z
    .object({
      deviceId: z.string().min(1).max(100),
      now: z.iso.datetime().optional(),
    })
    .safeParse(await c.req.json().catch(() => null))
  if (!body.success) return c.json({ error: 'Invalid request.' }, 400)
  if (body.data.now && c.env.ENVIRONMENT !== 'development') {
    return c.json({ error: 'Simulated time is available only in local development.' }, 403)
  }

  const now = body.data.now ? new Date(body.data.now) : new Date()
  if (!isNotificationDue(now)) return c.json({ shouldNotify: false, reason: 'before_nominal_time' })

  const lesson = await getCurrentLesson(c.env.DB)
  if (!lesson) return c.json({ shouldNotify: false, reason: 'no_lesson' })

  const claimed = await claimDailyDelivery(c.env.DB, body.data.deviceId, lesson.id, learningDate(now))
  if (!claimed) return c.json({ shouldNotify: false, reason: 'already_claimed_today' })

  await setLessonState(c.env.DB, lesson.id, 'notified')
  return c.json({
    shouldNotify: true,
    lesson: { id: lesson.id, title: lesson.title },
    notification: {
      title: 'Your learning tip is ready',
      body: `Today: ${lesson.title}. Open it whenever you feel like learning something new.`,
    },
  })
})

app.post('/api/lessons/:id/open', async (c) => {
  const lessonId = Number(c.req.param('id'))
  if (!Number.isInteger(lessonId)) return c.json({ error: 'Invalid lesson id.' }, 400)
  const updated = await setLessonState(c.env.DB, lessonId, 'opened')
  return updated ? c.json({ state: 'opened' }) : c.json({ error: 'Lesson not found.' }, 404)
})

app.post('/api/lessons/:id/action', async (c) => {
  const lessonId = Number(c.req.param('id'))
  const parsed = z
    .object({ action: z.enum(['understand', 'review_later']) })
    .safeParse(await c.req.json().catch(() => null))
  if (!Number.isInteger(lessonId) || !parsed.success) return c.json({ error: 'Invalid request.' }, 400)

  const state = parsed.data.action === 'understand' ? 'quiz_pending' : 'review_later'
  const updated = await setLessonState(c.env.DB, lessonId, state)
  return updated ? c.json({ state }) : c.json({ error: 'Lesson not found.' }, 404)
})

app.post('/api/quizzes/:id/answer', async (c) => {
  const questionId = Number(c.req.param('id'))
  const parsed = z
    .object({ answer: z.string().min(1).max(200) })
    .safeParse(await c.req.json().catch(() => null))
  if (!Number.isInteger(questionId) || !parsed.success) return c.json({ error: 'Invalid request.' }, 400)

  const question = await c.env.DB
    .prepare('SELECT lesson_id, correct_answer, explanation FROM quiz_questions WHERE id = ?')
    .bind(questionId)
    .first<{ lesson_id: number; correct_answer: string; explanation: string }>()
  if (!question) return c.json({ error: 'Question not found.' }, 404)

  const correct = parsed.data.answer === question.correct_answer
  await c.env.DB.batch([
    c.env.DB
      .prepare('INSERT INTO quiz_attempts (question_id, answer, correct) VALUES (?, ?, ?)')
      .bind(questionId, parsed.data.answer, correct ? 1 : 0),
    c.env.DB
      .prepare(
        `UPDATE lesson_progress
         SET state = 'completed', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE lesson_id = ?`,
      )
      .bind(question.lesson_id),
    ...(correct
      ? []
      : [
          c.env.DB
            .prepare(
              `INSERT OR IGNORE INTO review_schedule (lesson_id, reason)
               VALUES (?, 'incorrect_answer')`,
            )
            .bind(question.lesson_id),
        ]),
  ])

  return c.json({ correct, explanation: question.explanation, state: 'completed' })
})

app.notFound((c) => c.json({ error: 'Not found.' }, 404))

export default app

