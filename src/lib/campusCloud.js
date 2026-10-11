// campusCloud.js: the college features when logged in (Supabase). Same shape as the
// on-device version in campus.js, so the Campus and College screens work with either.
import { useEffect, useSyncExternalStore } from 'react';
import { supabase } from './supabase.js';
import { getAuth } from './cloud.js';
import { METRICS } from './campus.js';
import { dayKey, addDays } from './calc.js';

let data = { ready: false, students: [], stats: [], updates: [], challenges: [], rewards: [], proofs: [], error: null };
const listeners = new Set();
function set(changes) {
  data = { ...data, ...changes };
  listeners.forEach((fn) => fn());
}

// Fetch everything this person may see (the database rules filter it)
export async function refreshCampus() {
  const { profile } = getAuth();
  if (!profile?.college_id) return set({ ready: true });
  const since = addDays(dayKey(new Date()), -60);
  const [students, stats, updates, challenges, rewards, proofs] = await Promise.all([
    supabase.from('profiles').select('id, name, role').eq('college_id', profile.college_id).eq('role', 'student').order('name'),
    supabase.from('daily_stats').select('*').gte('day', since),
    supabase.from('updates').select('*').order('created_at', { ascending: false }).limit(50),
    supabase.from('challenges').select('*').order('created_at', { ascending: false }),
    supabase.from('rewards').select('*').order('created_at', { ascending: false }),
    supabase.from('proofs').select('*').order('created_at', { ascending: false }).limit(100),
  ]);
  const firstError = [students, stats, updates, challenges, rewards, proofs].find((r) => r.error)?.error;
  set({
    ready: true,
    error: firstError ? firstError.message : null,
    students: students.data ?? [],
    stats: stats.data ?? [],
    updates: (updates.data ?? []).map((u) => ({ id: u.id, ts: u.created_at, text: u.text })),
    challenges: (challenges.data ?? []).map((c) => ({
      id: c.id, title: c.title, metric: c.metric, reward: c.reward, winners: c.winners,
      startDate: c.start_date, endDate: c.end_date, status: c.status,
    })),
    rewards: (rewards.data ?? []).map((r) => ({
      id: r.id, studentId: r.student_id, challengeId: r.challenge_id, reward: r.reward, rank: r.rank, ts: r.created_at,
    })),
    proofs: (proofs.data ?? []).map((p) => ({
      id: p.id, studentId: p.student_id, activityId: p.activity_id, day: p.day, ts: p.created_at,
      photo: p.photo, ai: p.ai, status: p.status,
    })),
  });
}

function challengeDays(ch, today = dayKey(new Date())) {
  const end = ch.endDate < today ? ch.endDate : today;
  const days = [];
  for (let d = ch.startDate; d <= end; d = addDays(d, 1)) days.push(d);
  return days;
}

function scoreFor(studentId, metric, days) {
  const keys = new Set(days);
  const rows = data.stats.filter((s) => s.user_id === studentId && keys.has(s.day));
  const trees = data.proofs.filter((p) => p.studentId === studentId && p.status === 'approved' && keys.has(p.day)).length;
  if (metric === 'low_net') {
    if (rows.length === 0) return { value: null, eligible: false };
    return { value: rows.reduce((t, r) => t + Number(r.net), 0) / rows.length, eligible: true };
  }
  if (metric === 'saved') {
    const v = rows.reduce((t, r) => t + Number(r.saved), 0);
    return { value: v, eligible: v > 0 };
  }
  if (metric === 'trees') return { value: trees, eligible: trees > 0 };
  const v = rows.reduce((t, r) => t + r.eco_actions, 0) + trees;
  return { value: v, eligible: v > 0 };
}

function leaderboard(ch) {
  const metric = ch?.metric ?? 'low_net';
  const days = ch ? challengeDays(ch) : Array.from({ length: 7 }, (_, i) => addDays(dayKey(new Date()), i - 6));
  const better = METRICS[metric].better;
  return data.students
    .map((s) => ({ studentId: s.id, name: s.name, ...scoreFor(s.id, metric, days) }))
    .sort((a, b) => {
      if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
      if (!a.eligible) return 0;
      return better === 'low' ? a.value - b.value : b.value - a.value;
    });
}

// Run a database write, then fetch again so every screen shows the new state
async function write(promise) {
  const { error } = await promise;
  if (error) { set({ error: error.message }); throw error; }
  await refreshCampus();
}

const actions = {
  async setCollegeName(name) {
    const { college } = getAuth();
    if (college && name.trim().length >= 2) await supabase.from('colleges').update({ name: name.trim() }).eq('id', college.id);
  },
  postUpdate: (text) => write(supabase.from('updates').insert({ college_id: getAuth().profile.college_id, text: text.trim() })),
  removeUpdate: (id) => write(supabase.from('updates').delete().eq('id', id)),
  createChallenge: ({ title, metric, reward, winners = 1, days = 7 }) => {
    const startDate = dayKey(new Date());
    return write(supabase.from('challenges').insert({
      college_id: getAuth().profile.college_id, title: title.trim(), metric, reward: reward.trim(),
      winners: Math.min(3, Math.max(1, winners)), start_date: startDate, end_date: addDays(startDate, days - 1),
    }));
  },
  async closeChallenge(id) {
    const ch = data.challenges.find((c) => c.id === id);
    const board = leaderboard(ch).filter((r) => r.eligible).slice(0, ch.winners);
    const collegeId = getAuth().profile.college_id;
    const rewards = board.map((r, i) => ({ college_id: collegeId, challenge_id: id, student_id: r.studentId, reward: ch.reward, rank: i + 1 }));
    if (rewards.length) await write(supabase.from('rewards').insert(rewards));
    await write(supabase.from('challenges').update({ status: 'closed' }).eq('id', id));
    return rewards.map((r) => ({ studentId: r.student_id, rank: r.rank }));
  },
  removeChallenge: (id) => write(supabase.from('challenges').delete().eq('id', id)),
  reviewProof: (id, status) => write(supabase.from('proofs').update({ status }).eq('id', id)),
  async addProof({ activityId, photo, day }) {
    const { profile } = getAuth();
    const { data: row, error } = await supabase.from('proofs')
      .insert({ college_id: profile.college_id, student_id: profile.id, activity_id: activityId, day, photo })
      .select('id').single();
    if (error) { set({ error: error.message }); return null; }
    await refreshCampus();
    return row.id;
  },
  setProofAi: (id, ai) => id && write(supabase.from('proofs').update({ ai }).eq('id', id)),
};

// The hook the screens use
export function useCampusCloud() {
  const d = useSyncExternalStore((fn) => { listeners.add(fn); return () => listeners.delete(fn); }, () => data);
  useEffect(() => {
    refreshCampus();
    const t = setInterval(refreshCampus, 10000); // pick up other people's changes, like a college reviewing a photo
    const onFocus = () => refreshCampus();
    const onVisible = () => { if (document.visibilityState === 'visible') refreshCampus(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(t);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);
  const { profile, college } = getAuth();
  return {
    mode: 'cloud',
    ...d,
    me: profile?.id,
    role: profile?.role,
    collegeName: college?.name ?? 'No college yet',
    collegeCode: college?.code ?? null,
    hasCollege: Boolean(profile?.college_id),
    leaderboard,
    studentName: (id) => d.students.find((s) => s.id === id)?.name ?? 'Student',
    ...actions,
  };
}
