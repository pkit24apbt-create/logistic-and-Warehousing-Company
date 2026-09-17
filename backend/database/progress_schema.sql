-- Sprint 3 fix-up: aligns the database with the team's ER diagram.
-- Run this AFTER sprint3_schema.sql. Safe to re-run — idempotent.

-- 1) Rename training_modules.created_by -> trainer_id to match the diagram.
--    Wrapped in a check so this only runs once, even if you re-run this file
--    or already have a fresh database created with the new name.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'training_modules' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE training_modules RENAME COLUMN created_by TO trainer_id;
  END IF;
END $$;

-- 2) MODULE_PROGRESS — tracks per-employee, per-module completion state
-- directly, matching the ER diagram. This closes a real gap: previously,
-- a text-only module with no quiz had no way to ever be marked complete.
CREATE TABLE IF NOT EXISTS module_progress (
    progress_id      SERIAL PRIMARY KEY,
    user_id          INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    module_id        INTEGER NOT NULL REFERENCES training_modules(module_id) ON DELETE CASCADE,
    status           VARCHAR(20) NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed')),
    percent_complete SMALLINT NOT NULL DEFAULT 0,
    completed_at     TIMESTAMP,
    UNIQUE (user_id, module_id)
);

-- 3) Link quiz_attempts back to the progress row it affected, matching the
-- diagram's QUIZ_ATTEMPT.progress_id foreign key.
ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS progress_id INTEGER REFERENCES module_progress(progress_id);

CREATE INDEX IF NOT EXISTS idx_module_progress_user ON module_progress(user_id);