import { Hono } from 'hono'
import { setCookie } from 'hono/cookie'
import { z } from 'zod'
import { authenticatedDeviceId, constantTimeEqual, hasBrowserSession, randomToken, sha256 } from './auth'
import { isNotificationDue, learningDate } from './learning-day'
import { claimDailyDelivery, getCurrentLesson, transitionLessonState } from './repository'
import { allowRequest } from './rate-limit'
import type { Bindings } from './types'

const app = new Hono<{ Bindings: Bindings }>()

async function createOpeningUrl(
  db: D1Database,
  requestUrl: string,
  deviceId: string,
  lessonId: number,
  lifetimeMs: number,
) {
  const token = randomToken()
  const expiresAt = new Date(Date.now() + lifetimeMs).toISOString()
  await db
    .prepare(
      'INSERT INTO opening_tokens (token_hash, device_id, lesson_id, expires_at) VALUES (?, ?, ?, ?)',
    )
    .bind(await sha256(token), deviceId, lessonId, expiresAt)
    .run()
  const url = new URL(requestUrl)
  url.pathname = '/open'
  url.search = new URLSearchParams({ token }).toString()
  return { url: url.toString(), expiresAt }
}

app.get('/api/health', (c) => c.json({ ok: true }))

app.post('/api/devices/register', async (c) => {
  const clientAddress = c.req.header('cf-connecting-ip') ?? 'local'
  if (!(await allowRequest(c.env.DB, `register:${clientAddress}`, 5, 15 * 60))) {
    return c.json({ error: 'Too many registration attempts. Try again later.' }, 429)
  }
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
      reset: z.boolean().optional().default(false),
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
    if (parsed.data.reset) {
      await c.env.DB
        .prepare('UPDATE devices SET credential_hash = ?, revoked_at = NULL WHERE id = ?')
        .bind(credentialHash, parsed.data.deviceId)
        .run()
      return c.json({ deviceId: parsed.data.deviceId, reset: true })
    }
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
  if (!(await allowRequest(c.env.DB, `opening-token:${deviceId}`, 10, 60))) {
    return c.json({ error: 'Too many opening-link requests. Try again later.' }, 429)
  }
  const lesson = await getCurrentLesson(c.env.DB)
  if (!lesson) return c.json({ error: 'No active lesson.' }, 404)

  return c.json(await createOpeningUrl(c.env.DB, c.req.url, deviceId, lesson.id, 5 * 60 * 1000))
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
    if (!(await allowRequest(c.env.DB, `delivery:${authenticatedId}`, 12, 60))) {
      return c.json({ error: 'Too many delivery checks. Try again later.' }, 429)
    }
  }

  const now = body.data.now ? new Date(body.data.now) : new Date()
  const profile = await c.env.DB
    .prepare('SELECT notification_hour FROM learning_profiles WHERE id = 1')
    .first<{ notification_hour: number }>()
  const notificationHour = profile?.notification_hour ?? 8
  if (!isNotificationDue(now, notificationHour)) {
    return c.json({ shouldNotify: false, reason: 'before_nominal_time' })
  }

  const lesson = await getCurrentLesson(c.env.DB)
  if (!lesson) return c.json({ shouldNotify: false, reason: 'no_lesson' })

  const claimed = await claimDailyDelivery(c.env.DB, body.data.deviceId, lesson.id, learningDate(now))
  if (!claimed) return c.json({ shouldNotify: false, reason: 'already_claimed_today' })

  await transitionLessonState(c.env.DB, lesson.id, ['pending', 'notified', 'opened'], 'notified')
  const opening = await createOpeningUrl(
    c.env.DB,
    c.req.url,
    body.data.deviceId,
    lesson.id,
    24 * 60 * 60 * 1000,
  )
  return c.json({
    shouldNotify: true,
    lesson: { id: lesson.id, title: lesson.title },
    notification: {
      title: 'Your learning tip is ready',
      body: `Today: ${lesson.title}. Open it whenever you feel like learning something new.`,
      openUrl: opening.url,
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
  const progress = await c.env.DB
    .prepare('SELECT state FROM lesson_progress WHERE lesson_id = ?')
    .bind(question.lesson_id)
    .first<{ state: string }>()
  if (progress?.state !== 'quiz_pending') {
    return c.json({ error: 'This lesson is not awaiting a quiz answer.' }, 409)
  }

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

  return c.json({
    correct,
    correctAnswer: question.correct_answer,
    explanation: question.explanation,
    state: 'completed',
  })
})

app.get('/api/reviews/later', async (c) => {
  if (!(await hasBrowserSession(c))) return c.json({ error: 'Unauthorized.' }, 401)
  const reviews = await c.env.DB
    .prepare(
      `SELECT l.id, l.slug, l.title, l.summary, t.name AS topic, p.state,
              COALESCE(rs.reason, 'saved_for_later') AS reason,
              COALESCE(rs.scheduled_at, p.updated_at) AS saved_at
       FROM lessons l
       JOIN topics t ON t.id = l.topic_id
       JOIN lesson_progress p ON p.lesson_id = l.id
       LEFT JOIN review_schedule rs ON rs.lesson_id = l.id AND rs.reviewed_at IS NULL
       WHERE p.review_only = 1 OR rs.lesson_id IS NOT NULL
       ORDER BY CASE WHEN rs.reason = 'incorrect_answer' THEN 0 ELSE 1 END, saved_at DESC`,
    )
    .all()
  return c.json({ reviews: reviews.results })
})

app.get('/api/reviews/:id', async (c) => {
  if (!(await hasBrowserSession(c))) return c.json({ error: 'Unauthorized.' }, 401)
  const lessonId = Number(c.req.param('id'))
  if (!Number.isInteger(lessonId)) return c.json({ error: 'Invalid lesson id.' }, 400)
  const lesson = await c.env.DB
    .prepare(
      `SELECT l.id, l.slug, l.title, l.summary, l.deep_explanation AS deepExplanation, p.state
       FROM lessons l JOIN lesson_progress p ON p.lesson_id = l.id
       LEFT JOIN review_schedule rs ON rs.lesson_id = l.id AND rs.reviewed_at IS NULL
       WHERE l.id = ? AND (p.review_only = 1 OR rs.lesson_id IS NOT NULL)`,
    )
    .bind(lessonId)
    .first()
  if (!lesson) return c.json({ error: 'Review lesson not found.' }, 404)
  const quiz = await c.env.DB
    .prepare('SELECT id, prompt, options_json FROM quiz_questions WHERE lesson_id = ? ORDER BY position LIMIT 1')
    .bind(lessonId)
    .first<{ id: number; prompt: string; options_json: string }>()
  return c.json({
    lesson,
    quiz: quiz ? { id: quiz.id, prompt: quiz.prompt, options: JSON.parse(quiz.options_json) } : null,
  })
})

app.post('/api/reviews/:id/start', async (c) => {
  if (!(await hasBrowserSession(c))) return c.json({ error: 'Unauthorized.' }, 401)
  const lessonId = Number(c.req.param('id'))
  if (!Number.isInteger(lessonId)) return c.json({ error: 'Invalid lesson id.' }, 400)
  const updated = await transitionLessonState(
    c.env.DB,
    lessonId,
    ['review_later', 'scheduled_for_review', 'completed'],
    'quiz_pending',
    true,
  )
  return updated ? c.json({ state: 'quiz_pending' }) : c.json({ error: 'Review is unavailable.' }, 409)
})

app.get('/api/profile', async (c) => {
  if (!(await hasBrowserSession(c))) return c.json({ error: 'Unauthorized.' }, 401)
  const profile = await c.env.DB
    .prepare('SELECT timezone, notification_hour, preferences_json FROM learning_profiles WHERE id = 1')
    .first<{ timezone: string; notification_hour: number; preferences_json: string }>()
  if (!profile) return c.json({ error: 'Profile not found.' }, 404)
  const topics = await c.env.DB
    .prepare('SELECT slug, name, category, weight FROM topics ORDER BY category, weight DESC, name')
    .all()
  return c.json({
    timezone: profile.timezone,
    notificationHour: profile.notification_hour,
    preferences: JSON.parse(profile.preferences_json),
    topics: topics.results,
  })
})

app.put('/api/profile', async (c) => {
  if (!(await hasBrowserSession(c))) return c.json({ error: 'Unauthorized.' }, 401)
  const parsed = z
    .object({
      notificationHour: z.number().int().min(0).max(23),
      preferences: z.object({
        distribution: z.object({
          priority: z.number().int().min(0).max(100),
          core: z.number().int().min(0).max(100),
          adjacent: z.number().int().min(0).max(100),
        }),
        concreteExamples: z.boolean(),
        explainCausalSteps: z.boolean(),
        clarityOverBrevity: z.boolean(),
        avoidInformationOverload: z.boolean(),
        codeLiteracyGoal: z.boolean(),
        codeNavigationGoal: z.boolean(),
        userControl: z.boolean(),
        noStreaks: z.literal(true),
        gamification: z.literal(false),
      }),
      topics: z.array(z.object({ slug: z.string().min(1).max(100), weight: z.number().int().min(0).max(100) })).max(100),
    })
    .safeParse(await c.req.json().catch(() => null))
  if (!parsed.success) return c.json({ error: 'Invalid profile.' }, 400)
  const distribution = parsed.data.preferences.distribution
  if (distribution.priority + distribution.core + distribution.adjacent !== 100) {
    return c.json({ error: 'Topic distribution must total 100.' }, 400)
  }
  const storedTopics = await c.env.DB
    .prepare('SELECT slug, category FROM topics')
    .all<{ slug: string; category: 'priority' | 'core' | 'adjacent' }>()
  const submittedWeights = new Map(parsed.data.topics.map((topic) => [topic.slug, topic.weight]))
  if (submittedWeights.size !== storedTopics.results.length || parsed.data.topics.length !== storedTopics.results.length) {
    return c.json({ error: 'Every known topic must have one weight.' }, 400)
  }
  const totals = { priority: 0, core: 0, adjacent: 0 }
  for (const topic of storedTopics.results) {
    const weight = submittedWeights.get(topic.slug)
    if (weight === undefined) return c.json({ error: `Unknown or missing topic: ${topic.slug}.` }, 400)
    totals[topic.category] += weight
  }
  if (
    totals.priority !== distribution.priority ||
    totals.core !== distribution.core ||
    totals.adjacent !== distribution.adjacent
  ) {
    return c.json({ error: 'Topic weights must match the category distribution.' }, 400)
  }
  await c.env.DB.batch([
    c.env.DB
      .prepare(
        `UPDATE learning_profiles
         SET notification_hour = ?, preferences_json = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = 1`,
      )
      .bind(parsed.data.notificationHour, JSON.stringify(parsed.data.preferences)),
    ...parsed.data.topics.map((topic) =>
      c.env.DB.prepare('UPDATE topics SET weight = ? WHERE slug = ?').bind(topic.weight, topic.slug),
    ),
  ])
  return c.json({ saved: true })
})

app.get('/api/weekly-review', async (c) => {
  if (!(await hasBrowserSession(c))) return c.json({ error: 'Unauthorized.' }, 401)
  const countRow = await c.env.DB
    .prepare("SELECT COUNT(*) AS count FROM lesson_progress WHERE state = 'completed'")
    .first<{ count: number }>()
  const completedCount = countRow?.count ?? 0
  const milestone = Math.floor(completedCount / 7) * 7
  if (milestone < 7) return c.json({ available: false, completedCount })

  await c.env.DB
    .prepare(
      `INSERT OR IGNORE INTO weekly_reviews (completion_number, status)
       VALUES (?, 'available')`,
    )
    .bind(milestone)
    .run()
  const review = await c.env.DB
    .prepare('SELECT id, status FROM weekly_reviews WHERE completion_number = ?')
    .bind(milestone)
    .first<{ id: number; status: string }>()
  const questions = await c.env.DB
    .prepare(
      `SELECT q.id, q.prompt, q.options_json, l.title
       FROM quiz_questions q
       JOIN lessons l ON l.id = q.lesson_id
       JOIN lesson_progress p ON p.lesson_id = l.id
       LEFT JOIN review_schedule rs ON rs.lesson_id = l.id AND rs.reviewed_at IS NULL
       WHERE p.state = 'completed' OR p.review_only = 1
       ORDER BY CASE WHEN rs.reason = 'incorrect_answer' THEN 0 ELSE 1 END,
                (SELECT COUNT(*) FROM quiz_attempts a WHERE a.question_id = q.id AND a.correct = 0) DESC,
                p.updated_at DESC
       LIMIT 5`,
    )
    .all<{ id: number; prompt: string; options_json: string; title: string }>()
  return c.json({
    available: review?.status !== 'completed',
    reviewId: review?.id,
    status: review?.status,
    completedCount,
    questions: questions.results.map((question) => ({
      id: question.id,
      title: question.title,
      prompt: question.prompt,
      options: JSON.parse(question.options_json),
    })),
  })
})

app.post('/api/weekly-review/:id/complete', async (c) => {
  if (!(await hasBrowserSession(c))) return c.json({ error: 'Unauthorized.' }, 401)
  const reviewId = Number(c.req.param('id'))
  if (!Number.isInteger(reviewId)) return c.json({ error: 'Invalid review id.' }, 400)
  const result = await c.env.DB
    .prepare("UPDATE weekly_reviews SET status = 'completed' WHERE id = ?")
    .bind(reviewId)
    .run()
  return result.meta.changes === 1 ? c.json({ status: 'completed' }) : c.json({ error: 'Review not found.' }, 404)
})

app.post('/api/weekly-review/:reviewId/questions/:questionId/answer', async (c) => {
  if (!(await hasBrowserSession(c))) return c.json({ error: 'Unauthorized.' }, 401)
  const reviewId = Number(c.req.param('reviewId'))
  const questionId = Number(c.req.param('questionId'))
  const parsed = z
    .object({ answer: z.string().min(1).max(200) })
    .safeParse(await c.req.json().catch(() => null))
  if (!Number.isInteger(reviewId) || !Number.isInteger(questionId) || !parsed.success) {
    return c.json({ error: 'Invalid request.' }, 400)
  }
  const review = await c.env.DB
    .prepare("SELECT 1 FROM weekly_reviews WHERE id = ? AND status IN ('available', 'opened')")
    .bind(reviewId)
    .first()
  if (!review) return c.json({ error: 'Weekly review is unavailable.' }, 409)
  const question = await c.env.DB
    .prepare(
      `SELECT q.correct_answer, q.explanation
       FROM quiz_questions q JOIN lesson_progress p ON p.lesson_id = q.lesson_id
       WHERE q.id = ? AND (p.state = 'completed' OR p.review_only = 1)`,
    )
    .bind(questionId)
    .first<{ correct_answer: string; explanation: string }>()
  if (!question) return c.json({ error: 'Question not found.' }, 404)
  const correct = parsed.data.answer === question.correct_answer
  await c.env.DB.batch([
    c.env.DB
      .prepare('INSERT INTO quiz_attempts (question_id, answer, correct) VALUES (?, ?, ?)')
      .bind(questionId, parsed.data.answer, correct ? 1 : 0),
    c.env.DB.prepare("UPDATE weekly_reviews SET status = 'opened' WHERE id = ?").bind(reviewId),
  ])
  return c.json({ correct, correctAnswer: question.correct_answer, explanation: question.explanation })
})

app.notFound((c) => c.json({ error: 'Not found.' }, 404))

export default app
