// campus.js: the college side. Students, college updates, weekly challenges, rewards and
// tree photo proofs, saved in this browser under "terratrack.campus.v1".
// Everything runs on one device (good for a demo). A real launch would move this to an online database.
import { useSyncExternalStore } from 'react';
import { readUserData, switchUser, newId } from './store.js';
import { dailyNets, savedVsUsual, dayKey, addDays } from './calc.js';

const KEY = 'terratrack.campus.v1';

function emptyCampus() {
  return {
    collegeName: 'My College',
    role: 'student', // "student" or "college"
    currentStudentId: 'me',
    students: [{ id: 'me', name: 'Me' }],
    updates: [], // { id, ts, text }
    challenges: [], // { id, title, metric, reward, winners, startDate, endDate, status }
    rewards: [], // { id, studentId, challengeId, reward, rank, ts }
    proofs: [], // { id, studentId, activityId, ts, photo, ai: { ok, reason } | null, status }
  };
}

function load() {
  try {
    return { ...emptyCampus(), ...JSON.parse(localStorage.getItem(KEY)) };
  } catch {
    return emptyCampus();
  }
}

let campus = load();
const listeners = new Set();

function set(next) {
  campus = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(campus));
  } catch {
    alert('Storage is full. Delete some tree photos or old data.');
  }
  listeners.forEach((fn) => fn());
}

// Another tab on this device changed the campus (e.g. the college tab rejected a photo): load it here too
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY) return;
    campus = load();
    listeners.forEach((fn) => fn());
  });
}

export function useCampus() {
  return useSyncExternalStore((fn) => { listeners.add(fn); return () => listeners.delete(fn); }, () => campus);
}
export const getCampus = () => campus;

// ---------- people and roles ----------
export function setRole(role) {
  set({ ...campus, role });
}
export function setCollegeName(collegeName) {
  set({ ...campus, collegeName });
}
export function addStudent(name) {
  const student = { id: newId('s'), name: name.trim().slice(0, 30) };
  set({ ...campus, students: [...campus.students, student] });
  return student;
}
export function renameStudent(id, name) {
  set({ ...campus, students: campus.students.map((s) => (s.id === id ? { ...s, name } : s)) });
}
export function chooseStudent(id) {
  switchUser(id);
  set({ ...campus, currentStudentId: id });
}
export function studentName(id) {
  return campus.students.find((s) => s.id === id)?.name ?? 'Student';
}

// ---------- updates ----------
export function postUpdate(text) {
  set({ ...campus, updates: [{ id: newId('u'), ts: new Date().toISOString(), text: text.trim() }, ...campus.updates] });
}
export function removeUpdate(id) {
  set({ ...campus, updates: campus.updates.filter((u) => u.id !== id) });
}

// ---------- challenges ----------
export const METRICS = {
  low_net: { label: 'Lowest net per day', unit: 'kg a day', better: 'low', hint: 'Average daily net footprint over the challenge days' },
  saved: { label: 'Most kg saved', unit: 'kg saved', better: 'high', hint: 'Saved vs your usual commute and meal' },
  eco_actions: { label: 'Most eco actions', unit: 'actions', better: 'high', hint: 'Compost, own bottle, bag or cup, and approved trees' },
  trees: { label: 'Most trees planted', unit: 'trees', better: 'high', hint: 'Only trees with an approved photo count' },
};

export function createChallenge({ title, metric, reward, winners = 1, days = 7 }) {
  const startDate = dayKey(new Date());
  const challenge = {
    id: newId('c'), title: title.trim(), metric, reward: reward.trim(),
    winners: Math.min(3, Math.max(1, winners)), startDate, endDate: addDays(startDate, days - 1), status: 'active',
  };
  set({ ...campus, challenges: [challenge, ...campus.challenges] });
}

// End a challenge and give its reward to the top students
export function closeChallenge(id) {
  const ch = campus.challenges.find((c) => c.id === id);
  const board = leaderboard(ch).filter((r) => r.eligible).slice(0, ch.winners);
  const ts = new Date().toISOString();
  const rewards = board.map((r, i) => ({ id: newId('r'), studentId: r.studentId, challengeId: id, reward: ch.reward, rank: i + 1, ts }));
  set({
    ...campus,
    challenges: campus.challenges.map((c) => (c.id === id ? { ...c, status: 'closed' } : c)),
    rewards: [...rewards, ...campus.rewards],
  });
  return rewards;
}
export function removeChallenge(id) {
  set({ ...campus, challenges: campus.challenges.filter((c) => c.id !== id) });
}

// Days of a challenge up to today (a running challenge only counts days so far)
function challengeDays(ch, today = dayKey(new Date())) {
  const end = ch.endDate < today ? ch.endDate : today;
  const days = [];
  for (let d = ch.startDate; d <= end; d = addDays(d, 1)) days.push(d);
  return days;
}

function approvedTreeIds(studentId) {
  return new Set(campus.proofs.filter((p) => p.studentId === studentId && p.status === 'approved').map((p) => p.activityId));
}

// One student's score for a metric over a set of days
export function scoreFor(studentId, metric, days) {
  const data = readUserData(studentId);
  const keys = new Set(days);
  const acts = data.activities.filter((a) => keys.has(dayKey(a.ts)));
  const approved = approvedTreeIds(studentId);
  const treesIn = acts.filter((a) => a.item === 'tree' && approved.has(a.id)).reduce((t, a) => t + a.qty, 0);

  if (metric === 'low_net') {
    const nets = days.length ? dailyNets(data.activities, data.trees, data.settings, days[days.length - 1], days.length) : [];
    const logged = nets.filter((d) => d.gross > 0 || d.credits > 0);
    if (logged.length === 0) return { value: null, eligible: false };
    return { value: logged.reduce((t, d) => t + d.net, 0) / logged.length, eligible: true };
  }
  if (metric === 'saved') {
    const v = savedVsUsual(acts, data.settings);
    return { value: v, eligible: v > 0 };
  }
  if (metric === 'trees') return { value: treesIn, eligible: treesIn > 0 };
  // eco_actions: every eco entry except unapproved trees
  const v = acts.filter((a) => a.sector === 'eco' && a.item !== 'tree').length + treesIn;
  return { value: v, eligible: v > 0 };
}

// Ranked rows for a challenge (or this week's overall board when ch is null)
export function leaderboard(ch) {
  const metric = ch?.metric ?? 'low_net';
  const days = ch ? challengeDays(ch) : Array.from({ length: 7 }, (_, i) => addDays(dayKey(new Date()), i - 6));
  const better = METRICS[metric].better;
  return campus.students
    .map((s) => ({ studentId: s.id, name: s.name, ...scoreFor(s.id, metric, days) }))
    .sort((a, b) => {
      if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
      if (!a.eligible) return 0;
      return better === 'low' ? a.value - b.value : b.value - a.value;
    });
}

// ---------- tree photo proofs ----------
export function addProof({ studentId, activityId, photo }) {
  const proof = { id: newId('p'), studentId, activityId, ts: new Date().toISOString(), photo, ai: null, status: 'pending' };
  set({ ...campus, proofs: [proof, ...campus.proofs] });
  return proof;
}
export function setProofAi(id, ai) {
  set({ ...campus, proofs: campus.proofs.map((p) => (p.id === id ? { ...p, ai } : p)) });
}
export function reviewProof(id, status) {
  set({ ...campus, proofs: campus.proofs.map((p) => (p.id === id ? { ...p, status } : p)) });
}
export function proofForActivity(activityId) {
  return campus.proofs.find((p) => p.activityId === activityId) ?? null;
}

// Replace everything (used by demo data later)
export function replaceCampus(next) {
  set({ ...emptyCampus(), ...next });
}

// The on-device version of the hook the Campus and College screens use (same shape as campusCloud.js)
export function useCampusLocal() {
  const c = useCampus();
  return {
    mode: 'local',
    ready: true,
    error: null,
    ...c,
    me: c.currentStudentId,
    collegeCode: null,
    hasCollege: true,
    leaderboard,
    studentName,
    setCollegeName,
    postUpdate,
    removeUpdate,
    createChallenge,
    closeChallenge: async (id) => closeChallenge(id),
    removeChallenge,
    reviewProof,
    addProof: async ({ activityId, photo }) => addProof({ studentId: c.currentStudentId, activityId, photo }).id,
    setProofAi,
  };
}
