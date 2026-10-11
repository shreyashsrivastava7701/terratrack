// Campus.jsx: the student's view of their college. Updates, challenges with live rank,
// this week's leaderboard, rewards won, and the status of tree photos.
import { useState } from 'react';
import { useStore } from '../lib/store.js';
import { chooseStudent, addStudent, METRICS } from '../lib/campus.js';
import { useCampusApi } from '../lib/campusApi.js';
import { useAuth, joinCollege } from '../lib/cloud.js';
import Leaderboard from '../components/Leaderboard.jsx';
import { itemLabel } from '../data/labels.js';

const when = (ts) => new Date(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const day = (key) => new Date(key + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

export default function Campus() {
  useStore(); // re-draw when this student's entries change
  const campus = useCampusApi();
  const { leaderboard, studentName } = campus;
  const me = campus.me;
  const [newName, setNewName] = useState('');
  const [code, setCode] = useState('');
  const [joinError, setJoinError] = useState(null);
  useAuth(); // re-draw after joining a college

  const active = campus.challenges.filter((c) => c.status === 'active');
  const myRewards = campus.rewards.filter((r) => r.studentId === me);
  const myProofs = campus.proofs.filter((p) => p.studentId === me);
  const weekBoard = leaderboard(null);

  // Logged in but not in a college yet: join with the code from the college
  if (campus.mode === 'cloud' && !campus.hasCollege) {
    return (
      <div className="space-y-5">
        <h1 className="font-display font-bold text-3xl">Campus</h1>
        <form
          onSubmit={async (ev) => {
            ev.preventDefault();
            setJoinError(null);
            try { await joinCollege(code); } catch (err) { setJoinError(err.message); }
          }}
          className="rounded-3xl bg-sky-card p-5 space-y-3"
        >
          <p className="font-semibold">Join your college</p>
          <p className="text-sm text-ink-soft">Ask your college for its 6-character TerraTrack code.</p>
          <div className="flex gap-2">
            <input value={code} onChange={(ev) => setCode(ev.target.value.toUpperCase())} maxLength={6} placeholder="e.g. 7F3K9A" className="field flex-1 min-w-0 tracking-widest font-semibold" />
            <button className="px-5 rounded-full bg-sprout text-white font-semibold">Join</button>
          </div>
          {joinError && <p className="text-sm text-con-fg">{joinError}</p>}
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm text-ink-soft">{campus.collegeName}</p>
        <h1 className="font-display font-bold text-3xl">Campus</h1>
      </div>

      {/* Who is using the app on this device (on-device mode only; with login, you are you) */}
      {campus.mode === 'local' && <section className="rounded-3xl bg-sky-card p-4 space-y-3">
        <label className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-ink-soft">Logged in as</span>
          <select value={me} onChange={(ev) => chooseStudent(ev.target.value)} className="field py-2 font-semibold">
            {campus.students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <form
          onSubmit={(ev) => {
            ev.preventDefault();
            if (!newName.trim()) return;
            const s = addStudent(newName);
            setNewName('');
            chooseStudent(s.id);
          }}
          className="flex gap-2"
        >
          <input value={newName} onChange={(ev) => setNewName(ev.target.value)} placeholder="Add a student by name" className="field flex-1 min-w-0" />
          <button className="px-4 rounded-full bg-white font-semibold">Add</button>
        </form>
      </section>}

      {myRewards.length > 0 && (
        <section className="rounded-3xl bg-sun p-5 space-y-2">
          <h2 className="font-display font-semibold text-xl text-sun-dark">Your rewards</h2>
          {myRewards.map((r) => {
            const ch = campus.challenges.find((c) => c.id === r.challengeId);
            return (
              <p key={r.id} className="text-sm">
                <span className="font-semibold">#{r.rank} in {ch?.title ?? 'a challenge'}:</span> {r.reward}
                <span className="text-sun-dark"> · {when(r.ts)}</span>
              </p>
            );
          })}
        </section>
      )}

      <section className="rounded-3xl bg-white border border-sky-line p-5 space-y-3">
        <h2 className="font-display font-semibold text-xl">Challenges</h2>
        {active.length === 0 && <p className="text-sm text-ink-soft">No challenge running right now. Your college will post one soon.</p>}
        {active.map((c) => {
          const rows = leaderboard(c);
          const myRank = rows.findIndex((r) => r.studentId === me);
          const mine = rows[myRank];
          return (
            <div key={c.id} className="rounded-2xl bg-sky-card p-4 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-lg">{c.title}</p>
                  <p className="text-xs text-ink-soft">{METRICS[c.metric].label} · {day(c.startDate)} to {day(c.endDate)} · top {c.winners} win</p>
                </div>
                <span className="rounded-full bg-sun px-3 py-1 text-xs font-semibold text-sun-dark">🎁 {c.reward}</span>
              </div>
              <p className="text-sm">
                {mine?.eligible
                  ? <>You're <b>#{myRank + 1}</b> of {rows.length}.</>
                  : <>You're not on the board yet. {METRICS[c.metric].hint}.</>}
              </p>
              <Leaderboard rows={rows} metric={c.metric} highlightId={me} limit={5} />
            </div>
          );
        })}
      </section>

      <section className="rounded-3xl bg-white border border-sky-line p-5 space-y-3">
        <div>
          <h2 className="font-display font-semibold text-xl">This week's leaderboard</h2>
          <p className="text-sm text-ink-soft">Lowest average net footprint per day, last 7 days.</p>
        </div>
        <Leaderboard rows={weekBoard} metric="low_net" highlightId={me} />
      </section>

      <section className="rounded-3xl bg-white border border-sky-line p-5 space-y-3">
        <h2 className="font-display font-semibold text-xl">Updates from {campus.collegeName}</h2>
        {campus.updates.length === 0 && <p className="text-sm text-ink-soft">No updates yet.</p>}
        {campus.updates.map((u) => (
          <div key={u.id} className="rounded-2xl bg-sky-card px-4 py-3">
            <p className="text-xs text-ink-soft">{when(u.ts)}</p>
            <p className="text-sm whitespace-pre-line">{u.text}</p>
          </div>
        ))}
      </section>

      {myProofs.length > 0 && (
        <section className="rounded-3xl bg-white border border-sky-line p-5 space-y-3">
          <h2 className="font-display font-semibold text-xl">Your tree photos</h2>
          {myProofs.map((p) => (
            <div key={p.id} className="flex items-center gap-3">
              <img src={p.photo} alt="" className="w-14 h-14 rounded-xl object-cover" />
              <div className="flex-1 text-sm">
                <p className="font-medium">{itemLabel('tree')} · {when(p.ts)}</p>
                <p className="text-xs text-ink-soft">{p.ai ? `AI: ${p.ai.reason}` : 'AI check running…'}</p>
              </div>
              <StatusPill status={p.status} />
            </div>
          ))}
        </section>
      )}
      {campus.mode === 'local' && <p className="text-xs text-ink-soft text-center">Signed in as {studentName(me)} on this device.</p>}
    </div>
  );
}

export function StatusPill({ status }) {
  const styles = { pending: 'bg-neutral-bg text-neutral-fg', approved: 'bg-pro-bg text-pro-fg', rejected: 'bg-con-bg text-con-fg' };
  const words = { pending: 'Waiting for college', approved: 'Approved', rejected: 'Rejected' };
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${styles[status]}`}>{words[status]}</span>;
}
