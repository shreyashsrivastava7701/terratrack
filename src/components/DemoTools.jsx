// DemoTools.jsx: "Delete all data", with a confirm step because it removes what is saved.
// "Load demo data" is switched off for now (SHOW_DEMO_BUTTON); new demo data comes later.
import { useState } from 'react';
import { getState, replaceAll, clearAll } from '../lib/store.js';
import { buildDemoData } from '../data/demoData.js';

const SHOW_DEMO_BUTTON = false;

export default function DemoTools({ onNavigate }) {
  const [confirming, setConfirming] = useState(null); // "load" or "clear"
  const [done, setDone] = useState(null);

  function confirm() {
    if (confirming === 'load') {
      const { activities, trees } = buildDemoData();
      replaceAll({ activities, trees, settings: getState().settings, quests: [] });
      setDone('Demo data loaded: 10 days of activity and 2 trees.');
    } else {
      clearAll();
      setDone('All data deleted.');
    }
    setConfirming(null);
  }

  return (
    <section className="rounded-3xl bg-white border border-sky-line p-5 space-y-3">
      <div>
        <h3 className="font-display font-semibold text-lg">Your data</h3>
        <p className="text-xs text-ink-soft">Everything is saved on this device only.</p>
      </div>

      {confirming ? (
        <div className="rounded-2xl bg-sun p-4 space-y-3">
          <p className="text-sm font-medium text-sun-dark">
            {confirming === 'load'
              ? 'Replace your entries with 10 days of demo data?'
              : 'Delete every entry and tree on this device?'}
          </p>
          <div className="flex gap-2">
            <button onClick={confirm} className="px-5 py-2 rounded-full bg-sprout text-white font-semibold">
              {confirming === 'load' ? 'Yes, load it' : 'Yes, delete'}
            </button>
            <button onClick={() => setConfirming(null)} className="px-5 py-2 rounded-full bg-white font-medium">Cancel</button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {SHOW_DEMO_BUTTON && <button
            onClick={() => { setConfirming('load'); setDone(null); }}
            className="px-5 py-2.5 rounded-full bg-sky-card font-semibold hover:bg-sky-line"
          >
            Load demo data
          </button>}
          <button
            onClick={() => { setConfirming('clear'); setDone(null); }}
            className="px-5 py-2.5 rounded-full text-con-fg font-semibold hover:bg-con-bg"
          >
            Delete all data
          </button>
        </div>
      )}

      {done && (
        <p className="text-sm text-pro-fg flex flex-wrap gap-x-3">
          {done}
          <button onClick={() => onNavigate('today')} className="font-semibold underline underline-offset-2">See Today</button>
        </p>
      )}
    </section>
  );
}
