// College.jsx: the college dashboard. Post updates, run weekly challenges, see the
// leaderboard, give rewards to winners, and approve tree photos.
import { useState } from 'react';
import { METRICS } from '../lib/campus.js';
import { useCampusApi } from '../lib/campusApi.js';
import { readUserData } from '../lib/store.js';
import { dailyNets, savedVsUsual, dayKey, addDays } from '../lib/calc.js';
import Leaderboard, { formatScore } from '../components/Leaderboard.jsx';
import { StatusPill } from './Campus.jsx';
import { DEMO_COLLEGE } from '../data/demoCampus.js';
import DemoFill from '../components/DemoFill.jsx';

const SECTIONS = [
  ['overview', 'Overview'], ['challenges', 'Challenges'], ['proofs', 'Tree photos'], ['updates', 'Updates'],
];
const day = (key) => new Date(key + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const when = (ts) => new Date(ts).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

export default function College() {
  const campus = useCampusApi();
  const [section, setSection] = useState('overview');
  const [name, setName] = useState(null); // college name while being edited
  const pending = campus.proofs.filter((p) => p.status === 'pending').length;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm text-ink-soft">College dashboard</p>
        <input
          value={name ?? campus.collegeName}
          onChange={(ev) => setName(ev.target.value)}
          onBlur={() => { if (name != null) campus.setCollegeName(name); setName(null); }}
          className="font-display font-bold text-3xl bg-transparent w-full outline-none focus:bg-white rounded-xl"
          aria-label="College name"
        />
        {campus.collegeCode && (
          <p className="text-sm">
            Students join with code <b className="tracking-widest font-display text-lg text-sprout">{campus.collegeCode}</b>
          </p>
        )}
        {campus.error && <p className="text-sm text-con-fg">Database: {campus.error}</p>}
      </div>

      <div className="flex flex-wrap gap-2" role="tablist">
        {SECTIONS.map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={section === id}
            onClick={() => setSection(id)}
            className={`px-4 py-2 rounded-full text-sm font-medium ${section === id ? 'bg-sprout text-white' : 'bg-sky-card hover:bg-sky-line'}`}
          >
            {label}{id === 'proofs' && pending > 0 && ` (${pending})`}
          </button>
        ))}
      </div>

      {section === 'overview' && <Overview campus={campus} />}
      {section === 'challenges' && <Challenges campus={campus} />}
      {section === 'proofs' && <Proofs campus={campus} />}
      {section === 'updates' && <Updates campus={campus} />}
    </div>
  );
}

function Overview({ campus }) {
  const today = dayKey(new Date());
  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  const keys = new Set(week);
  const perStudent = campus.students.map((s) => {
    if (campus.mode === 'cloud') {
      // Online: only the daily totals each student shares
      const rows = campus.stats.filter((r) => r.user_id === s.id && keys.has(r.day));
      return {
        ...s,
        net: rows.reduce((t, r) => t + Number(r.net), 0),
        saved: rows.reduce((t, r) => t + Number(r.saved), 0),
        active: rows.length > 0,
      };
    }
    const d = readUserData(s.id);
    const nets = dailyNets(d.activities, d.trees, d.settings, today, 7);
    return {
      ...s,
      net: nets.reduce((t, x) => t + x.net, 0),
      saved: savedVsUsual(d.activities.filter((a) => keys.has(dayKey(a.ts))), d.settings),
      active: nets.some((x) => x.gross > 0 || x.credits > 0),
    };
  });
  const approvedTrees = campus.proofs.filter((p) => p.status === 'approved').length;
  const sum = (k) => perStudent.reduce((t, s) => t + s[k], 0);

  return (
    <div className="space-y-5">
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Students active this week" value={`${perStudent.filter((s) => s.active).length}/${perStudent.length}`} />
        <Stat label="Campus net this week" value={`${sum('net').toFixed(1)} kg`} />
        <Stat label="Saved vs usual" value={`${sum('saved').toFixed(1)} kg`} />
        <Stat label="Trees approved" value={approvedTrees} />
      </section>

      <section className="rounded-3xl bg-white border border-sky-line p-5 space-y-3">
        <div>
          <h2 className="font-display font-semibold text-xl">This week's leaderboard</h2>
          <p className="text-sm text-ink-soft">Lowest average net footprint per day, last 7 days.</p>
        </div>
        <Leaderboard rows={campus.leaderboard(null)} metric="low_net" />
      </section>

      <section className="rounded-3xl bg-white border border-sky-line p-5 space-y-2">
        <h2 className="font-display font-semibold text-xl">Students</h2>
        {perStudent.map((s) => (
          <div key={s.id} className="flex justify-between text-sm border-b border-sky-line last:border-0 py-1.5">
            <span className="font-medium">{s.name}</span>
            <span className="tabular-nums text-ink-soft">{s.net.toFixed(1)} kg net · {s.saved.toFixed(1)} kg saved</span>
          </div>
        ))}
        <DemoContent campus={campus} />
        {campus.mode === 'local' && <DemoFill />}
        <p className="text-xs text-ink-soft">
          {campus.mode === 'cloud' ? `Students sign up as Student and join with your code${campus.collegeCode ? ` ${campus.collegeCode}` : ''}.` : 'Students add themselves on the Campus screen.'}
        </p>
      </section>
    </div>
  );
}

function Challenges({ campus }) {
  const [form, setForm] = useState({ title: '', metric: 'low_net', reward: '', winners: 1, days: 7 });
  const [done, setDone] = useState(null);
  const change = (k) => (ev) => setForm({ ...form, [k]: ev.target.value });

  function create(ev) {
    ev.preventDefault();
    if (!form.title.trim() || !form.reward.trim()) return;
    campus.createChallenge({ ...form, winners: Number(form.winners), days: Number(form.days) });
    setForm({ ...form, title: '', reward: '' });
  }

  async function end(c) {
    const rewards = await campus.closeChallenge(c.id);
    setDone(rewards.length
      ? `Rewards given: ${rewards.map((r) => `#${r.rank} ${campus.studentName(r.studentId)}`).join(', ')}. They'll see it on their Campus screen.`
      : 'Nobody qualified, so no reward was given.');
  }

  return (
    <div className="space-y-5">
      <form onSubmit={create} className="rounded-3xl bg-sun p-5 space-y-3">
        <h2 className="font-display font-semibold text-xl text-sun-dark">Launch a challenge</h2>
        <input value={form.title} onChange={change('title')} placeholder="Name, e.g. Meat-free week" className="field w-full" />
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="text-sm space-y-1">
            <span className="text-sun-dark">Winner is</span>
            <select value={form.metric} onChange={change('metric')} className="field w-full">
              {Object.entries(METRICS).map(([id, m]) => <option key={id} value={id}>{m.label}</option>)}
            </select>
          </label>
          <label className="text-sm space-y-1">
            <span className="text-sun-dark">Reward</span>
            <input value={form.reward} onChange={change('reward')} placeholder="e.g. Free canteen meal" className="field w-full" />
          </label>
          <label className="text-sm space-y-1">
            <span className="text-sun-dark">Winners</span>
            <select value={form.winners} onChange={change('winners')} className="field w-full">
              <option value={1}>Top 1</option><option value={2}>Top 2</option><option value={3}>Top 3</option>
            </select>
          </label>
          <label className="text-sm space-y-1">
            <span className="text-sun-dark">Length</span>
            <select value={form.days} onChange={change('days')} className="field w-full">
              <option value={1}>1 day</option><option value={3}>3 days</option><option value={7}>7 days</option><option value={14}>14 days</option>
            </select>
          </label>
        </div>
        <p className="text-xs text-sun-dark">{METRICS[form.metric].hint}. Starts today.</p>
        <button className="px-6 py-2.5 rounded-full bg-sprout text-white font-semibold hover:bg-sprout-dark">Launch</button>
      </form>

      {done && <p className="rounded-2xl bg-pro-bg text-pro-fg px-4 py-3 text-sm">{done}</p>}

      {campus.challenges.length === 0 && <p className="text-sm text-ink-soft">No challenges yet.</p>}
      {campus.challenges.map((c) => {
        const rows = campus.leaderboard(c);
        const winners = campus.rewards.filter((r) => r.challengeId === c.id);
        return (
          <section key={c.id} className="rounded-3xl bg-white border border-sky-line p-5 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-lg">{c.title}</p>
                <p className="text-xs text-ink-soft">{METRICS[c.metric].label} · {day(c.startDate)} to {day(c.endDate)} · 🎁 {c.reward} for top {c.winners}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${c.status === 'active' ? 'bg-pro-bg text-pro-fg' : 'bg-sky-card text-ink-soft'}`}>
                {c.status === 'active' ? 'Running' : 'Ended'}
              </span>
            </div>
            <Leaderboard rows={rows} metric={c.metric} />
            {c.status === 'active' ? (
              <div className="flex flex-wrap gap-2">
                <button onClick={() => end(c)} className="px-5 py-2 rounded-full bg-sprout text-white font-semibold">End and give rewards</button>
                <button onClick={() => campus.removeChallenge(c.id)} className="px-4 py-2 rounded-full text-con-fg font-semibold hover:bg-con-bg">Delete</button>
              </div>
            ) : (
              <p className="text-sm">
                {winners.length ? <>Rewarded: {[...winners].sort((a, b) => a.rank - b.rank)
                  .map((w) => `#${w.rank} ${campus.studentName(w.studentId)} (${formatScore(c.metric, rows.find((r) => r.studentId === w.studentId)?.value ?? null)})`)
                  .join(', ')}</> : 'No winners.'}
              </p>
            )}
          </section>
        );
      })}
    </div>
  );
}

function Proofs({ campus }) {
  const sorted = [...campus.proofs].sort((a, b) => (a.status === 'pending' ? -1 : 1) - (b.status === 'pending' ? -1 : 1));
  if (sorted.length === 0) return <p className="text-sm text-ink-soft">No tree photos yet. They appear here when a student logs a tree.</p>;
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      {sorted.map((p) => (
        <section key={p.id} className="rounded-3xl bg-white border border-sky-line p-3 space-y-2">
          <img src={p.photo} alt={`Tree photo from ${campus.studentName(p.studentId)}`} className="w-full aspect-[4/3] object-cover rounded-2xl" />
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold">{campus.studentName(p.studentId)}</p>
            <StatusPill status={p.status} />
          </div>
          <p className="text-xs text-ink-soft">{when(p.ts)}</p>
          <p className={`text-sm rounded-xl px-3 py-2 ${p.ai?.ok === true ? 'bg-pro-bg text-pro-fg' : p.ai?.ok === false ? 'bg-con-bg text-con-fg' : 'bg-sky-card'}`}>
            {p.ai ? `AI says ${p.ai.ok === true ? 'looks real' : p.ai.ok === false ? 'doubtful' : 'not sure'}: ${p.ai.reason}` : 'AI check running…'}
          </p>
          {p.status === 'pending' ? (
            <div className="flex gap-2">
              <button onClick={() => campus.reviewProof(p.id, 'approved')} className="flex-1 py-2 rounded-full bg-sprout text-white font-semibold">Approve</button>
              <button onClick={() => campus.reviewProof(p.id, 'rejected')} className="flex-1 py-2 rounded-full bg-con-bg text-con-fg font-semibold">Reject</button>
            </div>
          ) : (
            <button onClick={() => campus.reviewProof(p.id, 'pending')} className="text-sm text-ink-soft underline">Undo</button>
          )}
        </section>
      ))}
    </div>
  );
}

function Updates({ campus }) {
  const [text, setText] = useState('');
  return (
    <div className="space-y-4">
      <form
        onSubmit={(ev) => { ev.preventDefault(); if (text.trim()) { campus.postUpdate(text); setText(''); } }}
        className="rounded-3xl bg-white border border-sky-line p-5 space-y-3"
      >
        <h2 className="font-display font-semibold text-xl">Post an update</h2>
        <textarea
          value={text}
          onChange={(ev) => setText(ev.target.value)}
          rows={3}
          placeholder="e.g. Tree planting drive this Saturday at 8 am near the main gate. Bring a friend!"
          className="field w-full"
        />
        <button className="px-6 py-2.5 rounded-full bg-sprout text-white font-semibold">Post to students</button>
      </form>
      {campus.updates.map((u) => (
        <div key={u.id} className="rounded-2xl bg-sky-card px-4 py-3 flex gap-3">
          <div className="flex-1">
            <p className="text-xs text-ink-soft">{when(u.ts)}</p>
            <p className="text-sm whitespace-pre-line">{u.text}</p>
          </div>
          <button onClick={() => campus.removeUpdate(u.id)} className="text-ink-soft text-sm" aria-label="Delete update">×</button>
        </div>
      ))}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-2xl bg-sky-card px-3 py-3">
      <p className="text-xs text-ink-soft leading-tight">{label}</p>
      <p className="font-display font-bold text-2xl tabular-nums">{value}</p>
    </div>
  );
}

// For the presentation: posts the demo updates and launches the demo challenges in one tap
function DemoContent({ campus }) {
  const [state, setState] = useState(null);
  if (campus.updates.length > 0 || campus.challenges.length > 0) return null;
  return (
    <button
      disabled={state === 'busy'}
      onClick={async () => {
        setState('busy');
        for (const text of [...DEMO_COLLEGE.updates].reverse()) await campus.postUpdate(text);
        for (const c of DEMO_COLLEGE.challenges) await campus.createChallenge(c);
        setState('done');
      }}
      className="mt-2 px-4 py-2 rounded-full bg-sun text-sun-dark text-sm font-semibold"
    >
      {state === 'busy' ? 'Adding…' : 'Add demo updates and challenges'}
    </button>
  );
}
