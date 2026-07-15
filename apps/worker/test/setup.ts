import { env } from 'cloudflare:workers'
import { applyD1Migrations, type D1Migration } from 'cloudflare:test'

interface TestEnv {
  DB: D1Database
  ENVIRONMENT: 'production'
  DEVICE_REGISTRATION_SECRET: string
  TEST_MIGRATIONS: D1Migration[]
}

const testEnv = env as unknown as TestEnv
await applyD1Migrations(testEnv.DB, testEnv.TEST_MIGRATIONS)
await testEnv.DB.batch([
  testEnv.DB
    .prepare('INSERT INTO topics (slug, name, category, weight) VALUES (?, ?, ?, ?)')
    .bind('javascript-async', 'Asynchronous JavaScript', 'priority', 60),
  testEnv.DB
    .prepare('INSERT INTO learning_paths (slug, title, phase, active) VALUES (?, ?, ?, 1)')
    .bind('async-javascript-theory', 'How asynchronous JavaScript really flows', 'theory'),
])
await testEnv.DB.prepare(
  `INSERT INTO lessons (path_id, topic_id, slug, title, summary, deep_explanation, sequence, published)
   SELECT p.id, t.id, ?, ?, ?, ?, 1, 1
   FROM learning_paths p, topics t`,
)
  .bind(
    'functions-as-values',
    'A function can be a value',
    'A concrete lesson summary.',
    'A concrete deep explanation.',
  )
  .run()
