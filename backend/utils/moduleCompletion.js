// Shared helper: recalculates and updates a single employee's completion
// status for a module, based on BOTH conditions together — every quiz
// level passed AND every hazard puzzle attempted. Called from both
// quizRoutes.js and hazardRoutes.js after a submission, so the module is
// only ever marked "completed" once both parts are genuinely done.

const { query } = require('../config/db');

async function updateModuleCompletion(userId, moduleId) {
  // ----- Quiz completion: every level must be passed -----
  const quizRows = await query('SELECT quiz_id FROM quizzes WHERE module_id = $1', [moduleId]);
  let quizDone = true;
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
      // Fallback for a quiz with no levels set — any single pass counts.
      const anyPassed = await query(
        'SELECT 1 FROM quiz_attempts WHERE quiz_id = $1 AND user_id = $2 AND passed = TRUE LIMIT 1',
        [quizId, userId]
      );
      quizDone = anyPassed.rows.length > 0;
    }
  }

  // ----- Puzzle completion: every scene attached to this module must have at least one attempt -----
  const scenesResult = await query('SELECT scene_id FROM hazard_scenes WHERE module_id = $1', [moduleId]);
  let puzzlesDone = true;
  for (const s of scenesResult.rows) {
    const attempt = await query(
      'SELECT 1 FROM hazard_attempts WHERE scene_id = $1 AND user_id = $2 LIMIT 1',
      [s.scene_id, userId]
    );
    if (attempt.rows.length === 0) {
      puzzlesDone = false;
      break;
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

  return isComplete;
}

module.exports = { updateModuleCompletion };