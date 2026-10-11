// cloud.js: login and saving to Supabase.
//   - signUp / signIn / signOut with email and password
//   - after login, your data loads from the database, and every change is saved back
//   - each student also shares small daily totals (net, saved, eco actions) with their college,
//     which is all the leaderboard needs. Entries themselves stay private.
import { useSyncExternalStore } from 'react';
import { supabase, cloudEnabled } from './supabase.js';
import { switchUser, replaceAll, setOnSave, getState } from './store.js';
import { dailyNets, savedVsUsual, dayKey } from './calc.js';

let auth = { loading: cloudEnabled, user: null, profile: null, college: null, error: null };
const listeners = new Set();
function setAuth(changes) {
  auth = { ...auth, ...changes };
  listeners.forEach((fn) => fn());
}
export function useAuth() {
  return useSyncExternalStore((fn) => { listeners.add(fn); return () => listeners.delete(fn); }, () => auth);
}
export const getAuth = () => auth;

// ---------- sign up, sign in, sign out ----------
// role "college": collegeName makes a new college (and a join code).
// role "student": code joins an existing college (optional, can be added later).
export async function signUp({ email, password, name, role, collegeName, code }) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  if (!data.session) throw new Error('Check your email to confirm the account, or turn off "Confirm email" in Supabase.');
  const userId = data.user.id;
  const { error: pErr } = await supabase.from('profiles').insert({ id: userId, name: name.trim(), role });
  if (pErr) throw pErr;
  if (role === 'college') {
    const { error: cErr } = await supabase.rpc('create_college', { p_name: collegeName.trim() });
    if (cErr) throw cErr;
  } else if (code?.trim()) {
    const { error: jErr } = await supabase.rpc('join_college', { p_code: code.trim() });
    if (jErr) throw jErr;
  }
  await afterLogin(data.user);
}

export async function signIn({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  await afterLogin(data.user);
}

export async function signOut() {
  setOnSave(null);
  await supabase.auth.signOut();
  switchUser('me');
  setAuth({ user: null, profile: null, college: null });
}

export async function joinCollege(code) {
  const { error } = await supabase.rpc('join_college', { p_code: code.trim() });
  if (error) throw error;
  await loadProfile(auth.user.id);
  pushNow(getState());
}

async function loadProfile(userId) {
  const { data: profile, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) throw error;
  let college = null;
  if (profile?.college_id) {
    const { data } = await supabase.from('colleges').select('*').eq('id', profile.college_id).maybeSingle();
    college = data;
  }
  setAuth({ profile, college });
  return profile;
}

// Load this person's data from the cloud (or upload what this device has, the first time)
async function afterLogin(user) {
  let profile;
  try {
    profile = await loadProfile(user.id);
  } catch (err) {
    await supabase.auth.signOut();
    throw err;
  }
  if (!profile) {
    await supabase.auth.signOut();
    throw new Error('This account has no profile. Run supabase.sql in Supabase, then create the account again.');
  }
  setAuth({ user, error: null });
  switchUser(user.id);
  const { data } = await supabase.from('user_data').select('data').eq('user_id', user.id).maybeSingle();
  if (data?.data?.activities) replaceAll(data.data, { push: false });
  setOnSave(schedulePush);
  if (!data) pushNow(getState());
}

// Called once when the app opens: if someone is already logged in, carry on
export async function restoreSession() {
  if (!cloudEnabled) return;
  try {
    const { data } = await supabase.auth.getSession();
    if (data.session?.user) await afterLogin(data.session.user);
  } catch (err) {
    setAuth({ error: err.message });
  }
  setAuth({ loading: false });
}

// ---------- saving ----------
let timer = null;
let saving = Promise.resolve();
function schedulePush(state) {
  clearTimeout(timer);
  timer = setTimeout(() => pushNow(state), 800); // wait for a pause in typing or tapping
}

// The daily totals shared with the college: last 35 days, only days with something logged
export function dailyStatsRows(state, userId, collegeId, endDate = new Date()) {
  const nets = dailyNets(state.activities, state.trees, state.settings, endDate, 35);
  return nets
    .filter((d) => d.gross > 0 || d.credits > 0)
    .map((d) => {
      const acts = state.activities.filter((a) => dayKey(a.ts) === d.date);
      return {
        user_id: userId,
        college_id: collegeId ?? null,
        day: d.date,
        net: Math.round(d.net * 1000) / 1000,
        gross: Math.round(d.gross * 1000) / 1000,
        saved: Math.round(savedVsUsual(acts, state.settings) * 1000) / 1000,
        eco_actions: acts.filter((a) => a.sector === 'eco' && a.item !== 'tree').length,
      };
    });
}

function pushNow(state) {
  const userId = auth.user?.id;
  if (!userId) return saving;
  saving = saving.then(async () => {
    const { activities, trees, settings, quests } = state;
    const { error } = await supabase.from('user_data')
      .upsert({ user_id: userId, data: { activities, trees, settings, quests }, updated_at: new Date().toISOString() });
    const rows = dailyStatsRows(state, userId, auth.profile?.college_id);
    // Clear the 35-day window, then write the current totals (so deleted entries disappear too)
    const start = new Date(Date.now() - 34 * 86400000).toISOString().slice(0, 10);
    await supabase.from('daily_stats').delete().eq('user_id', userId).gte('day', start);
    if (rows.length) await supabase.from('daily_stats').upsert(rows);
    setAuth({ error: error ? `Couldn't save online: ${error.message}` : null, savedAt: new Date() });
  }).catch((err) => setAuth({ error: `Couldn't save online: ${err.message}` }));
  return saving;
}
