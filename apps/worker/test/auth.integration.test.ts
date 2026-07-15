import { env } from 'cloudflare:workers'
import { beforeEach, describe, expect, it } from 'vitest'
import app from '../src/index'
import type { Bindings } from '../src/types'

const credential = 'a'.repeat(43)
const deviceAuthorization = `Device test-device:${credential}`
const testEnv = env as unknown as Bindings

async function registerDevice() {
  return app.request(
    '/api/devices/register',
    {
      method: 'POST',
      headers: {
        authorization: 'Bearer bootstrap-test-secret',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ deviceId: 'test-device', credential }),
    },
    testEnv,
  )
}

async function createBrowserSession(): Promise<string> {
  expect((await registerDevice()).status).toBe(201)
  const tokenResponse = await app.request(
    '/api/opening-tokens',
    { method: 'POST', headers: { authorization: deviceAuthorization } },
    testEnv,
  )
  const { url } = (await tokenResponse.json()) as { url: string }
  const exchange = await app.request(url, undefined, testEnv)
  const cookie = exchange.headers.get('set-cookie')?.split(';')[0]
  if (!cookie) throw new Error('Expected an opening-token exchange cookie.')
  return cookie
}

describe('private device authentication', () => {
  beforeEach(async () => {
    await testEnv.DB.batch([
      testEnv.DB.prepare('DELETE FROM quiz_attempts'),
      testEnv.DB.prepare('DELETE FROM review_schedule'),
      testEnv.DB.prepare('DELETE FROM weekly_reviews'),
      testEnv.DB.prepare('DELETE FROM request_limits'),
      testEnv.DB.prepare('DELETE FROM browser_sessions'),
      testEnv.DB.prepare('DELETE FROM opening_tokens'),
      testEnv.DB.prepare('DELETE FROM daily_deliveries'),
      testEnv.DB.prepare('DELETE FROM devices'),
      testEnv.DB.prepare('DELETE FROM lesson_progress'),
    ])
    await testEnv.DB
      .prepare("DELETE FROM quiz_questions WHERE lesson_id IN (SELECT id FROM lessons WHERE slug LIKE 'test-%')")
      .run()
    await testEnv.DB.prepare("DELETE FROM lessons WHERE slug LIKE 'test-%'").run()
    await testEnv.DB.prepare('UPDATE learning_profiles SET notification_hour = 0 WHERE id = 1').run()
  })

  it('rejects registration without the bootstrap secret', async () => {
    const response = await app.request(
      '/api/devices/register',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ deviceId: 'unauthorized-device', credential }),
      },
      testEnv,
    )
    expect(response.status).toBe(401)
  })

  it('keeps lesson content private without a browser session', async () => {
    const response = await app.request('/api/lessons/current', undefined, testEnv)
    expect(response.status).toBe(401)
  })

  it('loads and saves the complete learning profile', async () => {
    const cookie = await createBrowserSession()
    const response = await app.request('/api/profile', { headers: { cookie } }, testEnv)
    expect(response.status).toBe(200)
    const profile = (await response.json()) as {
      notificationHour: number
      preferences: Record<string, unknown>
      topics: Array<{ slug: string; category: string; weight: number }>
    }
    expect(profile.topics).toHaveLength(3)
    expect(profile.preferences).toMatchObject({
      avoidInformationOverload: true,
      codeNavigationGoal: true,
      userControl: true,
      noStreaks: true,
      gamification: false,
    })

    const save = await app.request(
      '/api/profile',
      {
        method: 'PUT',
        headers: { cookie, 'content-type': 'application/json' },
        body: JSON.stringify({
          notificationHour: 9,
          preferences: profile.preferences,
          topics: profile.topics.map(({ slug, weight }) => ({ slug, weight })),
        }),
      },
      testEnv,
    )
    expect(save.status).toBe(200)
    expect(await save.json()).toEqual({ saved: true })
    expect(
      await testEnv.DB.prepare('SELECT notification_hour FROM learning_profiles WHERE id = 1').first(),
    ).toMatchObject({ notification_hour: 9 })

    const invalidTopics = profile.topics.map(({ slug, weight, category }) => ({
      slug,
      weight: category === 'priority' ? Math.max(0, weight - 1) : weight,
    }))
    const invalidSave = await app.request(
      '/api/profile',
      {
        method: 'PUT',
        headers: { cookie, 'content-type': 'application/json' },
        body: JSON.stringify({
          notificationHour: 9,
          preferences: profile.preferences,
          topics: invalidTopics,
        }),
      },
      testEnv,
    )
    expect(invalidSave.status).toBe(400)
    expect(await invalidSave.json()).toEqual({ error: 'Topic weights must match the category distribution.' })
  })

  it('authenticates delivery checks and prevents a duplicate claim', async () => {
    expect((await registerDevice()).status).toBe(201)
    const request = () =>
      app.request(
        '/api/delivery/check',
        {
          method: 'POST',
          headers: { authorization: deviceAuthorization, 'content-type': 'application/json' },
          body: JSON.stringify({ deviceId: 'test-device' }),
        },
        testEnv,
      )

    const first = await request()
    const second = await request()
    expect(first.status).toBe(200)
    expect(await first.json()).toMatchObject({ shouldNotify: true })
    expect(await second.json()).toMatchObject({ shouldNotify: false, reason: 'already_claimed_today' })
  })

  it('exchanges an opening token only once for an HTTP-only session', async () => {
    await registerDevice()
    const tokenResponse = await app.request(
      '/api/opening-tokens',
      { method: 'POST', headers: { authorization: deviceAuthorization } },
      testEnv,
    )
    expect(tokenResponse.status).toBe(200)
    const { url } = (await tokenResponse.json()) as { url: string }

    const firstExchange = await app.request(url, undefined, testEnv)
    expect(firstExchange.status).toBe(302)
    expect(firstExchange.headers.get('set-cookie')).toContain('HttpOnly')
    expect(firstExchange.headers.get('set-cookie')).toContain('Secure')

    const replay = await app.request(url, undefined, testEnv)
    expect(replay.status).toBe(401)
  })

  it('rejects expired opening tokens', async () => {
    await registerDevice()
    const expiredHash = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode('expired-token'),
    )
    const hash = Array.from(new Uint8Array(expiredHash), (byte) =>
      byte.toString(16).padStart(2, '0'),
    ).join('')
    await testEnv.DB.prepare(
      `INSERT INTO opening_tokens (token_hash, device_id, lesson_id, expires_at)
       VALUES (?, 'test-device', 1, '2000-01-01T00:00:00.000Z')`,
    )
      .bind(hash)
      .run()
    const response = await app.request('/open?token=expired-token', undefined, testEnv)
    expect(response.status).toBe(401)
  })

  it('requires the comprehension check before completion', async () => {
    const cookie = await createBrowserSession()
    const lessonResponse = await app.request(
      '/api/lessons/current',
      { headers: { cookie } },
      testEnv,
    )
    const { lesson } = (await lessonResponse.json()) as { lesson: { id: number } }
    const action = await app.request(
      `/api/lessons/${lesson.id}/action`,
      {
        method: 'POST',
        headers: { cookie, 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'understand' }),
      },
      testEnv,
    )
    expect(await action.json()).toMatchObject({ state: 'quiz_pending' })
    const progress = await testEnv.DB
      .prepare('SELECT state, completed_at FROM lesson_progress WHERE lesson_id = ?')
      .bind(lesson.id)
      .first<{ state: string; completed_at: string | null }>()
    expect(progress).toMatchObject({ state: 'quiz_pending', completed_at: null })
  })

  it('saves review-later lessons outside the main curriculum', async () => {
    const cookie = await createBrowserSession()
    const lessonResponse = await app.request('/api/lessons/current', { headers: { cookie } }, testEnv)
    const { lesson } = (await lessonResponse.json()) as { lesson: { id: number } }
    await app.request(
      `/api/lessons/${lesson.id}/action`,
      {
        method: 'POST',
        headers: { cookie, 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'review_later' }),
      },
      testEnv,
    )
    const list = await app.request('/api/reviews/later', { headers: { cookie } }, testEnv)
    const body = (await list.json()) as { reviews: Array<{ id: number; reason: string }> }
    expect(body.reviews).toContainEqual(expect.objectContaining({ id: lesson.id, reason: 'saved_for_later' }))
  })

  it('completes an incorrect quiz and schedules the lesson for review', async () => {
    const cookie = await createBrowserSession()
    const lessonResponse = await app.request('/api/lessons/current', { headers: { cookie } }, testEnv)
    const body = (await lessonResponse.json()) as { lesson: { id: number }; quiz: { id: number } }
    await app.request(
      `/api/lessons/${body.lesson.id}/action`,
      {
        method: 'POST',
        headers: { cookie, 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'understand' }),
      },
      testEnv,
    )
    const answer = await app.request(
      `/api/quizzes/${body.quiz.id}/answer`,
      {
        method: 'POST',
        headers: { cookie, 'content-type': 'application/json' },
        body: JSON.stringify({ answer: 'A result' }),
      },
      testEnv,
    )
    expect(await answer.json()).toMatchObject({ correct: false, state: 'completed' })
    const review = await testEnv.DB
      .prepare('SELECT reason FROM review_schedule WHERE lesson_id = ?')
      .bind(body.lesson.id)
      .first<{ reason: string }>()
    expect(review?.reason).toBe('incorrect_answer')
  })

  it('offers a weekly review after seven completions without blocking the next lesson', async () => {
    const cookie = await createBrowserSession()
    const current = await testEnv.DB
      .prepare("SELECT id FROM lessons WHERE slug = 'functions-as-values'")
      .first<{ id: number }>()
    await testEnv.DB
      .prepare("UPDATE lesson_progress SET state = 'completed', completed_at = CURRENT_TIMESTAMP WHERE lesson_id = ?")
      .bind(current!.id)
      .run()

    for (let index = 2; index <= 8; index += 1) {
      const slug = `test-lesson-${index}`
      const result = await testEnv.DB
        .prepare(
          `INSERT INTO lessons (path_id, topic_id, slug, title, summary, deep_explanation, sequence, published)
           VALUES (1, 1, ?, ?, 'summary', 'deep', ?, 1)`,
        )
        .bind(slug, `Test lesson ${index}`, index)
        .run()
      const lessonId = Number(result.meta.last_row_id)
      if (index <= 7) {
        await testEnv.DB
          .prepare("INSERT INTO lesson_progress (lesson_id, state, completed_at) VALUES (?, 'completed', CURRENT_TIMESTAMP)")
          .bind(lessonId)
          .run()
      }
    }

    const weekly = await app.request('/api/weekly-review', { headers: { cookie } }, testEnv)
    expect(await weekly.json()).toMatchObject({ available: true, completedCount: 7 })

    const delivery = await app.request(
      '/api/delivery/check',
      {
        method: 'POST',
        headers: { authorization: deviceAuthorization, 'content-type': 'application/json' },
        body: JSON.stringify({ deviceId: 'test-device' }),
      },
      testEnv,
    )
    expect(await delivery.json()).toMatchObject({ shouldNotify: true })
  })

  it('runs the due-to-incorrect-answer flow end to end', async () => {
    expect((await registerDevice()).status).toBe(201)
    const delivery = await app.request(
      '/api/delivery/check',
      {
        method: 'POST',
        headers: { authorization: deviceAuthorization, 'content-type': 'application/json' },
        body: JSON.stringify({ deviceId: 'test-device' }),
      },
      testEnv,
    )
    expect(await delivery.json()).toMatchObject({ shouldNotify: true })

    const tokenResponse = await app.request(
      '/api/opening-tokens',
      { method: 'POST', headers: { authorization: deviceAuthorization } },
      testEnv,
    )
    const { url } = (await tokenResponse.json()) as { url: string }
    const exchange = await app.request(url, undefined, testEnv)
    const cookie = exchange.headers.get('set-cookie')?.split(';')[0]
    expect(cookie).toBeTruthy()

    const current = await app.request('/api/lessons/current', { headers: { cookie: cookie! } }, testEnv)
    const lessonBody = (await current.json()) as {
      lesson: { id: number; deepExplanation: string }
      quiz: { id: number }
    }
    expect(lessonBody.lesson.deepExplanation).toBeTruthy()

    const understand = await app.request(
      `/api/lessons/${lessonBody.lesson.id}/action`,
      {
        method: 'POST',
        headers: { cookie: cookie!, 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'understand' }),
      },
      testEnv,
    )
    expect(await understand.json()).toMatchObject({ state: 'quiz_pending' })

    const answer = await app.request(
      `/api/quizzes/${lessonBody.quiz.id}/answer`,
      {
        method: 'POST',
        headers: { cookie: cookie!, 'content-type': 'application/json' },
        body: JSON.stringify({ answer: 'A result' }),
      },
      testEnv,
    )
    expect(await answer.json()).toMatchObject({ correct: false, state: 'completed' })
    expect(
      await testEnv.DB.prepare('SELECT reason FROM review_schedule WHERE lesson_id = ?')
        .bind(lessonBody.lesson.id)
        .first(),
    ).toMatchObject({ reason: 'incorrect_answer' })
  })

  it('rejects malformed lesson actions', async () => {
    const cookie = await createBrowserSession()
    const response = await app.request(
      '/api/lessons/1/action',
      {
        method: 'POST',
        headers: { cookie, 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'complete_without_quiz' }),
      },
      testEnv,
    )
    expect(response.status).toBe(400)
  })
})
