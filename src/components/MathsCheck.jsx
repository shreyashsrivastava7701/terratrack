// MathsCheck.jsx: runs the spec's test day through calc.js and shows the result.
// If the maths is right, Net shows 7.33 kg with a green tick.
import { netFootprint, verdict } from '../lib/calc.js';
import { testDayActivities, testDayTrees } from '../data/testDay.js';
import Badge from './Badge.jsx';

const NAMES = {
  auto: '8 km auto', ac: 'AC for 4 h', chicken_meal: '1 chicken meal',
  dal_rice: '1 dal-rice', streaming: 'Streaming for 2 h',
};

export default function MathsCheck() {
  const date = '2026-10-11';
  const activities = testDayActivities(date);
  const result = netFootprint(activities, testDayTrees(date), null, date);
  const passed = Math.abs(result.net - 7.33) <= 0.01;
  const emits = activities.filter((a) => a.kind === 'emit');

  return (
    <section className="rounded-3xl bg-white border border-sky-line p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display font-semibold text-lg">Maths check: the test day</h3>
        <span className={`text-xs font-semibold px-3 py-1 rounded-full ${passed ? 'bg-pro-bg text-pro-fg' : 'bg-con-bg text-con-fg'}`}>
          {passed ? '✓ Correct' : '✗ Wrong'}
        </span>
      </div>

      <ul className="mt-3 divide-y divide-sky-line text-sm">
        {emits.map((a) => {
          const v = verdict(a.sector, a.item);
          return (
            <li key={a.id} className="flex items-center justify-between gap-3 py-2">
              <span>{NAMES[a.item]}</span>
              <span className="flex items-center gap-3">
                <span className="tabular-nums">{a.kg.toFixed(2)} kg</span>
                <span className="w-28 text-right">
                  <Badge label={v.label} percent={Math.round(v.ratio * 100)} />
                </span>
              </span>
            </li>
          );
        })}
      </ul>

      <dl className="mt-3 grid grid-cols-2 gap-y-1 text-sm tabular-nums">
        <dt className="text-ink-soft">Gross emitted</dt><dd className="text-right">{result.gross.toFixed(2)} kg</dd>
        <dt className="text-ink-soft">Compost 0.3 kg</dt><dd className="text-right">−{result.credits.toFixed(2)} kg</dd>
        <dt className="text-ink-soft">Tree planted today</dt><dd className="text-right">−{result.offset.toFixed(3)} kg</dd>
        <dt className="font-semibold">Net</dt><dd className="text-right font-semibold">{result.net.toFixed(2)} kg</dd>
      </dl>
      <p className="mt-2 text-xs text-ink-soft">The spec says Net must be 7.33 kg.</p>
    </section>
  );
}
