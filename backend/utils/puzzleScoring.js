// Scoring, validation and anti-cheat helpers for the SafeStack puzzle system.
// Everything here is pure (no database, no HTTP) so every rule can be tested.
//
// Puzzle types:
//   hazard_hunt      click the hazards on a photo
//   hazard_hunt_360  click the hazards inside the 360 degree panorama
//   sequence         put safety steps into the correct order
//   match            match each item to its category (e.g. safe / unsafe)

const crypto = require('crypto');

const DEG = Math.PI / 180;

const PUZZLE_TYPES = ['hazard_hunt', 'hazard_hunt_360', 'sequence', 'match'];

const WRONG_MARK_PENALTY = 10;   // percentage points lost for every wrong mark in a hunt
const EXTRA_MARKS = 2;           // a hunt allows (hazards + 2) marks, so guessing cannot win
const DEFAULT_RADIUS = 8;        // photo: percent of the image; 360: degrees on the sphere
const COOLDOWN_HOURS = 24;       // attempts are limited per rolling 24 hours, never permanently
const TIMER_GRACE_SEC = 10;      // allowance for network delay on timed puzzles

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// ---------------------------------------------------------------------------
// Geometry (same maths as the browser viewer: frontend/src/utils/panoramaMath.js)
// ---------------------------------------------------------------------------
function directionFromPercent(xPercent, yPercent) {
  const lon = (xPercent / 100) * 360 * DEG;
  const lat = (90 - (yPercent / 100) * 180) * DEG;
  return [Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon)];
}

// Angle in degrees between two points of an equirectangular image.
// Handles the left/right wrap-around and the stretching near the poles.
function angularDistanceDeg(a, b) {
  const da = directionFromPercent(a.x, a.y);
  const db = directionFromPercent(b.x, b.y);
  const dot = clamp(da[0] * db[0] + da[1] * db[1] + da[2] * db[2], -1, 1);
  return Math.acos(dot) / DEG;
}

function planarDistance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function maxMarksFor(hazardCount) {
  return hazardCount + EXTRA_MARKS;
}

// ---------------------------------------------------------------------------
// Hazard hunt (photo and 360)
// ---------------------------------------------------------------------------
function validateMarks(marks, hazardCount) {
  if (!Array.isArray(marks)) return 'marks must be a list.';
  if (marks.length > maxMarksFor(hazardCount)) {
    return `You can place at most ${maxMarksFor(hazardCount)} marks.`;
  }
  for (const m of marks) {
    if (!m || typeof m.x !== 'number' || typeof m.y !== 'number' || !Number.isFinite(m.x) || !Number.isFinite(m.y)
        || m.x < 0 || m.x > 100 || m.y < 0 || m.y > 100) {
      return 'Every mark needs x and y between 0 and 100.';
    }
  }
  return null;
}

// Each mark is matched to the NEAREST hazard within that hazard's radius.
//  - a mark near no hazard is a wrong mark (costs WRONG_MARK_PENALTY points)
//  - a second mark on a hazard that is already found is ignored (no penalty)
// Hazards carry points (1 = minor, 2 = serious, 3 = critical), so critical
// hazards are worth more.
function scoreHunt({ hotspots, marks, type }) {
  const distance = type === 'hazard_hunt_360' ? angularDistanceDeg : planarDistance;
  const found = new Set();
  const markStatus = [];   // for each mark: 'found' | 'duplicate' | 'wrong'
  let wrongCount = 0;

  for (const mark of marks) {
    let best = null;
    for (const h of hotspots) {
      const radius = h.radius === null || h.radius === undefined || h.radius === '' ? DEFAULT_RADIUS : Number(h.radius);
      const d = distance({ x: Number(h.x_percent), y: Number(h.y_percent) }, mark);
      if (d <= radius && (best === null || d < best.d)) best = { id: h.hotspot_id, d };
    }
    if (best === null) {
      wrongCount += 1;
      markStatus.push('wrong');
    } else if (found.has(best.id)) {
      markStatus.push('duplicate');
    } else {
      found.add(best.id);
      markStatus.push('found');
    }
  }

  const pointsOf = (h) => Number(h.points) || 1;
  const total = hotspots.reduce((s, h) => s + pointsOf(h), 0);
  const earned = hotspots.filter((h) => found.has(h.hotspot_id)).reduce((s, h) => s + pointsOf(h), 0);
  const raw = total > 0 ? (earned / total) * 100 - WRONG_MARK_PENALTY * wrongCount : 0;

  return {
    foundIds: found,
    markStatus,
    foundCount: found.size,
    totalCount: hotspots.length,
    wrongCount,
    score: clamp(Math.round(raw), 0, 100),
  };
}

// ---------------------------------------------------------------------------
// Sequence: put the steps in order
// ---------------------------------------------------------------------------
function validateOrder(correctKeys, submittedKeys) {
  if (!Array.isArray(submittedKeys) || submittedKeys.length !== correctKeys.length) {
    return 'Put every step into the list before submitting.';
  }
  const expected = new Set(correctKeys);
  const seen = new Set();
  for (const k of submittedKeys) {
    if (typeof k !== 'string' || !expected.has(k) || seen.has(k)) return 'The submitted order is not valid.';
    seen.add(k);
  }
  return null;
}

// Credit = the longest run of steps that are in the right relative order.
// Moving ONE step to the wrong end therefore loses one step, not all of them.
function scoreSequence({ correctKeys, submittedKeys }) {
  const rank = new Map(correctKeys.map((k, i) => [k, i]));
  const seq = submittedKeys.map((k) => rank.get(k));
  const n = seq.length;

  const length = new Array(n).fill(1);
  const parent = new Array(n).fill(-1);
  let bestEnd = 0;
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < i; j += 1) {
      if (seq[j] < seq[i] && length[j] + 1 > length[i]) { length[i] = length[j] + 1; parent[i] = j; }
    }
    if (length[i] > length[bestEnd]) bestEnd = i;
  }

  const inOrder = new Array(n).fill(false);
  for (let i = bestEnd; i !== -1 && n > 0; i = parent[i]) inOrder[i] = true;
  const correctCount = n > 0 ? length[bestEnd] : 0;

  return {
    correctCount,
    totalCount: n,
    wrongCount: n - correctCount,
    score: n > 0 ? Math.round((correctCount / n) * 100) : 0,
    inOrder,
  };
}

// ---------------------------------------------------------------------------
// Match: put each item in its category
// ---------------------------------------------------------------------------
function validateAnswers(items, categories, answers) {
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) return 'answers must be an object.';
  const known = new Set(items.map((i) => i.item_key));
  for (const [key, value] of Object.entries(answers)) {
    if (!known.has(key)) return 'An answer refers to an unknown item.';
    if (value !== null && value !== '' && !categories.includes(value)) return 'An answer uses an unknown category.';
  }
  return null;
}

function scoreMatch({ items, answers }) {
  const perItem = items.map((item) => {
    const chosen = answers[item.item_key] || null;
    return { key: item.item_key, chosen, correct: chosen !== null && chosen === item.category };
  });
  const correctCount = perItem.filter((p) => p.correct).length;
  const totalCount = items.length;
  return {
    correctCount,
    totalCount,
    wrongCount: totalCount - correctCount,
    score: totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0,
    perItem,
  };
}

// ---------------------------------------------------------------------------
// Anti-cheat: shuffling, attempts, timing
// ---------------------------------------------------------------------------
function shuffled(list, randomInt = crypto.randomInt) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = randomInt(0, i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// A sequence puzzle must never be handed over already solved.
function shuffledNotSolved(list, randomInt = crypto.randomInt) {
  if (list.length < 2) return list.slice();
  for (let tries = 0; tries < 20; tries += 1) {
    const out = shuffled(list, randomInt);
    if (out.some((v, i) => v !== list[i])) return out;
  }
  return list.slice().reverse();
}

function newItemKey() {
  return crypto.randomBytes(5).toString('hex'); // opaque: reveals nothing about the order
}

// maxAttempts 0 = unlimited. Otherwise attempts are counted over a rolling
// window, so a learner is never locked out for good - they retry later.
function attemptsInfo({ maxAttempts, attemptTimes, now = new Date(), cooldownHours = COOLDOWN_HOURS }) {
  const max = Number(maxAttempts) || 0;
  if (max === 0) return { unlimited: true, max: 0, used: attemptTimes.length, left: null, retryAt: null };

  const cooldownMs = cooldownHours * 3600 * 1000;
  const cutoff = now.getTime() - cooldownMs;
  const recent = attemptTimes.map((t) => new Date(t).getTime()).filter((t) => t > cutoff).sort((a, b) => a - b);
  const used = recent.length;
  const left = Math.max(0, max - used);
  const retryAt = left === 0 ? new Date(recent[used - max] + cooldownMs).toISOString() : null;
  return { unlimited: false, max, used, left, retryAt };
}

function sessionTiming({ startedAt, now = new Date(), limitSec, graceSec = TIMER_GRACE_SEC }) {
  const durationSec = Math.max(0, Math.round((now.getTime() - new Date(startedAt).getTime()) / 1000));
  const timedOut = Boolean(limitSec) && durationSec > Number(limitSec) + graceSec;
  return { durationSec, timedOut };
}

// ---------------------------------------------------------------------------
// Trainer input validation (used by create and update)
// ---------------------------------------------------------------------------
function cleanText(value, max) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function validImageUrl(url) {
  if (typeof url !== 'string') return false;
  const u = url.trim();
  if (u.length === 0 || u.length > 500) return false;
  return (u.startsWith('/') && !u.startsWith('//')) || /^https?:\/\//i.test(u);
}

function validatePuzzlePayload(body) {
  const b = body || {};
  const puzzleType = b.puzzleType || 'hazard_hunt';
  if (!PUZZLE_TYPES.includes(puzzleType)) return { error: 'Unknown puzzle type.' };

  const title = cleanText(b.title, 200);
  if (!title) return { error: 'Give the puzzle a title.' };

  const maxAttempts = b.maxAttempts === undefined || b.maxAttempts === null || b.maxAttempts === '' ? 3 : Number(b.maxAttempts);
  if (!Number.isInteger(maxAttempts) || maxAttempts < 0 || maxAttempts > 10) {
    return { error: 'Attempts must be a whole number from 0 (unlimited) to 10.' };
  }

  let timeLimitSec = null;
  if (b.timeLimitSec !== undefined && b.timeLimitSec !== null && b.timeLimitSec !== '' && Number(b.timeLimitSec) !== 0) {
    timeLimitSec = Number(b.timeLimitSec);
    if (!Number.isInteger(timeLimitSec) || timeLimitSec < 15 || timeLimitSec > 3600) {
      return { error: 'The time limit must be between 15 and 3600 seconds (or empty for none).' };
    }
  }

  const value = {
    puzzleType,
    title,
    introTips: cleanText(b.introTips, 1000) || null,
    maxAttempts,
    timeLimitSec,
    imageUrl: null,
    hotspots: [],
    items: [],
    categories: [],
  };

  if (puzzleType === 'hazard_hunt' || puzzleType === 'hazard_hunt_360') {
    if (!validImageUrl(b.imageUrl)) return { error: 'Add an image address that starts with / or http.' };
    value.imageUrl = b.imageUrl.trim();
    if (!Array.isArray(b.hotspots) || b.hotspots.length < 1 || b.hotspots.length > 20) {
      return { error: 'Add between 1 and 20 hazards.' };
    }
    for (const h of b.hotspots) {
      const x = Number(h && h.x);
      const y = Number(h && h.y);
      if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 100 || y < 0 || y > 100) {
        return { error: 'Every hazard needs a position on the image.' };
      }
      const label = cleanText(h.label, 200);
      if (!label) return { error: 'Every hazard needs a name.' };
      const points = h.points === undefined || h.points === null || h.points === '' ? 1 : Number(h.points);
      if (![1, 2, 3].includes(points)) return { error: 'Hazard severity must be 1, 2 or 3.' };
      let radius = null;
      if (h.radius !== undefined && h.radius !== null && h.radius !== '') {
        radius = Number(h.radius);
        if (!Number.isFinite(radius) || radius < 1 || radius > 30) return { error: 'A hazard radius must be between 1 and 30.' };
      }
      value.hotspots.push({ x, y, label, explanation: cleanText(h.explanation, 1000) || null, points, radius });
    }
    return { value };
  }

  if (puzzleType === 'sequence') {
    if (!Array.isArray(b.items) || b.items.length < 3 || b.items.length > 10) {
      return { error: 'A sequence needs between 3 and 10 steps.' };
    }
    for (const it of b.items) {
      const text = cleanText(it && it.text, 300);
      if (!text) return { error: 'Every step needs some text.' };
      value.items.push({ text, explanation: cleanText(it.explanation, 500) || null, category: null });
    }
    return { value };
  }

  // match
  if (!Array.isArray(b.categories) || b.categories.length < 2 || b.categories.length > 5) {
    return { error: 'A matching puzzle needs between 2 and 5 categories.' };
  }
  const categories = b.categories.map((c) => cleanText(c, 60));
  if (categories.some((c) => !c) || new Set(categories).size !== categories.length) {
    return { error: 'Category names must be filled in and different from each other.' };
  }
  if (!Array.isArray(b.items) || b.items.length < 4 || b.items.length > 16) {
    return { error: 'A matching puzzle needs between 4 and 16 items.' };
  }
  for (const it of b.items) {
    const text = cleanText(it && it.text, 300);
    if (!text) return { error: 'Every item needs some text.' };
    const category = cleanText(it.category, 60);
    if (!categories.includes(category)) return { error: 'Every item must belong to one of the categories.' };
    value.items.push({ text, explanation: cleanText(it.explanation, 500) || null, category });
  }
  const used = new Set(value.items.map((i) => i.category));
  if (categories.some((c) => !used.has(c))) return { error: 'Every category needs at least one item.' };
  value.categories = categories;
  return { value };
}

function parseConfig(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch (e) { return {}; }
}

module.exports = {
  PUZZLE_TYPES,
  WRONG_MARK_PENALTY,
  EXTRA_MARKS,
  DEFAULT_RADIUS,
  COOLDOWN_HOURS,
  TIMER_GRACE_SEC,
  angularDistanceDeg,
  planarDistance,
  maxMarksFor,
  validateMarks,
  scoreHunt,
  validateOrder,
  scoreSequence,
  validateAnswers,
  scoreMatch,
  shuffled,
  shuffledNotSolved,
  newItemKey,
  attemptsInfo,
  sessionTiming,
  validatePuzzlePayload,
  parseConfig,
};