// store.js: saves everything in the browser's localStorage under the key "terratrack.v1".
// There is no server and no account: the data stays on this device.
//
// What we keep:
//   activities: every saved entry  { id, ts, sector, item, qty, kg, kind, note }
//   trees:      every planted tree { id, plantedOn }
//   settings:   budget, usual commute and meal, mic language
//   quests:     which daily quests were done { date, questId, done }
import { useSyncExternalStore } from 'react';
import factors from '../data/emission_factors.json';
import { kgFor, dayKey } from './calc.js';

// Each student on this device has their own data. "me" keeps the original key so old data still loads.
const BASE_KEY = 'terratrack.v1';
export function keyFor(userId) {
  return userId === 'me' ? BASE_KEY : `${BASE_KEY}.${userId}`;
}
function startUser() {
  try {
    return JSON.parse(localStorage.getItem('terratrack.campus.v1'))?.currentStudentId ?? 'me';
  } catch {
    return 'me';
  }
}
let userId = startUser();
let KEY = keyFor(userId);

export const DEFAULT_SETTINGS = {
  dailyBudgetKg: factors.dailyBudgetKg,
  offsetCapShare: factors.offsetCapShare,
  baseline: { ...factors.baselineDefaults },
  language: 'en-IN',
};

function emptyState() {
  return { activities: [], trees: [], settings: DEFAULT_SETTINGS, quests: [] };
}

// Read one student's saved data (used when the app starts, and by the college leaderboard)
export function readUserData(id = userId) {
  return load(keyFor(id));
}

function load(key = KEY) {
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    if (!saved) return emptyState();
    return { ...emptyState(), ...saved, settings: { ...DEFAULT_SETTINGS, ...saved.settings } };
  } catch {
    return emptyState(); // broken or missing data: start fresh
  }
}

// One-time clean start (Step 9): the old demo entries are removed once, settings are kept.
// New demo data for students and a college comes later.
function cleanStartOnce(loaded) {
  const FLAG = 'terratrack.cleanStart';
  try {
    if (localStorage.getItem(FLAG)) return loaded;
    localStorage.setItem(FLAG, 'done');
    const fresh = { ...emptyState(), settings: loaded.settings };
    localStorage.setItem(BASE_KEY, JSON.stringify({ ...fresh }));
    return fresh;
  } catch {
    return loaded;
  }
}

let state = userId === 'me' ? cleanStartOnce(load()) : load();

// Save data for another student on this device (demo campus)
export function writeUserData(id, data) {
  localStorage.setItem(keyFor(id), JSON.stringify({ ...emptyState(), ...data, settings: { ...DEFAULT_SETTINGS, ...data.settings } }));
}

// Switch to another student on this device: their entries, trees and settings load
export function switchUser(id) {
  userId = id;
  KEY = keyFor(id);
  state = load();
  listeners.forEach((fn) => fn());
}

export function currentUserId() {
  return userId;
}
const listeners = new Set();

// Save and tell every screen that the data changed
// cloud.js sets this to push changes to Supabase when someone is logged in
let onSave = null;
export function setOnSave(fn) {
  onSave = fn;
}

function setState(next, { push = true } = {}) {
  state = next;
  if (push && onSave) onSave(state);
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // storage full or blocked: the app still works until the page is closed
  }
  listeners.forEach((fn) => fn());
}

// React hook: any screen that calls useStore() re-draws when the data changes
export function useStore() {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => state
  );
}

export function getState() {
  return state;
}

// A short random id like "a8f3k2"
export function newId(prefix = 'a') {
  return prefix + Math.random().toString(36).slice(2, 8);
}

// Which kind an item is: "emit", "credit" (compost, own bottle, own bag) or "offset" (tree)
export function kindFor(sector, item) {
  if (sector !== 'eco') return 'emit';
  return factors.eco.items[item]?.type === 'offset' ? 'offset' : 'credit';
}

// Save the confirmed entries from the confirm card.
// Each entry is { sector, item, qty }. We work out kg and kind here.
// Planting trees also adds them to the Tree Wallet.
export function saveEntries(entries, when = new Date()) {
  const ts = when.toISOString();
  const newActivities = [];
  const newTrees = [];

  for (const e of entries) {
    const kind = kindFor(e.sector, e.item);
    const activityId = newId('a');
    newActivities.push({
      id: activityId,
      ts,
      sector: e.sector,
      item: e.item,
      qty: e.qty,
      kg: kgFor(e.sector, e.item, e.qty),
      kind,
      note: e.note ?? null,
    });
    if (kind === 'offset') {
      for (let i = 0; i < Math.round(e.qty); i++) {
        newTrees.push({ id: newId('t'), plantedOn: dayKey(when), activityId });
      }
    }
  }

  setState({
    ...state,
    activities: [...state.activities, ...newActivities],
    trees: [...state.trees, ...newTrees],
  });
  return newActivities;
}

export function removeActivity(id) {
  setState({ ...state, activities: state.activities.filter((a) => a.id !== id) });
}

export function addTree(plantedOn) {
  const id = newId('t');
  setState({ ...state, trees: [...state.trees, { id, plantedOn }] });
  return id;
}

// The college rejected (or un-rejected) tree photos: mark those trees and tree entries so they stop counting.
// rejectedIds holds the ids the photos were attached to (a tree from the Wallet, or a "planted a tree" entry).
export function markRejectedTrees(rejectedIds) {
  const isRejected = (t) => rejectedIds.has(t.id) || (t.activityId != null && rejectedIds.has(t.activityId));
  const changed = state.trees.some((t) => Boolean(t.rejected) !== isRejected(t))
    || state.activities.some((a) => a.item === 'tree' && Boolean(a.rejected) !== rejectedIds.has(a.id));
  if (!changed) return;
  setState({
    ...state,
    trees: state.trees.map((t) => ({ ...t, rejected: isRejected(t) })),
    activities: state.activities.map((a) => (a.item === 'tree' ? { ...a, rejected: rejectedIds.has(a.id) } : a)),
  });
}

export function removeTree(id) {
  setState({ ...state, trees: state.trees.filter((t) => t.id !== id) });
}

// Tick (or untick) today's quest
export function setQuestDone(date, questId, done) {
  const others = state.quests.filter((q) => q.date !== date);
  setState({ ...state, quests: done ? [...others, { date, questId, done: true }] : others });
}

export function updateSettings(changes) {
  setState({ ...state, settings: { ...state.settings, ...changes } });
}

// Replace everything at once (demo data, or data loaded from the cloud with push: false)
export function replaceAll(next, options) {
  setState({ ...emptyState(), ...next, settings: { ...DEFAULT_SETTINGS, ...next?.settings } }, options);
}

export function clearAll() {
  setState(emptyState());
}
