// DemoFill.jsx: one tap fills an account with a ready-made demo week, for the presentation.
//   Logged in (Supabase): fills YOUR account as Aarav, Priya or Rohan (the database rules allow nothing else).
//   On this device only: loads the whole demo campus (3 students, college updates, 2 challenges).
import { useState } from 'react';
import { cloudEnabled } from '../lib/supabase.js';
import { replaceAll, writeUserData } from '../lib/store.js';
import { useCampusApi } from '../lib/campusApi.js';
import { replaceCampus, chooseStudent, createChallenge, postUpdate } from '../lib/campus.js';
import { PERSONAS, buildPersonaData, demoTreePhoto, DEMO_COLLEGE } from '../data/demoCampus.js';
import { dayKey } from '../lib/calc.js';

export default function DemoFill({ onNavigate }) {
  const campus = useCampusApi();
  const [confirm, setConfirm] = useState(null);
  const [done, setDone] = useState(null);

  async function fillAs(key) {
    const { treeActivityId, ...data } = buildPersonaData(key);
    replaceAll(data); // saves online too when logged in
    if (treeActivityId) {
      const tree = data.activities.find((a) => a.id === treeActivityId);
      const id = await campus.addProof({ activityId: treeActivityId, photo: demoTreePhoto(), day: dayKey(tree.ts) });
      if (id) await campus.setProofAi(id, { ok: null, reason: 'Demo photo, AI check skipped' });
    }
    setConfirm(null);
    setDone(`Filled with ${PERSONAS[key].name}'s week.`);
  }

  function loadLocalCampus() {
    const students = Object.entries(PERSONAS).map(([key, p]) => ({ id: `demo-${key}`, name: p.name }));
    const proofs = [];
    students.forEach((s, i) => {
      const key = Object.keys(PERSONAS)[i];
      const { treeActivityId, ...data } = buildPersonaData(key);
      writeUserData(s.id, data);
      if (treeActivityId) {
        proofs.push({ id: `p-${key}`, studentId: s.id, activityId: treeActivityId, ts: new Date().toISOString(),
          photo: demoTreePhoto(), ai: { ok: null, reason: 'Demo photo, AI check skipped' }, status: 'pending' });
      }
    });
    replaceCampus({
      collegeName: DEMO_COLLEGE.name, role: 'college', currentStudentId: students[0].id,
      students,
      updates: DEMO_COLLEGE.updates.map((text, i) => ({ id: `u${i}`, ts: new Date(Date.now() - i * 86400000).toISOString(), text })),
      challenges: [], rewards: [], proofs,
    });
    DEMO_COLLEGE.challenges.forEach((c) => createChallenge(c));
    chooseStudent(students[0].id);
    setConfirm(null);
    setDone('Demo campus loaded: 3 students, college updates and 2 challenges. Switch to Student to see Aarav.');
  }

  return (
    <section className="rounded-3xl bg-white border border-sky-line p-5 space-y-3">
      <div>
        <h3 className="font-display font-semibold text-lg">Demo data</h3>
        <p className="text-xs text-ink-soft">
          {cloudEnabled
            ? 'Replaces the entries in the account you are signed in to with a ready-made week.'
            : 'Loads 3 demo students, college updates and 2 challenges on this device.'}
        </p>
      </div>

      {cloudEnabled ? (
        <div className="space-y-2">
          {Object.entries(PERSONAS).map(([key, p]) => (
            <div key={key} className="flex items-center gap-3 rounded-2xl bg-sky-card px-3 py-2">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{p.name}</p>
                <p className="text-xs text-ink-soft">{p.blurb}</p>
              </div>
              {confirm === key ? (
                <button onClick={() => fillAs(key)} className="px-3 py-1.5 rounded-full bg-con-bg text-con-fg text-sm font-semibold shrink-0">Replace my data</button>
              ) : (
                <button onClick={() => { setConfirm(key); setDone(null); }} className="px-3 py-1.5 rounded-full bg-white text-sm font-semibold shrink-0">Fill as</button>
              )}
            </div>
          ))}
        </div>
      ) : confirm === 'campus' ? (
        <div className="flex gap-2">
          <button onClick={loadLocalCampus} className="px-5 py-2 rounded-full bg-sprout text-white font-semibold">Yes, load it</button>
          <button onClick={() => setConfirm(null)} className="px-5 py-2 rounded-full bg-sky-card font-medium">Cancel</button>
        </div>
      ) : (
        <button onClick={() => { setConfirm('campus'); setDone(null); }} className="px-5 py-2.5 rounded-full bg-sky-card font-semibold hover:bg-sky-line">
          Load demo campus
        </button>
      )}

      {done && (
        <p className="text-sm text-pro-fg flex flex-wrap gap-x-3">
          {done}
          {onNavigate && <button onClick={() => onNavigate('today')} className="font-semibold underline underline-offset-2">See Today</button>}
        </p>
      )}
    </section>
  );
}
