const express = require('express');
const { query, pool } = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');
const { updateModuleCompletion } = require('../utils/moduleCompletion');

const router = express.Router();

// GET /api/quiz/module/:moduleId/levels — employee-facing: shows all 4
// levels for this quiz, each with its best score, pass status, and
// whether it is unlocked yet (a level unlocks once the one before it is
// passed; Level 1 is always unlocked).
router.get('/module/:moduleId/levels', verifyToken, async (req, res) => {
  try {
    const { moduleId } = req.params;
    const { userId } = req.user;

    if (req.user.role === 'employee') {
      const assignedCheck = await query(
        'SELECT 1 FROM module_assignments WHERE module_id = $1 AND user_id = $2',
        [moduleId, userId]
      );
      if (assignedCheck.rows.length === 0) {
        return res.status(403).json({ error: 'This module has not been assigned to you.' });
      }
    }

    const quizResult = await query('SELECT * FROM quizzes WHERE module_id = $1', [moduleId]);
    if (quizResult.rows.length === 0) return res.status(404).json({ error: 'No quiz found for this module.' });
    const quiz = quizResult.rows[0];

    const levelsResult = await query(
      `SELECT qq.level, COUNT(*) AS question_count
       FROM questions qq WHERE qq.quiz_id = $1 AND qq.level IS NOT NULL
       GROUP BY qq.level ORDER BY qq.level`,
      [quiz.quiz_id]
    );

    const attemptsResult = await query(
      `SELECT level, MAX(score) AS best_score, BOOL_OR(passed) AS passed
       FROM quiz_attempts WHERE quiz_id = $1 AND user_id = $2 AND level IS NOT NULL
       GROUP BY level`,
      [quiz.quiz_id, userId]
    );
    const attemptsByLevel = {};
    attemptsResult.rows.forEach((a) => { attemptsByLevel[a.level] = a; });

    let previousPassed = true; // Level 1 always unlocked
    const levels = levelsResult.rows.map((l) => {
      const attempt = attemptsByLevel[l.level];
      const passed = attempt ? attempt.passed : false;
      const unlocked = previousPassed;
      previousPassed = passed;
      return {
        level: l.level,
        questionCount: l.question_count,
        bestScore: attempt ? attempt.best_score : null,
        passed,
        unlocked,
      };
    });

    const allLevelsPassed = levels.length > 0 && levels.every((l) => l.passed);

    res.json({
      quizId: quiz.quiz_id,
      passingScore: quiz.passing_score,
      timeLimitSec: quiz.time_limit_sec,
      levels,
      allLevelsPassed,
    });
  } catch (err) {
    console.error('Get quiz levels error:', err);
    res.status(500).json({ error: 'Something went wrong loading the quiz levels.' });
  }
});

// GET /api/quiz/module/:moduleId — returns ONE specific level's questions
// (via ?level=N), WITHOUT revealing is_correct. Defaults to level 1 if not
// specified.
router.get('/module/:moduleId', verifyToken, async (req, res) => {
  try {
    const { moduleId } = req.params;
    const level = parseInt(req.query.level, 10) || 1;

    if (req.user.role === 'employee') {
      const assignedCheck = await query(
        'SELECT 1 FROM module_assignments WHERE module_id = $1 AND user_id = $2',
        [moduleId, req.user.userId]
      );
      if (assignedCheck.rows.length === 0) {
        return res.status(403).json({ error: 'This module has not been assigned to you.' });
      }
    }

    const quizResult = await query('SELECT * FROM quizzes WHERE module_id = $1', [moduleId]);
    if (quizResult.rows.length === 0) return res.status(404).json({ error: 'No quiz found for this module.' });
    const quiz = quizResult.rows[0];

    const questionsResult = await query(
      'SELECT question_id, question_text, question_type, sort_order, difficulty, level FROM questions WHERE quiz_id = $1 AND level = $2 ORDER BY sort_order',
      [quiz.quiz_id, level]
    );
    const questions = questionsResult.rows;
    if (questions.length === 0) return res.status(404).json({ error: `No questions found for level ${level}.` });

    for (const q of questions) {
      const optResult = await query('SELECT option_id, option_text FROM answer_options WHERE question_id = $1', [q.question_id]);
      q.options = optResult.rows;
    }

    res.json({ ...quiz, level, questions });
  } catch (err) {
    console.error('Get quiz error:', err);
    res.status(500).json({ error: 'Something went wrong loading the quiz.' });
  }
});

router.post('/:quizId/build', verifyToken, requireRole(['trainer', 'administrator']), async (req, res) => {
  const client = await pool.connect();
  try {
    const { quizId } = req.params;

    if (req.user.role === 'trainer') {
      const ownerCheck = await query(
        `SELECT m.trainer_id FROM quizzes q JOIN training_modules m ON q.module_id = m.module_id WHERE q.quiz_id = $1`,
        [quizId]
      );
      if (ownerCheck.rows.length === 0) return res.status(404).json({ error: 'Quiz not found.' });
      if (ownerCheck.rows[0].trainer_id !== req.user.userId) {
        return res.status(403).json({ error: 'This module is not assigned to you.' });
      }
    }

    const { passingScore, timeLimitSec, questions } = req.body;

    await client.query('BEGIN');

    await client.query(
      'UPDATE quizzes SET passing_score = COALESCE($1, passing_score), time_limit_sec = COALESCE($2, time_limit_sec) WHERE quiz_id = $3',
      [passingScore, timeLimitSec, quizId]
    );

    await client.query('DELETE FROM questions WHERE quiz_id = $1', [quizId]);

    for (let i = 0; i < (questions || []).length; i++) {
      const q = questions[i];
      const qResult = await client.query(
        'INSERT INTO questions (quiz_id, question_text, question_type, sort_order, difficulty, level) VALUES ($1,$2,$3,$4,$5,$6) RETURNING question_id',
        [quizId, q.text, q.type || 'single', i, q.difficulty || 'medium', q.level || Math.ceil((i + 1) / 5)]
      );
      const questionId = qResult.rows[0].question_id;
      for (const opt of q.options || []) {
        await client.query(
          'INSERT INTO answer_options (question_id, option_text, is_correct) VALUES ($1,$2,$3)',
          [questionId, opt.text, !!opt.isCorrect]
        );
      }
    }

    await client.query('COMMIT');
    res.json({ message: 'Quiz saved.' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Build quiz error:', err);
    res.status(500).json({ error: 'Something went wrong saving the quiz.' });
  } finally {
    client.release();
  }
});

// POST /api/quiz/:quizId/submit — now scoped to a single level. Records
// which level this attempt was for, and only marks the overall module
// quiz as "passed" once every level has been passed (checked together
// with hazard puzzle completion via updateModuleCompletion).
router.post('/:quizId/submit', verifyToken, requireRole(['employee']), async (req, res) => {
  try {
    const { quizId } = req.params;
    const { answers, level } = req.body;
    const { userId } = req.user;

    if (!level) return res.status(400).json({ error: 'level is required.' });

    const quizResult = await query('SELECT * FROM quizzes WHERE quiz_id = $1', [quizId]);
    if (quizResult.rows.length === 0) return res.status(404).json({ error: 'Quiz not found.' });
    const quiz = quizResult.rows[0];

    const assignedCheck = await query(
      'SELECT 1 FROM module_assignments WHERE module_id = $1 AND user_id = $2',
      [quiz.module_id, userId]
    );
    if (assignedCheck.rows.length === 0) {
      return res.status(403).json({ error: 'This module has not been assigned to you.' });
    }

    const questionsResult = await query('SELECT question_id FROM questions WHERE quiz_id = $1 AND level = $2', [quizId, level]);
    const questionIds = questionsResult.rows.map((r) => r.question_id);
    if (questionIds.length === 0) return res.status(400).json({ error: 'This level has no questions.' });

    let correctCount = 0;
    const feedback = [];

    for (const questionId of questionIds) {
      const correctResult = await query('SELECT option_id FROM answer_options WHERE question_id = $1 AND is_correct = TRUE', [questionId]);
      const correctIds = correctResult.rows.map((r) => r.option_id).sort();
      const submitted = (answers && answers[questionId]) || [];
      const submittedSorted = [...submitted].sort();

      const isCorrect =
        correctIds.length === submittedSorted.length &&
        correctIds.every((id, i) => id === submittedSorted[i]);

      if (isCorrect) correctCount += 1;
      feedback.push({ questionId, isCorrect, correctOptionIds: correctIds });
    }

    const score = Math.round((correctCount / questionIds.length) * 100);
    const passed = score >= quiz.passing_score;

    await query(
      `INSERT INTO quiz_attempts (quiz_id, user_id, score, passed, answers_json, level) VALUES ($1,$2,$3,$4,$5,$6)`,
      [quizId, userId, score, passed, JSON.stringify({ answers, feedback }), level]
    );

    // Recalculate overall module completion — now checks BOTH quiz levels
    // AND every hazard puzzle together, not just this quiz alone.
    const isModuleComplete = await updateModuleCompletion(userId, quiz.module_id);

    res.json({ score, passed, passingScore: quiz.passing_score, correctCount, total: questionIds.length, feedback, level, isModuleComplete });
  } catch (err) {
    console.error('Submit quiz error:', err);
    res.status(500).json({ error: 'Something went wrong submitting the quiz.' });
  }
});

router.get('/attempts/mine', verifyToken, async (req, res) => {
  try {
    const result = await query(
      `SELECT qa.*, m.title AS module_title FROM quiz_attempts qa
       JOIN quizzes q ON qa.quiz_id = q.quiz_id
       JOIN training_modules m ON q.module_id = m.module_id
       WHERE qa.user_id = $1 ORDER BY qa.attempted_at DESC`,
      [req.user.userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('My attempts error:', err);
    res.status(500).json({ error: 'Something went wrong loading your quiz history.' });
  }
});

module.exports = router;