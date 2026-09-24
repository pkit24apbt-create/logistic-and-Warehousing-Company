-- Adds a difficulty level to each quiz question (easy, medium, hard).
-- Safe to re-run — only adds the column if it doesn't already exist, and
-- backfills any existing questions to 'medium' so nothing is left blank.

ALTER TABLE questions ADD COLUMN IF NOT EXISTS difficulty VARCHAR(10) NOT NULL DEFAULT 'medium'
  CHECK (difficulty IN ('easy', 'medium', 'hard'));

UPDATE questions SET difficulty = 'medium' WHERE difficulty IS NULL;