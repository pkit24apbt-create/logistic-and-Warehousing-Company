-- SafeStack database schema — Sprint 1
-- Run this once against a fresh database:
--   psql -h localhost -U postgres -d warehouse_safety -f database/schema.sql
-- Safe to re-run: every statement is idempotent.

CREATE TABLE IF NOT EXISTS roles (
    role_id     SERIAL PRIMARY KEY,
    role_name   VARCHAR(30) UNIQUE NOT NULL CHECK (role_name IN
                 ('employee','trainer','supervisor','administrator')),
    description TEXT
);

CREATE TABLE IF NOT EXISTS users (
    user_id              SERIAL PRIMARY KEY,
    role_id              INTEGER NOT NULL REFERENCES roles(role_id),
    full_name            VARCHAR(120) NOT NULL,
    email                VARCHAR(160) UNIQUE NOT NULL,
    password_hash        VARCHAR(255) NOT NULL,
    department           VARCHAR(120),
    status               VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
    must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
    created_at           TIMESTAMP NOT NULL DEFAULT NOW()
);

INSERT INTO roles (role_name, description) VALUES
 ('employee', 'Completes training modules, quizzes and hazard scenarios'),
 ('trainer', 'Creates and manages training modules and quizzes'),
 ('supervisor', 'Monitors team progress and compliance'),
 ('administrator', 'Manages users, roles and system settings')
ON CONFLICT (role_name) DO NOTHING;

-- If you already had a users table before this column existed, this adds it
-- safely without touching any existing data.
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;

-- No user accounts are created here. The first Administrator account is
-- created through the app itself — visit /setup in the browser once the
-- backend and frontend are running. See README.md for details.

-- Sprint 2 schema additions for SafeStack.
-- Run this AFTER schema.sql, against the same database.
-- Safe to re-run: every statement is idempotent.

CREATE TABLE IF NOT EXISTS training_modules (
    module_id     SERIAL PRIMARY KEY,
    title         VARCHAR(200) NOT NULL,
    topic         VARCHAR(120),
    content_type  VARCHAR(20) NOT NULL DEFAULT 'text' CHECK (content_type IN ('text','image','video','scenario')),
    content_body  TEXT,
    media_url     TEXT,
    is_mandatory  BOOLEAN NOT NULL DEFAULT TRUE,
    status        VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','unpublished')),
    created_by    INTEGER REFERENCES users(user_id),
    created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quizzes (
    quiz_id         SERIAL PRIMARY KEY,
    module_id       INTEGER NOT NULL REFERENCES training_modules(module_id) ON DELETE CASCADE,
    passing_score   INTEGER NOT NULL DEFAULT 70,
    time_limit_sec  INTEGER NOT NULL DEFAULT 600
);

CREATE TABLE IF NOT EXISTS questions (
    question_id    SERIAL PRIMARY KEY,
    quiz_id        INTEGER NOT NULL REFERENCES quizzes(quiz_id) ON DELETE CASCADE,
    question_text  TEXT NOT NULL,
    question_type  VARCHAR(20) NOT NULL DEFAULT 'single' CHECK (question_type IN ('single','multiple')),
    sort_order     INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS answer_options (
    option_id    SERIAL PRIMARY KEY,
    question_id  INTEGER NOT NULL REFERENCES questions(question_id) ON DELETE CASCADE,
    option_text  TEXT NOT NULL,
    is_correct   BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS quiz_attempts (
    attempt_id    SERIAL PRIMARY KEY,
    quiz_id       INTEGER NOT NULL REFERENCES quizzes(quiz_id),
    user_id       INTEGER NOT NULL REFERENCES users(user_id),
    score         INTEGER NOT NULL,
    passed        BOOLEAN NOT NULL,
    answers_json  JSONB,
    attempted_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attempts_user ON quiz_attempts(user_id);

-- Demo content so the training library isn't empty on first run.
INSERT INTO training_modules (title, topic, content_type, content_body, is_mandatory, status)
SELECT 'Manual Handling in the Warehouse', 'Manual Handling', 'text',
 'Correct manual handling technique reduces the risk of musculoskeletal injury. '
 || 'Always assess the load before lifting, keep your back straight, bend at the knees, '
 || 'and keep the load close to your body. Never twist while lifting — turn with your feet instead.',
 TRUE, 'published'
WHERE NOT EXISTS (SELECT 1 FROM training_modules WHERE title = 'Manual Handling in the Warehouse');

INSERT INTO quizzes (module_id, passing_score, time_limit_sec)
SELECT module_id, 70, 300 FROM training_modules WHERE title = 'Manual Handling in the Warehouse'
AND NOT EXISTS (SELECT 1 FROM quizzes q WHERE q.module_id = training_modules.module_id);

INSERT INTO questions (quiz_id, question_text, question_type, sort_order)
SELECT q.quiz_id, 'What is the correct way to lift a heavy box from the floor?', 'single', 1
FROM quizzes q JOIN training_modules m ON q.module_id = m.module_id
WHERE m.title = 'Manual Handling in the Warehouse'
AND NOT EXISTS (SELECT 1 FROM questions WHERE quiz_id = q.quiz_id);

INSERT INTO answer_options (question_id, option_text, is_correct)
SELECT qq.question_id, opt.text, opt.correct
FROM questions qq
JOIN quizzes q ON qq.quiz_id = q.quiz_id
JOIN training_modules m ON q.module_id = m.module_id,
(VALUES
  ('Bend at the knees, keep your back straight, load close to the body', TRUE),
  ('Bend at the waist and keep your legs straight', FALSE),
  ('Twist your body while lifting to save time', FALSE)
) AS opt(text, correct)
WHERE m.title = 'Manual Handling in the Warehouse'
AND qq.question_text = 'What is the correct way to lift a heavy box from the floor?'
AND NOT EXISTS (SELECT 1 FROM answer_options WHERE question_id = qq.question_id);