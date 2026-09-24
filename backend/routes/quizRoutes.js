const express = require('express');
const { query, pool } = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

const router = express.Router();

// GET /api/quiz/module/:moduleId — quiz + questions + options, WITHOUT revealing is_correct
router.get('/module/:moduleId', verifyToken, async (req, res) => {
  try {
    const { moduleId } = req.params;

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
      'SELECT question_id, question_text, question_type, sort_order, difficulty FROM questions WHERE quiz_id = $1 ORDER BY RANDOM() LIMIT 5',
      [quiz.quiz_id]
    );
    const questions = questionsResult.rows;

    for (const q of questions) {
      const optResult = await query('SELECT option_id, option_text FROM answer_options WHERE question_id = $1', [q.question_id]);
      q.options = optResult.rows;
    }

    res.json({ ...quiz, questions });
  } catch (err) {
    console.error('Get quiz error:', err);
    res.status(500).json({ error: 'Something went wrong loading the quiz.' });
  }
});

// POST /api/quiz/:quizId/build — Trainer defines/replaces questions + options.
// A Trainer may only build a quiz for a module actually assigned to them.
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
        'INSERT INTO questions (quiz_id, question_text, question_type, sort_order, difficulty) VALUES ($1,$2,$3,$4,$5) RETURNING question_id',
        [quizId, q.text, q.type || 'single', i, q.difficulty || 'medium']
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

// POST /api/quiz/:quizId/submit — server-side scoring, never trusts the client.
// Restricted to Employee: Administrators oversee training, they don't take
// it themselves — this matches the frontend restriction, so the rule can't
// be bypassed by calling the API directly.
router.post('/:quizId/submit', verifyToken, requireRole(['employee']), async (req, res) => {
  try {
    const { quizId } = req.params;
    const { answers } = req.body;
    const { userId } = req.user;

    const quizResult = await query('SELECT * FROM quizzes WHERE quiz_id = $1', [quizId]);
    if (quizResult.rows.length === 0) return res.status(404).json({ error: 'Quiz not found.' });
    const quiz = quizResult.rows[0];

    if (req.user.role === 'employee') {
      const assignedCheck = await query(
        'SELECT 1 FROM module_assignments WHERE module_id = $1 AND user_id = $2',
        [quiz.module_id, userId]
      );
      if (assignedCheck.rows.length === 0) {
        return res.status(403).json({ error: 'This module has not been assigned to you.' });
      }
    }

    const questionsResult = await query('SELECT question_id FROM questions WHERE quiz_id = $1', [quizId]);
    const questionIds = questionsResult.rows.map((r) => r.question_id);
    if (questionIds.length === 0) return res.status(400).json({ error: 'This quiz has no questions yet.' });

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
      `INSERT INTO module_progress (user_id, module_id, status, percent_complete, completed_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, module_id)
       DO UPDATE SET status = $3, percent_complete = $4, completed_at = $5`,
      [userId, quiz.module_id, passed ? 'completed' : 'in_progress', passed ? 100 : 50, passed ? new Date() : null]
    );
    const progressResult = await query(
      'SELECT progress_id FROM module_progress WHERE user_id = $1 AND module_id = $2',
      [userId, quiz.module_id]
    );
    const progressId = progressResult.rows[0]?.progress_id || null;

    await query(
      `INSERT INTO quiz_attempts (quiz_id, user_id, score, passed, answers_json, progress_id) VALUES ($1,$2,$3,$4,$5,$6)`,
      [quizId, userId, score, passed, JSON.stringify({ answers, feedback }), progressId]
    );

    res.json({ score, passed, passingScore: quiz.passing_score, correctCount, total: questionIds.length, feedback });
  } catch (err) {
    console.error('Submit quiz error:', err);
    res.status(500).json({ error: 'Something went wrong submitting the quiz.' });
  }
});

// GET /api/quiz/attempts/mine
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