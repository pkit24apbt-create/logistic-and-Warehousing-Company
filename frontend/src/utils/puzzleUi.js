// Small, pure helpers shared by the puzzle screens (no React, so they can be tested).

export const PUZZLE_TYPES = {
  hazard_hunt: {
    label: 'Hazard hunt',
    short: 'Photo',
    blurb: 'Find the hazards hidden in a photo of the workplace.',
  },
  hazard_hunt_360: {
    label: '360° hazard hunt',
    short: '360°',
    blurb: 'Look all the way around the warehouse and mark every hazard you can see.',
  },
  sequence: {
    label: 'Put in order',
    short: 'Order',
    blurb: 'Put the safety steps into the correct order.',
  },
  match: {
    label: 'Match and sort',
    short: 'Match',
    blurb: 'Sort each item into the right category.',
  },
};

export function typeInfo(type) {
  return PUZZLE_TYPES[type] || PUZZLE_TYPES.hazard_hunt;
}

export function isHunt(type) {
  return type === 'hazard_hunt' || type === 'hazard_hunt_360';
}

// "5 hazards to find", "7 steps to put in order", "8 items to sort"
export function sizeLabel(type, count) {
  const n = Number(count) || 0;
  if (isHunt(type)) return `${n} hazard${n === 1 ? '' : 's'} to find`;
  if (type === 'sequence') return `${n} step${n === 1 ? '' : 's'} to put in order`;
  return `${n} item${n === 1 ? '' : 's'} to sort`;
}

// Returns a NEW list with the item at `from` moved to `to`. Invalid moves change nothing.
export function moveItem(list, from, to) {
  if (!Array.isArray(list)) return [];
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list.slice();
  const next = list.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function formatClock(totalSeconds) {
  const s = Math.max(0, Math.round(Number(totalSeconds) || 0));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

// How long a finished attempt took, in words: "45 seconds", "2 min 05 s".
export function describeDuration(totalSeconds) {
  const s = Math.max(0, Math.round(Number(totalSeconds) || 0));
  if (s < 60) return `${s} second${s === 1 ? '' : 's'}`;
  return `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s`;
}

// The browser's clock may be wrong, so the deadline is worked out from how much
// time the SERVER says has already gone, measured from the moment the answer arrived.
export function computeDeadline({ timeLimitSec, startedAt, serverTime, receivedAtMs }) {
  if (!timeLimitSec) return null;
  const alreadyMs = Math.max(0, Date.parse(serverTime) - Date.parse(startedAt)) || 0;
  return receivedAtMs + timeLimitSec * 1000 - alreadyMs;
}

export function remainingSeconds(deadlineMs, nowMs) {
  if (deadlineMs === null || deadlineMs === undefined) return null;
  return Math.max(0, Math.ceil((deadlineMs - nowMs) / 1000));
}

// "3 of 3 attempts left today", "No attempts left", "Unlimited attempts"
export function attemptsLabel(attempts) {
  if (!attempts) return '';
  if (attempts.unlimited) return 'Unlimited attempts';
  if (attempts.left <= 0) return 'No attempts left for now';
  return `${attempts.left} of ${attempts.max} attempt${attempts.max === 1 ? '' : 's'} left today`;
}

// "You can try again in 3 h 20 min"
export function retryLabel(retryAt, nowMs = Date.now()) {
  if (!retryAt) return '';
  const ms = Date.parse(retryAt) - nowMs;
  if (!(ms > 0)) return 'You can try again now.';
  const totalMin = Math.ceil(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `You can try again in ${m} min.`;
  return `You can try again in ${h} h ${String(m).padStart(2, '0')} min.`;
}

export function scoreVerdict(score) {
  if (score >= 85) return { label: 'Excellent', color: '#16A34A', bg: '#DCFCE7' };
  if (score >= 70) return { label: 'Well done', color: '#0F766E', bg: '#CCFBF1' };
  if (score >= 50) return { label: 'Getting there', color: '#B45309', bg: '#FEF3C7' };
  return { label: 'Keep practising', color: '#DC2626', bg: '#FEE2E2' };
}

export const MARK_COLOURS = {
  placed: '#0F766E',
  found: '#16A34A',
  duplicate: '#86EFAC',
  wrong: '#6B7280',
  missed: '#DC2626',
};

// What to draw on a hunt: the learner's marks (while playing every mark is
// "placed"; after submitting each one carries its outcome) plus any hazards the
// server chose to reveal that were missed. Used for the flat photo AND the 360 view.
export function huntDisplayMarks(marks, details) {
  if (!details) return marks.map((m) => ({ x: m.x, y: m.y, status: 'placed' }));
  const statuses = details.markStatus || [];
  const out = marks.map((m, i) => ({ x: m.x, y: m.y, status: statuses[i] || 'wrong' }));
  (details.hotspots || []).forEach((h) => {
    if (!h.found && !h.hidden) out.push({ x: h.x, y: h.y, status: 'missed', label: h.label });
  });
  return out;
}

// The same list in the shape the 360 viewer draws.
export function overlayFromDisplay(display) {
  return display.map((d) => ({
    x: d.x,
    y: d.y,
    color: MARK_COLOURS[d.status] || MARK_COLOURS.wrong,
    size: d.status === 'missed' ? 11 : 9,
  }));
}

export function canPlaceMore(marks, maxMarks) {
  return marks.length < maxMarks;
}

// How many items of a match puzzle have been sorted.
export function sortedCount(items, answers) {
  return items.filter((i) => answers[i.key]).length;
}