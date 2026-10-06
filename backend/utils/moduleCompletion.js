// Shared helper: recalculates and updates a single employee's completion
// status for a module, based on BOTH conditions together — every quiz
// level passed AND every hazard puzzle attempted.
//
// Once a module is complete it also:
//   1. calculates a competency level (novice / competent / proficient)
//      using the thresholds stored in system_settings (defaults 70 / 85)
//   2. issues a digital certificate when the level is competent or higher
//      (Sprint 4: "check completion, verify passing, verify competency,
//      generate certificate, store certificate")

const crypto = require('crypto');
const { query } = require('../config/db');

async function getSetting(key, fallback) {
  try {
    const result = await query('SELECT setting_value FROM system_settings WHERE setting_key = $1', [key]);
    return result.rows.length > 0 ? result.rows[0].setting_value : fallback;
  } catch (err) {
    // system_settings may not exist yet if the Sprint 4 SQL hasn't been run.
    return fallback;
  }
}

function localDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function generateCertCode() {
  return `SS-${new Date().getFullYear()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

async function issueCertificate(userId, moduleId, level, overallScore) {
  const existing = await query(
    'SELECT certificate_id, status FROM certificates WHERE user_id = $1 AND module_id = $2',
    [userId, moduleId]
  );

  if (existing.rows.length === 0) {
    const months = parseInt(await getSetting('certificate_validity_months', '12'), 10);
    let expiry = null;
    if (Number.isInteger(months) && months > 0) {
      const d = new Date();
      d.setMonth(d.getMonth() + months);
      expiry = localDateString(d);
    }
    await query(
      `INSERT INTO certificates (cert_code, user_id, module_id, competency_level, overall_score, expiry_date)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [generateCertCode(), userId, moduleId, level, overallScore, expiry]
    );
  } else if (existing.rows[0].status === 'valid') {
    // A better result upgrades the level on the existing certificate; the
    // certificate code and issue date stay the same.
    await query(
      'UPDATE certificates SET competency_level = $1, overall_score = $2 WHERE certificate_id = $3',
      [level, overallScore, existing.rows[0].certificate_id]
    );
  }
  // A revoked certificate is never re-issued automatically.
}

async function updateModuleCompletion(userId, moduleId) {
  // ----- Quiz completion: every level must be passed -----
  const quizRows = await query('SELECT quiz_id FROM quizzes WHERE module_id = $1', [moduleId]);
  let quizDone = true;
  let quizScore = null;
  if (quizRows.rows.length > 0) {
    const quizId = quizRows.rows[0].quiz_id;
    const totalLevelsResult = await query(
      'SELECT DISTINCT level FROM questions WHERE quiz_id = $1 AND level IS NOT NULL',
      [quizId]
    );
    const totalLevels = totalLevelsResult.rows.length;

    if (totalLevels > 0) {
      const passedLevelsResult = await query(
        'SELECT DISTINCT level FROM quiz_attempts WHERE quiz_id = $1 AND user_id = $2 AND passed = TRUE AND level IS NOT NULL',
        [quizId, userId]
      );
      quizDone = passedLevelsResult.rows.length >= totalLevels;
    } else {
      const anyPassed = await query(
        'SELECT 1 FROM quiz_attempts WHERE quiz_id = $1 AND user_id = $2 AND passed = TRUE LIMIT 1',
        [quizId, userId]
      );
      quizDone = anyPassed.rows.length > 0;
    }

    const avgResult = await query(
      'SELECT AVG(best_per_level)::int AS avg_score FROM (SELECT level, MAX(score) AS best_per_level FROM quiz_attempts WHERE quiz_id = $1 AND user_id = $2 AND level IS NOT NULL GROUP BY level) sub',
      [quizId, userId]
    );
    quizScore = avgResult.rows[0].avg_score;
  }

  // ----- Puzzle completion: every scene attached to this module must have at least one attempt -----
  const scenesResult = await query('SELECT scene_id FROM hazard_scenes WHERE module_id = $1', [moduleId]);
  let puzzlesDone = true;
  const puzzleScores = [];
  for (const s of scenesResult.rows) {
    const attempt = await query(
      'SELECT MAX(score) AS best_score FROM hazard_attempts WHERE scene_id = $1 AND user_id = $2',
      [s.scene_id, userId]
    );
    const best = attempt.rows[0].best_score;
    if (best === null) {
      puzzlesDone = false;
    } else {
      puzzleScores.push(best);
    }
  }

  const isComplete = quizDone && puzzlesDone;

  await query(
    `INSERT INTO module_progress (user_id, module_id, status, percent_complete, completed_at)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id, module_id)
     DO UPDATE SET status = $3, percent_complete = $4, completed_at = $5`,
    [userId, moduleId, isComplete ? 'completed' : 'in_progress', isComplete ? 100 : 50, isComplete ? new Date() : null]
  );

  // ----- Competency level: only meaningful once the module is complete -----
  const components = [];
  if (quizScore !== null) components.push(quizScore);
  if (puzzleScores.length > 0) components.push(puzzleScores.reduce((a, b) => a + b, 0) / puzzleScores.length);
  const overallScore = components.length > 0 ? Math.round(components.reduce((a, b) => a + b, 0) / components.length) : null;

  let competentAt = parseInt(await getSetting('competent_threshold', '70'), 10);
  let proficientAt = parseInt(await getSetting('proficient_threshold', '85'), 10);
  if (!Number.isInteger(competentAt)) competentAt = 70;
  if (!Number.isInteger(proficientAt)) proficientAt = 85;

  let competencyLevel = 'novice';
  if (isComplete && overallScore !== null) {
    if (overallScore >= proficientAt) competencyLevel = 'proficient';
    else if (overallScore >= competentAt) competencyLevel = 'competent';
  }

  await query(
    `INSERT INTO competency_levels (user_id, module_id, level, overall_score, calculated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (user_id, module_id)
     DO UPDATE SET level = $3, overall_score = $4, calculated_at = NOW()`,
    [userId, moduleId, competencyLevel, overallScore]
  );

  // ----- Digital certificate: never allowed to break a quiz/puzzle submission -----
  if (isComplete && competencyLevel !== 'novice') {
    try {
      await issueCertificate(userId, moduleId, competencyLevel, overallScore);
    } catch (err) {
      console.error('Certificate issue error:', err);
    }
  }

  return isComplete;
}

module.exports = { updateModuleCompletion };