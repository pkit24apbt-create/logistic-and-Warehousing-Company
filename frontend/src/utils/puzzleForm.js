// The trainer's create / edit form for puzzles: defaults, converting to and from
// the server, and checking before saving. Pure functions (no React) so they can be tested.
// The server checks everything again, so these are only for quick, friendly feedback.

import { isHunt } from './puzzleUi';

export const PANORAMA_URL = '/assets/photos/warehouse-360-preview.png';

const blankItem = () => ({ text: '', explanation: '', category: '' });

export function defaultForm(type) {
  const base = { puzzleType: type, title: '', introTips: '', maxAttempts: 3, timeLimitSec: '', imageUrl: '', hotspots: [], items: [], categories: [] };
  if (type === 'hazard_hunt_360') return { ...base, imageUrl: PANORAMA_URL };
  if (type === 'sequence') return { ...base, items: [blankItem(), blankItem(), blankItem()] };
  if (type === 'match') return { ...base, categories: ['Safe', 'Unsafe'], items: [blankItem(), blankItem(), blankItem(), blankItem()] };
  return base;
}

// The server's "manage" answer -> the form
export function formFromManage(data) {
  return {
    puzzleType: data.puzzleType,
    title: data.title || '',
    introTips: data.introTips || '',
    maxAttempts: Number(data.maxAttempts) || 0,
    timeLimitSec: data.timeLimitSec === '' || data.timeLimitSec === null || data.timeLimitSec === undefined ? '' : String(data.timeLimitSec),
    imageUrl: data.imageUrl || '',
    hotspots: (data.hotspots || []).map((h) => ({
      x: Number(h.x), y: Number(h.y), label: h.label || '', explanation: h.explanation || '',
      points: Number(h.points) || 1, radius: h.radius === '' || h.radius === null || h.radius === undefined ? '' : String(h.radius),
    })),
    items: (data.items || []).map((i) => ({ text: i.text || '', explanation: i.explanation || '', category: i.category || '' })),
    categories: data.categories || [],
  };
}

// The form -> what the server expects
export function buildPayload(form) {
  const payload = {
    puzzleType: form.puzzleType,
    title: form.title.trim(),
    introTips: form.introTips.trim(),
    maxAttempts: Number(form.maxAttempts),
    timeLimitSec: form.timeLimitSec === '' || form.timeLimitSec === null ? null : Number(form.timeLimitSec),
  };
  if (isHunt(form.puzzleType)) {
    payload.imageUrl = form.imageUrl.trim();
    payload.hotspots = form.hotspots.map((h) => ({
      x: h.x, y: h.y, label: h.label.trim(), explanation: h.explanation.trim(),
      points: Number(h.points) || 1, radius: h.radius === '' || h.radius === null ? null : Number(h.radius),
    }));
  } else {
    payload.items = form.items.map((i) => ({ text: i.text.trim(), explanation: i.explanation.trim(), category: i.category }));
    if (form.puzzleType === 'match') payload.categories = form.categories.map((c) => c.trim());
  }
  return payload;
}

// Returns '' when the form is fine, otherwise the first problem in plain words.
export function validateForm(form) {
  if (!form.title.trim()) return 'Give the puzzle a title.';
  if (form.timeLimitSec !== '' && form.timeLimitSec !== null) {
    const t = Number(form.timeLimitSec);
    if (!Number.isInteger(t) || t < 15 || t > 3600) return 'The time limit must be a whole number from 15 to 3600 seconds, or empty for none.';
  }

  if (isHunt(form.puzzleType)) {
    if (!form.imageUrl.trim()) return 'Add the image address.';
    if (form.hotspots.length < 1) return 'Place at least one hazard on the image.';
    if (form.hotspots.length > 20) return 'A puzzle can have at most 20 hazards.';
    if (form.hotspots.some((h) => !h.label.trim())) return 'Give every hazard a name.';
    if (form.hotspots.some((h) => h.radius !== '' && (!(Number(h.radius) >= 1) || Number(h.radius) > 30))) return 'A hazard radius must be between 1 and 30.';
    return '';
  }

  if (form.puzzleType === 'sequence') {
    if (form.items.length < 3 || form.items.length > 10) return 'A sequence needs between 3 and 10 steps.';
    if (form.items.some((i) => !i.text.trim())) return 'Every step needs some text.';
    return '';
  }

  const cats = form.categories.map((c) => c.trim());
  if (cats.length < 2 || cats.length > 5) return 'Use between 2 and 5 categories.';
  if (cats.some((c) => !c)) return 'Fill in every category name.';
  if (new Set(cats).size !== cats.length) return 'Category names must all be different.';
  if (form.items.length < 4 || form.items.length > 16) return 'A matching puzzle needs between 4 and 16 items.';
  if (form.items.some((i) => !i.text.trim())) return 'Every item needs some text.';
  if (form.items.some((i) => !cats.includes(i.category.trim()))) return 'Choose the correct category for every item.';
  if (cats.some((c) => !form.items.some((i) => i.category.trim() === c))) return 'Every category needs at least one item.';
  return '';
}

// "5 hazards · 3 attempts a day · 2:00 timer" for the list of puzzles
export function describeSettings(scene) {
  const parts = [];
  parts.push(scene.max_attempts === 0 ? 'unlimited attempts' : `${scene.max_attempts} attempt${scene.max_attempts === 1 ? '' : 's'} a day`);
  if (scene.time_limit_sec) parts.push(`${Math.floor(scene.time_limit_sec / 60)}:${String(scene.time_limit_sec % 60).padStart(2, '0')} timer`);
  return parts.join(' · ');
}