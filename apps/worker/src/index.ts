import { Hono } from 'hono'
import { setCookie } from 'hono/cookie'
import { z } from 'zod'
import { authenticatedDeviceId, constantTimeEqual, hasBrowserSession, randomToken, sha256 } from './auth'
import { isNotificationDue, learningDate } from './learning-day'
import { claimDailyDelivery, getCurrentLesson, transitionLessonState } from './repository'
import type { Bindings } from './types'

const app = new Hono<{ Bindings: Bindings }>()

app.get('/api/health', (c) => c.json({ ok: true }))

app.post('/api/devices/register', async (c) => {
  const suppliedSecret = c.req.header('authorization')?.replace(/^Bearer /, '') ?? ''
  if (
    !c.env.DEVICE_REGISTRATION_SECRET ||
    !constantTimeEqual(suppliedSecret, c.env.DEVICE_REGISTRATION_SECRET)
  ) {
    return c.json({ error: 'Unauthorized.' }, 401)
  }

  const parsed = z
    .object({
      deviceId: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/),
      credential: z.string().min(43).max(200),
    })
    .safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return c.json({ error: 'Invalid request.' }, 400)

  const credentialHash = await sha256(parsed.data.credential)
  try {
    await c.env.DB
      .prepare('INSERT INTO devices (id, credential_hash) VALUES (?, ?)')
      .bind(parsed.data.deviceId, credentialHash)
      .run()
  } catch {
    return c.json({ error: 'Device already exists.' }, 409)
  }
  return c.json({ deviceId: parsed.data.deviceId }, 201)
})

app.get('/open', async (c) => {
  const token = c.req.query('token')
  if (!token) return c.json({ error: 'Opening token is required.' }, 400)
  const now = new Date()
  const tokenHash = await sha256(token)
  const claimed = await c.env.DB
    .prepare(
      `UPDATE opening_tokens
       SET used_at = ?
       WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?
       RETURNING device_id`,
    )
    .bind(now.toISOString(), tokenHash, now.toISOString())
    .first<{ device_id: string }>()
  if (!claimed) return c.json({ error: 'Opening token is invalid or expired.' }, 401)

  const sessionToken = randomToken()
  const sessionExpires = new Date(now.getTime() + 12 * 60 * 60 * 1000)
  await c.env.DB
    .prepare('INSERT INTO browser_sessions (token_hash, device_id, expires_at) VALUES (?, ?, ?)')
    .bind(await sha256(sessionToken), claimed.device_id, sessionExpires.toISOString())
    .run()
  setCookie(c, 'dlg_session', sessionToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'Strict',
    path: '/',
    maxAge: 12 * 60 * 60,
  })
  return c.redirect('/')
})

app.post('/api/opening-tokens', async (c) => {
  const deviceId = await authenticatedDeviceId(c)
  if (!deviceId) return c.json({ error: 'Unauthorized.' }, 401)
  const lesson = await getCurrentLesson(c.env.DB)
  if (!lesson) return c.json({ error: 'No active lesson.' }, 404)

  const token = randomToken()
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()
  await c.env.DB
    .prepare(
      'INSERT INTO opening_tokens (token_hash, device_id, lesson_id, expires_at) VALUES (?, ?, ?, ?)',
    )
    .bind(await sha256(token), deviceId, lesson.id, expiresAt)
    .run()
  const url = new URL(c.req.url)
  url.pathname = '/open'
  url.search = new URLSearchParams({ token }).toString()
  return c.json({ url: url.toString(), expiresAt })
})

app.get('/api/lessons/current', async (c) => {
  if (!(await hasBrowserSession(c))) return c.json({ error: 'Unauthorized.' }, 401)
  const lesson = await getCurrentLesson(c.env.DB)
  if (!lesson) return c.json({ error: 'No published lesson is available.' }, 404)
  await transitionLessonState(c.env.DB, lesson.id, ['pending', 'notified'], 'opened')

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
  if (c.env.ENVIRONMENT === 'production') {
    const authenticatedId = await authenticatedDeviceId(c)
    if (!authenticatedId || authenticatedId !== body.data.deviceId) {
      return c.json({ error: 'Unauthorized.' }, 401)
    }
  }

  const now = body.data.now ? new Date(body.data.now) : new Date()
  if (!isNotificationDue(now)) return c.json({ shouldNotify: false, reason: 'before_nominal_time' })

  const lesson = await getCurrentLesson(c.env.DB)
  if (!lesson) return c.json({ shouldNotify: false, reason: 'no_lesson' })

  const claimed = await claimDailyDelivery(c.env.DB, body.data.deviceId, lesson.id, learningDate(now))
  if (!claimed) return c.json({ shouldNotify: false, reason: 'already_claimed_today' })

  await transitionLessonState(c.env.DB, lesson.id, ['pending', 'notified', 'opened'], 'notified')
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
  if (!(await hasBrowserSession(c))) return c.json({ error: 'Unauthorized.' }, 401)
  const lessonId = Number(c.req.param('id'))
  if (!Number.isInteger(lessonId)) return c.json({ error: 'Invalid lesson id.' }, 400)
  const updated = await transitionLessonState(c.env.DB, lessonId, ['pending', 'notified', 'opened'], 'opened')
  return updated ? c.json({ state: 'opened' }) : c.json({ error: 'Lesson not found.' }, 404)
})

app.post('/api/lessons/:id/action', async (c) => {
  if (!(await hasBrowserSession(c))) return c.json({ error: 'Unauthorized.' }, 401)
  const lessonId = Number(c.req.param('id'))
  const parsed = z
    .object({ action: z.enum(['understand', 'review_later']) })
    .safeParse(await c.req.json().catch(() => null))
  if (!Number.isInteger(lessonId) || !parsed.success) return c.json({ error: 'Invalid request.' }, 400)

  const state = parsed.data.action === 'understand' ? 'quiz_pending' : 'review_later'
  const updated = await transitionLessonState(
    c.env.DB,
    lessonId,
    parsed.data.action === 'understand' ? ['opened'] : ['pending', 'notified', 'opened', 'quiz_pending'],
    state,
    parsed.data.action === 'review_later',
  )
  return updated ? c.json({ state }) : c.json({ error: 'Lesson not found.' }, 404)
})

app.post('/api/quizzes/:id/answer', async (c) => {
  if (!(await hasBrowserSession(c))) return c.json({ error: 'Unauthorized.' }, 401)
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
         WHERE lesson_id = ? AND state = 'quiz_pending'`,
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
