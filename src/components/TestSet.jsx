// TestSet.jsx: the "Run test set" button. It sends the spec's 10 sentences to Gemma
// (no keyword parser) and counts how many came back with exactly the expected entries.
// Pass mark: 8 of 10.
import { useState } from 'react';
import { TEST_SET } from '../lib/prompts.js';
import { parse } from '../lib/ai.js';
import { itemLabel } from '../data/labels.js';

// "auto 8, bus 8" style text, sorted so the order of entries doesn't matter
function summary(pairs) {
  return pairs.map(([item, qty]) => `${item} ${qty}`).sort().join(', ');
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export default function TestSet() {
  const [rows, setRows] = useState([]); // one result per sentence
  const [running, setRunning] = useState(false);

  async function run() {
    setRunning(true);
    setRows([]);
    const results = [];
    for (const t of TEST_SET) {
      let got = null;
      let error = null;
      try {
        const r = await parse(t.text, t.tab, { fallback: false, gemmaOnly: true });
        got = r.entries.map((e) => [e.item, e.quantity]);
      } catch (err) {
        error = err.message;
      }
      const pass = got !== null && summary(got) === summary(t.expected);
      results.push({ ...t, got, error, pass });
      setRows([...results]);
      if (error && /key|rate limit/i.test(error)) break; // no point sending the rest
      await wait(1500); // stay gentle with the free rate limit
    }
    setRunning(false);
  }

  const score = rows.filter((r) => r.pass).length;
  const done = !running && rows.length > 0;

  return (
    <section className="rounded-3xl bg-white border border-sky-line p-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display font-semibold text-lg">AI test set</h3>
          <p className="text-xs text-ink-soft">10 sample sentences sent to Gemma 4. Pass mark: 8 of 10.</p>
        </div>
        <button
          onClick={run}
          disabled={running}
          className="px-5 py-2.5 rounded-full bg-sprout text-white font-semibold hover:bg-sprout-dark disabled:opacity-50"
        >
          {running ? `Running ${rows.length + 1} of 10…` : 'Run test set'}
        </button>
      </div>

      {done && rows.length === 10 && (
        <p className={`rounded-2xl px-4 py-3 font-semibold ${score >= 8 ? 'bg-pro-bg text-pro-fg' : 'bg-con-bg text-con-fg'}`}>
          Score: {score} of 10 {score >= 8 ? '✓ passed' : '✗ below 8'}
        </p>
      )}

      {rows.length > 0 && (
        <ul className="divide-y divide-sky-line text-sm">
          {rows.map((r, i) => (
            <li key={i} className="py-2 flex gap-3">
              <span className={`shrink-0 font-bold ${r.pass ? 'text-pro-fg' : 'text-con-fg'}`}>{r.pass ? '✓' : '✗'}</span>
              <div className="min-w-0">
                <p>“{r.text}”</p>
                {r.error ? (
                  <p className="text-con-fg">{r.error}</p>
                ) : (
                  !r.pass && (
                    <p className="text-ink-soft">
                      Expected {r.expected.map(([it, q]) => `${itemLabel(it)} ${q}`).join(', ')} · got{' '}
                      {r.got.length ? r.got.map(([it, q]) => `${itemLabel(it)} ${q}`).join(', ') : 'nothing'}
                    </p>
                  )
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
