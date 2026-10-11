// CoachBox.jsx: the Carbon Coach. Code picks the week's top category and three tips with
// their savings; Gemma turns them into a short plan. Any number in the plan must be one we gave it.
import { useState } from 'react';
import { coachInputs } from '../lib/calc.js';
import { coach } from '../lib/ai.js';
import { itemLabel } from '../data/labels.js';

export default function CoachBox({ activities, trees, settings }) {
  const [plan, setPlan] = useState(null);
  const [busy, setBusy] = useState(false);
  const inputs = coachInputs(activities, trees, settings, new Date(), itemLabel);

  async function write() {
    if (!inputs) return;
    setBusy(true);
    setPlan(await coach(inputs.summary, inputs.tips, inputs.sectors));
    setBusy(false);
  }

  if (!inputs) return null;

  const sourceText = {
    gemma: 'Written by Gemma 4 from your numbers',
    gemini: 'Written by Gemini (backup) from your numbers',
    template: 'AI unavailable, so the app wrote this from your numbers',
  };

  return (
    <section className="rounded-3xl bg-sun p-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-sun-dark">Carbon Coach</p>
          <h2 className="font-display font-semibold text-xl">Your plan for next week</h2>
        </div>
        <button
          onClick={write}
          disabled={busy}
          className="px-5 py-2.5 rounded-full bg-sprout text-white font-semibold hover:bg-sprout-dark disabled:opacity-50"
        >
          {busy ? 'Writing…' : plan ? 'Write again' : 'Write my plan'}
        </button>
      </div>

      {plan ? (
        <>
          <p className="text-lg leading-relaxed">{plan.text}</p>
          <p className="text-xs text-sun-dark">{sourceText[plan.source]}. Every number comes from the app's own maths.</p>
        </>
      ) : (
        <p className="text-sm text-sun-dark">
          Based on your week: {inputs.summary.topSector} is your biggest category ({inputs.summary.topSharePercent}%).
          Tap the button for a short plan.
        </p>
      )}

      <SectorSummary sectors={inputs.sectors} notLogged={inputs.notLogged} />
    </section>
  );
}

// One small card per category: its share of the week, and the one thing that would help most there.
// Written by code only, so every number is the app's own maths.
function SectorSummary({ sectors, notLogged }) {
  const biggest = sectors.reduce((b, s) => ((s.savedKg ?? 0) > (b?.savedKg ?? 0) ? s : b), null);

  return (
    <div className="pt-2 space-y-2">
      <h3 className="font-display font-semibold text-lg">What you can do in each category</h3>
      <ul className="grid gap-2 sm:grid-cols-2">
        {sectors.map((s) => (
          <li key={s.sector} className="rounded-2xl bg-white/80 p-3 space-y-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-semibold">{s.label}</span>
              <span className="text-sm tabular-nums text-ink-soft">{s.kg.toFixed(1)} kg · {s.sharePercent}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-sky-line overflow-hidden">
              <div className="h-full bg-sprout" style={{ width: `${Math.max(2, s.sharePercent)}%` }} />
            </div>
            {s.swap ? (
              <p className="text-sm">
                {s.swap}: would have saved <b className="tabular-nums">{s.savedKg.toFixed(1)} kg</b> this week.
                {s === biggest && <span className="ml-1 inline-block rounded-full bg-sprout-light px-2 text-xs font-semibold text-sprout-dark">Biggest win</span>}
              </p>
            ) : s.tip ? (
              <p className="text-sm">{s.tip}.</p>
            ) : (
              <p className="text-sm text-ink-soft">Already low-carbon here. Keep it up.</p>
            )}
            {s.swap && s.tip && <p className="text-xs text-ink-soft">Tip: {s.tip}</p>}
          </li>
        ))}
      </ul>
      {notLogged.length > 0 && (
        <p className="text-xs text-sun-dark">Nothing logged this week for {notLogged.join(', ')}.</p>
      )}
    </div>
  );
}
