PRAGMA foreign_keys = ON;

CREATE TABLE learning_profiles (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  timezone TEXT NOT NULL DEFAULT 'Africa/Tunis',
  notification_hour INTEGER NOT NULL DEFAULT 8,
  preferences_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE topics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('priority', 'core', 'adjacent')),
  weight INTEGER NOT NULL
);

CREATE TABLE learning_paths (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  phase TEXT NOT NULL CHECK (phase IN ('theory', 'practice')),
  active INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE lessons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  path_id INTEGER NOT NULL REFERENCES learning_paths(id),
  topic_id INTEGER NOT NULL REFERENCES topics(id),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  deep_explanation TEXT NOT NULL,
  sequence INTEGER NOT NULL,
  published INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE lesson_sections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  heading TEXT NOT NULL,
  body TEXT NOT NULL,
  position INTEGER NOT NULL,
  UNIQUE (lesson_id, position)
);

CREATE TABLE sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  publisher TEXT NOT NULL,
  source_type TEXT NOT NULL,
  relevant_section TEXT NOT NULL,
  verified_on TEXT NOT NULL,
  supported_claims TEXT NOT NULL
);

CREATE TABLE quiz_questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  kind TEXT NOT NULL,
  options_json TEXT NOT NULL,
  correct_answer TEXT NOT NULL,
  explanation TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE lesson_progress (
  lesson_id INTEGER PRIMARY KEY REFERENCES lessons(id),
  state TEXT NOT NULL CHECK (state IN ('pending', 'notified', 'opened', 'quiz_pending', 'completed', 'review_later', 'scheduled_for_review')),
  review_only INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT
);

CREATE TABLE devices (
  id TEXT PRIMARY KEY,
  credential_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at TEXT
);

CREATE TABLE daily_deliveries (
  learning_date TEXT NOT NULL,
  device_id TEXT NOT NULL,
  lesson_id INTEGER NOT NULL REFERENCES lessons(id),
  claimed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  opened_at TEXT,
  PRIMARY KEY (learning_date, device_id)
);

CREATE TABLE quiz_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question_id INTEGER NOT NULL REFERENCES quiz_questions(id),
  answer TEXT NOT NULL,
  correct INTEGER NOT NULL,
  answered_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE review_schedule (
  lesson_id INTEGER PRIMARY KEY REFERENCES lessons(id),
  reason TEXT NOT NULL,
  scheduled_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TEXT
);

CREATE TABLE weekly_reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  completion_number INTEGER NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('available', 'opened', 'completed', 'dismissed')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE repository_recommendations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lesson_id INTEGER NOT NULL REFERENCES lessons(id),
  repository_url TEXT NOT NULL,
  verified_commit TEXT,
  verified_on TEXT NOT NULL,
  relevant_files_json TEXT NOT NULL,
  rationale TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  concepts_json TEXT NOT NULL,
  guided_task TEXT NOT NULL,
  caveats TEXT NOT NULL
);

CREATE TABLE opening_tokens (
  token_hash TEXT PRIMARY KEY,
  device_id TEXT NOT NULL REFERENCES devices(id),
  lesson_id INTEGER NOT NULL REFERENCES lessons(id),
  expires_at TEXT NOT NULL,
  used_at TEXT
);

CREATE TABLE browser_sessions (
  token_hash TEXT PRIMARY KEY,
  device_id TEXT NOT NULL REFERENCES devices(id),
  expires_at TEXT NOT NULL,
  revoked_at TEXT
);

