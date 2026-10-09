const crypto = require('crypto');
const express = require('express');
const { query } = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');
const { updateModuleCompletion } = require('../utils/moduleCompletion');
const P = require('../utils/puzzleScoring');

// Puzzle engine. One row in hazard_scenes = one puzzle of any type:
//   hazard_hunt, hazard_hunt_360, sequence, match
// Every attempt is stored in hazard_attempts, so module completion, competency,
// certificates and all the supervisor reports include every puzzle type.
//
// Anti-cheat in short:
//   * answers are scored on the server; positions / order / categories are never
//     sent to the browser before the attempt is submitted
//   * a hunt accepts at most (hazards + 2) marks and every wrong mark costs points
//   * an attempt needs a server session; it can be submitted once; timers are
//     measured by the server
//   * attempts can be limited per rolling 24 hours (never a permanent lock-out)
//   * steps / items are sent shuffled with random ids that reveal nothing
//   * ORDER (sequence) puzzles show marks, score, best score and the right order
//     ONLY when every step is correct (or in trainer preview). A partly right
//     answer never shows any mark, even on the last attempt.

const router = express.Router();

const HUNT_TYPES = ['hazard_hunt', 'hazard_hunt_360'];

function parseId(value) {
  const n = Number.parseInt(value, 10);
  return Number.isInteger(n) && n > 0 ? n : null;
}

async function loadScene(sceneId) {
  const result = await query(
    `SELECT hs.scene_id, hs.module_id, hs.title, hs.image_url, hs.intro_tips, hs.puzzle_type,
            hs.max_attempts, hs.time_limit_sec, hs.config, m.trainer_id
     FROM hazard_scenes hs JOIN training_modules m ON m.module_id = hs.module_id
     WHERE hs.scene_id = $1`,
    [sceneId]
  );
  return result.rows[0] || null;
}

async function isAssigned(moduleId, userId) {
  const r = await query('SELECT 1 FROM module_assignments WHERE module_id = $1 AND user_id = $2', [moduleId, userId]);
  return r.rows.length > 0;
}

// Who may open a puzzle. Employees need the module assigned to them. The owning
// trainer and administrators may try their own puzzles ("preview"): nothing is
// recorded for them.
async function playAccess(req, scene) {
  const { role, userId } = req.user;
  if (role === 'employee') {
    if (!(await isAssigned(scene.module_id, userId))) {
      return { error: 'This module has not been assigned to you.', status: 403 };
    }
    return { preview: false };
  }
  if (role === 'administrator') return { preview: true };
  if (role === 'trainer') {
    if (scene.trainer_id !== userId) return { error: 'This module is not assigned to you.', status: 403 };
    return { preview: true };
  }
  return { error: 'Only employees can play puzzles.', status: 403 };
}

async function attemptTimes(sceneId, userId) {
  const r = await query(
    'SELECT attempted_at FROM hazard_attempts WHERE scene_id = $1 AND user_id = $2 ORDER BY attempted_at',
    [sceneId, userId]
  );
  return r.rows.map((row) => row.attempted_at);
}

async function attemptsFor(scene, userId, now = new Date()) {
  return P.attemptsInfo({ maxAttempts: scene.max_attempts, attemptTimes: await attemptTimes(scene.scene_id, userId), now });
}

// The best score the learner is allowed to SEE. For ORDER puzzles a score is a
// mark, so it is shown only once the puzzle has been solved completely (100).
async function bestScore(sceneId, userId, puzzleType) {
  const r = await query('SELECT MAX(score) AS best FROM hazard_attempts WHERE scene_id = $1 AND user_id = $2', [sceneId, userId]);
  const v = r.rows[0] ? r.rows[0].best : null;
  if (v === null || v === undefined) return null;
  const score = Number(v);
  if (puzzleType === 'sequence' && score < 100) return null;
  return score;
}

async function itemCount(scene) {
  const table = HUNT_TYPES.includes(scene.puzzle_type) ? 'hazard_hotspots' : 'puzzle_items';
  const r = await query(`SELECT COUNT(*) AS n FROM ${table} WHERE scene_id = $1`, [scene.scene_id]);
  return Number(r.rows[0].n);
}

async function loadHotspots(sceneId) {
  const r = await query(
    'SELECT hotspot_id, x_percent, y_percent, label, explanation, points, radius FROM hazard_hotspots WHERE scene_id = $1 ORDER BY hotspot_id',
    [sceneId]
  );
  return r.rows;
}

async function loadItems(sceneId) {
  const r = await query(
    'SELECT item_key, position, item_text, explanation, category FROM puzzle_items WHERE scene_id = $1 ORDER BY position',
    [sceneId]
  );
  return r.rows;
}

function timeLimitOf(scene) {
  return scene.time_limit_sec === null || scene.time_limit_sec === undefined ? null : Number(scene.time_limit_sec);
}

// ---------------------------------------------------------------------------
// GET /api/hazard/module/:moduleId/scenes - every puzzle on a module
// ---------------------------------------------------------------------------
router.get('/module/:moduleId/scenes', verifyToken, async (req, res) => {
  try {
    const moduleId = parseId(req.params.moduleId);
    if (!moduleId) return res.status(404).json({ error: 'Module not found.' });

    if (req.user.role === 'employee' && !(await isAssigned(moduleId, req.user.userId))) {
      return res.status(403).json({ error: 'This module has not been assigned to you.' });
    }

    const result = await query(
      `SELECT hs.scene_id, hs.title, hs.puzzle_type, hs.max_attempts, hs.time_limit_sec,
              (SELECT COUNT(*) FROM hazard_hotspots hh WHERE hh.scene_id = hs.scene_id) AS hotspot_count,
              (SELECT COUNT(*) FROM puzzle_items pi WHERE pi.scene_id = hs.scene_id) AS items_count
       FROM hazard_scenes hs WHERE hs.module_id = $1 ORDER BY hs.scene_id`,
      [moduleId]
    );

    const now = new Date();
    const scenes = [];
    for (const row of result.rows) {
      const count = HUNT_TYPES.includes(row.puzzle_type) ? Number(row.hotspot_count) : Number(row.items_count);
      const scene = {
        scene_id: row.scene_id,
        title: row.title,
        puzzle_type: row.puzzle_type,
        item_count: count,
        hazard_count: count, // older screens read this name
        max_attempts: Number(row.max_attempts) || 0,
        time_limit_sec: timeLimitOf(row),
      };
      if (req.user.role === 'employee') {
        const info = await attemptsFor(row, req.user.userId, now);
        scene.attempts_left = info.left;
        scene.retry_at = info.retryAt;
        scene.best_score = await bestScore(row.scene_id, req.user.userId, row.puzzle_type);
      }
      scenes.push(scene);
    }
    res.json(scenes);
  } catch (err) {
    console.error('List hazard scenes error:', err);
    res.status(500).json({ error: 'Something went wrong loading the puzzles.' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/hazard/scene/:sceneId/play - what the start screen needs. It never
// contains answers, and the image / steps only arrive once an attempt starts.
// ---------------------------------------------------------------------------
router.get('/scene/:sceneId/play', verifyToken, async (req, res) => {
  try {
    const sceneId = parseId(req.params.sceneId);
    const scene = sceneId ? await loadScene(sceneId) : null;
    if (!scene) return res.status(404).json({ error: 'Puzzle not found.' });

    let preview = false;
    if (req.user.role === 'employee') {
      if (!(await isAssigned(scene.module_id, req.user.userId))) {
        return res.status(403).json({ error: 'This module has not been assigned to you.' });
      }
    } else if (req.user.role === 'trainer' || req.user.role === 'administrator') {
      preview = true;
    }

    const count = await itemCount(scene);
    const body = {
      scene_id: scene.scene_id,
      module_id: scene.module_id,
      title: scene.title,
      intro_tips: scene.intro_tips,
      puzzle_type: scene.puzzle_type,
      item_count: count,
      hazard_count: count,
      max_marks: HUNT_TYPES.includes(scene.puzzle_type) ? P.maxMarksFor(count) : null,
      max_attempts: Number(scene.max_attempts) || 0,
      time_limit_sec: timeLimitOf(scene),
      preview,
      attempts: null,
      best_score: null,
    };
    if (req.user.role === 'employee') {
      body.attempts = await attemptsFor(scene, req.user.userId);
      body.best_score = await bestScore(scene.scene_id, req.user.userId, scene.puzzle_type);
    }
    res.json(body);
  } catch (err) {
    console.error('Get hazard scene error:', err);
    res.status(500).json({ error: 'Something went wrong loading the puzzle.' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/hazard/scene/:sceneId/start - begins an attempt (server session)
// ---------------------------------------------------------------------------
router.post('/scene/:sceneId/start', verifyToken, requireRole(['employee', 'trainer', 'administrator']), async (req, res) => {
  try {
    const sceneId = parseId(req.params.sceneId);
    const scene = sceneId ? await loadScene(sceneId) : null;
    if (!scene) return res.status(404).json({ error: 'Puzzle not found.' });

    const access = await playAccess(req, scene);
    if (access.error) return res.status(access.status).json({ error: access.error });

    let attempts = null;
    if (!access.preview) {
      attempts = await attemptsFor(scene, req.user.userId);
      if (!attempts.unlimited && attempts.left <= 0) {
        return res.status(429).json({
          error: 'You have used all your attempts for now. You can try again later.',
          retryAt: attempts.retryAt,
        });
      }
    }

    const payload = { puzzleType: scene.puzzle_type };
    if (HUNT_TYPES.includes(scene.puzzle_type)) {
      const count = await itemCount(scene);
      if (count === 0 || !scene.image_url) return res.status(409).json({ error: 'This puzzle has not been set up yet.' });
      payload.imageUrl = scene.image_url;
      payload.hazardCount = count;
      payload.maxMarks = P.maxMarksFor(count);
    } else {
      const items = await loadItems(scene.scene_id);
      if (items.length === 0) return res.status(409).json({ error: 'This puzzle has not been set up yet.' });
      const sent = scene.puzzle_type === 'sequence' ? P.shuffledNotSolved(items) : P.shuffled(items);
      payload.items = sent.map((i) => ({ key: i.item_key, text: i.item_text }));
      if (scene.puzzle_type === 'match') payload.categories = P.parseConfig(scene.config).categories || [];
    }

    // Only one open attempt per learner and puzzle: starting again replaces it.
    await query('DELETE FROM puzzle_sessions WHERE scene_id = $1 AND user_id = $2 AND submitted_at IS NULL', [scene.scene_id, req.user.userId]);
    const token = crypto.randomBytes(16).toString('hex');
    const startedAt = new Date();
    await query(
      'INSERT INTO puzzle_sessions (session_token, scene_id, user_id, started_at) VALUES ($1,$2,$3,$4)',
      [token, scene.scene_id, req.user.userId, startedAt]
    );

    res.json({
      ...payload,
      sessionToken: token,
      startedAt: startedAt.toISOString(),
      serverTime: new Date().toISOString(),
      timeLimitSec: timeLimitOf(scene),
      preview: access.preview,
      attempts,
    });
  } catch (err) {
    console.error('Start puzzle error:', err);
    res.status(500).json({ error: 'Something went wrong starting the puzzle.' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/hazard/scene/:sceneId/submit - scores an attempt on the server
// body: { sessionToken, marks: [{x,y}] }      hunts
//       { sessionToken, order: [key, ...] }   sequence
//       { sessionToken, answers: {key: category} }   match
// ---------------------------------------------------------------------------
router.post('/scene/:sceneId/submit', verifyToken, requireRole(['employee', 'trainer', 'administrator']), async (req, res) => {
  try {
    const sceneId = parseId(req.params.sceneId);
    const scene = sceneId ? await loadScene(sceneId) : null;
    if (!scene) return res.status(404).json({ error: 'Puzzle not found.' });

    const access = await playAccess(req, scene);
    if (access.error) return res.status(access.status).json({ error: access.error });
    const { userId } = req.user;
    const body = req.body || {};

    const sessionResult = await query(
      'SELECT session_token, started_at FROM puzzle_sessions WHERE session_token = $1 AND scene_id = $2 AND user_id = $3 AND submitted_at IS NULL',
      [String(body.sessionToken || ''), scene.scene_id, userId]
    );
    if (sessionResult.rows.length === 0) {
      return res.status(400).json({ error: 'This attempt has already been submitted or has expired. Please start again.' });
    }
    const startedAt = sessionResult.rows[0].started_at;

    // ----- validate the answer BEFORE the session is used up -----
    const type = scene.puzzle_type;
    let hotspots = [];
    let items = [];
    let marks = [];
    if (HUNT_TYPES.includes(type)) {
      hotspots = await loadHotspots(scene.scene_id);
      marks = body.marks;
      const problem = P.validateMarks(marks, hotspots.length);
      if (problem) return res.status(400).json({ error: problem });
    } else if (type === 'sequence') {
      items = await loadItems(scene.scene_id);
      const problem = P.validateOrder(items.map((i) => i.item_key), body.order);
      if (problem) return res.status(400).json({ error: problem });
    } else {
      items = await loadItems(scene.scene_id);
      const categories = P.parseConfig(scene.config).categories || [];
      const problem = P.validateAnswers(items, categories, body.answers);
      if (problem) return res.status(400).json({ error: problem });
    }

    // ----- use up the session (a second submit of the same attempt is refused) -----
    const now = new Date();
    const used = await query(
      'UPDATE puzzle_sessions SET submitted_at = $1 WHERE session_token = $2 AND submitted_at IS NULL',
      [now, body.sessionToken]
    );
    if (used.rowCount === 0) {
      return res.status(400).json({ error: 'This attempt has already been submitted. Please start again.' });
    }

    const { durationSec, timedOut } = P.sessionTiming({ startedAt, now, limitSec: scene.time_limit_sec });

    // ----- score -----
    let outcome;
    if (HUNT_TYPES.includes(type)) {
      const r = P.scoreHunt({ hotspots, marks, type });
      outcome = { score: r.score, correctCount: r.foundCount, totalCount: r.totalCount, wrongCount: r.wrongCount, hunt: r };
    } else if (type === 'sequence') {
      const r = P.scoreSequence({ correctKeys: items.map((i) => i.item_key), submittedKeys: body.order });
      outcome = { score: r.score, correctCount: r.correctCount, totalCount: r.totalCount, wrongCount: r.wrongCount, seq: r };
    } else {
      const r = P.scoreMatch({ items, answers: body.answers });
      outcome = { score: r.score, correctCount: r.correctCount, totalCount: r.totalCount, wrongCount: r.wrongCount, match: r };
    }
    if (timedOut) outcome = { ...outcome, score: 0, correctCount: 0, wrongCount: outcome.totalCount };

    // ----- record (employees only) -----
    let isModuleComplete = false;
    let attempts = null;
    if (!access.preview) {
      await query(
        `INSERT INTO hazard_attempts (scene_id, user_id, found_count, total_count, score, wrong_count, duration_sec, timed_out, attempted_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [scene.scene_id, userId, outcome.correctCount, outcome.totalCount, outcome.score, outcome.wrongCount, durationSec, timedOut, now]
      );
      isModuleComplete = await updateModuleCompletion(userId, scene.module_id);
      attempts = await attemptsFor(scene, userId, now);
    }

    const isSequence = type === 'sequence';

    // ORDER puzzles: marks, score and the right order are shown ONLY when EVERY
    // step is in the correct order. A partly right answer (2 or 3 steps right)
    // shows no marks at all - not even on the last attempt. Only a trainer or
    // administrator previewing the puzzle sees the full result.
    const marksHidden = isSequence && !access.preview && outcome.score < 100;
    if (marksHidden) {
      return res.json({
        puzzleType: type,
        marksHidden: true,
        score: null,
        correctCount: null,
        totalCount: outcome.totalCount,
        wrongCount: null,
        timedOut,
        durationSec,
        revealed: false,
        preview: false,
        attempts,
        isModuleComplete,
        details: {
          steps: body.order.map((key) => ({ key, text: items.find((i) => i.item_key === key).item_text })),
          correctOrder: null,
        },
      });
    }

    // The right answers are revealed when they can no longer be used to cheat:
    // a perfect score, no attempts left, unlimited attempts, or a trainer preview.
    // (ORDER puzzles are only ever shown here with a perfect score or in preview.)
    const reveal = isSequence
      ? true
      : (access.preview || outcome.score === 100 || attempts === null || attempts.unlimited || attempts.left === 0);

    let details = {};
    if (HUNT_TYPES.includes(type)) {
      details = {
        markStatus: timedOut ? marks.map(() => 'wrong') : outcome.hunt.markStatus,
        hotspots: hotspots.map((h) => {
          const found = !timedOut && outcome.hunt.foundIds.has(h.hotspot_id);
          if (found || reveal) {
            return {
              hotspotId: h.hotspot_id, found, hidden: false,
              x: Number(h.x_percent), y: Number(h.y_percent),
              label: h.label, explanation: h.explanation, points: Number(h.points) || 1,
            };
          }
          return { found: false, hidden: true };
        }),
      };
    } else if (type === 'sequence') {
      const byKey = new Map(items.map((i) => [i.item_key, i]));
      details = {
        steps: body.order.map((key, i) => ({ key, text: byKey.get(key).item_text, inOrder: !timedOut && outcome.seq.inOrder[i] })),
        correctOrder: reveal
          ? items.map((i) => ({ key: i.item_key, text: i.item_text, explanation: i.explanation }))
          : null,
      };
    } else {
      const byKey = new Map(items.map((i) => [i.item_key, i]));
      details = {
        items: outcome.match.perItem.map((p) => {
          const item = byKey.get(p.key);
          const correct = !timedOut && p.correct;
          const show = correct || reveal;
          return {
            key: p.key, text: item.item_text, chosen: p.chosen, correct,
            correctCategory: show ? item.category : null,
            explanation: show ? item.explanation : null,
          };
        }),
      };
    }

    res.json({
      puzzleType: type,
      marksHidden: false,
      score: outcome.score,
      correctCount: outcome.correctCount,
      totalCount: outcome.totalCount,
      wrongCount: outcome.wrongCount,
      timedOut,
      durationSec,
      revealed: reveal,
      preview: access.preview,
      attempts,
      isModuleComplete,
      details,
    });
  } catch (err) {
    console.error('Submit puzzle error:', err);
    res.status(500).json({ error: 'Something went wrong submitting your attempt.' });
  }
});

// ---------------------------------------------------------------------------
// Trainer / administrator: manage puzzles
// ---------------------------------------------------------------------------
function canManage(req, trainerId) {
  return req.user.role === 'administrator' || trainerId === req.user.userId;
}

router.get('/scene/:sceneId/manage', verifyToken, requireRole(['trainer', 'administrator']), async (req, res) => {
  try {
    const sceneId = parseId(req.params.sceneId);
    const scene = sceneId ? await loadScene(sceneId) : null;
    if (!scene) return res.status(404).json({ error: 'Puzzle not found.' });
    if (!canManage(req, scene.trainer_id)) return res.status(403).json({ error: 'This module is not assigned to you.' });

    const hotspots = (await loadHotspots(scene.scene_id)).map((h) => ({
      hotspot_id: h.hotspot_id, x: Number(h.x_percent), y: Number(h.y_percent),
      label: h.label, explanation: h.explanation || '', points: Number(h.points) || 1,
      radius: h.radius === null || h.radius === undefined ? '' : Number(h.radius),
    }));
    const items = (await loadItems(scene.scene_id)).map((i) => ({
      key: i.item_key, text: i.item_text, explanation: i.explanation || '', category: i.category || '',
    }));

    res.json({
      sceneId: scene.scene_id,
      moduleId: scene.module_id,
      title: scene.title,
      puzzleType: scene.puzzle_type,
      imageUrl: scene.image_url || '',
      introTips: scene.intro_tips || '',
      maxAttempts: Number(scene.max_attempts) || 0,
      timeLimitSec: timeLimitOf(scene) === null ? '' : timeLimitOf(scene),
      categories: P.parseConfig(scene.config).categories || [],
      hotspots,
      items,
    });
  } catch (err) {
    console.error('Manage hazard scene error:', err);
    res.status(500).json({ error: 'Something went wrong loading this puzzle.' });
  }
});

async function writeChildren(sceneId, value) {
  for (const h of value.hotspots) {
    await query(
      'INSERT INTO hazard_hotspots (scene_id, x_percent, y_percent, label, explanation, points, radius) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [sceneId, h.x, h.y, h.label, h.explanation, h.points, h.radius]
    );
  }
  for (let i = 0; i < value.items.length; i += 1) {
    const it = value.items[i];
    await query(
      'INSERT INTO puzzle_items (scene_id, item_key, position, item_text, explanation, category) VALUES ($1,$2,$3,$4,$5,$6)',
      [sceneId, P.newItemKey(), i + 1, it.text, it.explanation, it.category]
    );
  }
}

router.post('/module/:moduleId/scenes', verifyToken, requireRole(['trainer', 'administrator']), async (req, res) => {
  try {
    const moduleId = parseId(req.params.moduleId);
    if (!moduleId) return res.status(404).json({ error: 'Module not found.' });

    const owner = await query('SELECT trainer_id FROM training_modules WHERE module_id = $1', [moduleId]);
    if (owner.rows.length === 0) return res.status(404).json({ error: 'Module not found.' });
    if (!canManage(req, owner.rows[0].trainer_id)) return res.status(403).json({ error: 'This module is not assigned to you.' });

    const { error, value } = P.validatePuzzlePayload(req.body);
    if (error) return res.status(400).json({ error });

    const created = await query(
      `INSERT INTO hazard_scenes (module_id, title, image_url, intro_tips, puzzle_type, max_attempts, time_limit_sec, config)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING scene_id`,
      [moduleId, value.title, value.imageUrl, value.introTips, value.puzzleType, value.maxAttempts, value.timeLimitSec,
        JSON.stringify(value.puzzleType === 'match' ? { categories: value.categories } : {})]
    );
    const sceneId = created.rows[0].scene_id;
    await writeChildren(sceneId, value);

    res.status(201).json({ sceneId, message: 'Puzzle created.' });
  } catch (err) {
    console.error('Create puzzle error:', err);
    res.status(500).json({ error: 'Something went wrong creating the puzzle.' });
  }
});

router.put('/scene/:sceneId', verifyToken, requireRole(['trainer', 'administrator']), async (req, res) => {
  try {
    const sceneId = parseId(req.params.sceneId);
    const scene = sceneId ? await loadScene(sceneId) : null;
    if (!scene) return res.status(404).json({ error: 'Puzzle not found.' });
    if (!canManage(req, scene.trainer_id)) return res.status(403).json({ error: 'This module is not assigned to you.' });

    const { error, value } = P.validatePuzzlePayload(req.body);
    if (error) return res.status(400).json({ error });

    await query(
      `UPDATE hazard_scenes SET title = $1, image_url = $2, intro_tips = $3, puzzle_type = $4,
              max_attempts = $5, time_limit_sec = $6, config = $7 WHERE scene_id = $8`,
      [value.title, value.imageUrl, value.introTips, value.puzzleType, value.maxAttempts, value.timeLimitSec,
        JSON.stringify(value.puzzleType === 'match' ? { categories: value.categories } : {}), scene.scene_id]
    );
    await query('DELETE FROM hazard_hotspots WHERE scene_id = $1', [scene.scene_id]);
    await query('DELETE FROM puzzle_items WHERE scene_id = $1', [scene.scene_id]);
    await writeChildren(scene.scene_id, value);

    res.json({ message: 'Puzzle updated.' });
  } catch (err) {
    console.error('Update puzzle error:', err);
    res.status(500).json({ error: 'Something went wrong updating the puzzle.' });
  }
});

// Deleting a puzzle that employees have already played also removes their
// results for it, so it needs ?force=1 (the app asks the trainer to confirm).
router.delete('/scene/:sceneId', verifyToken, requireRole(['trainer', 'administrator']), async (req, res) => {
  try {
    const sceneId = parseId(req.params.sceneId);
    const scene = sceneId ? await loadScene(sceneId) : null;
    if (!scene) return res.status(404).json({ error: 'Puzzle not found.' });
    if (!canManage(req, scene.trainer_id)) return res.status(403).json({ error: 'This module is not assigned to you.' });

    const played = await query('SELECT COUNT(*) AS n FROM hazard_attempts WHERE scene_id = $1', [scene.scene_id]);
    const attemptCount = Number(played.rows[0].n);
    if (attemptCount > 0 && req.query.force !== '1') {
      return res.status(409).json({
        error: `Employees have played this puzzle ${attemptCount} time(s). Deleting it also removes those results.`,
        attemptCount,
      });
    }

    await query('DELETE FROM hazard_scenes WHERE scene_id = $1', [scene.scene_id]);
    res.json({ message: 'Puzzle removed.' });
  } catch (err) {
    console.error('Delete puzzle error:', err);
    res.status(500).json({ error: 'Something went wrong removing the puzzle.' });
  }
});

module.exports = router;