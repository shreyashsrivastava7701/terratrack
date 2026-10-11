// BudgetRing.jsx: the circle showing today's net against the daily budget.
// Green up to 70%, amber up to 100%, red above (and the word is shown too, not only the colour).
import { budgetLevel } from '../lib/calc.js';

const COLOURS = {
  green: 'var(--color-ring-green)',
  amber: 'var(--color-ring-amber)',
  red: 'var(--color-ring-red)',
};
const WORDS = { green: 'On track', amber: 'Near budget', red: 'Over budget' };

export default function BudgetRing({ net, budget }) {
  const level = budgetLevel(net, budget);
  const percent = Math.round((net / budget) * 100);
  const r = 42;
  const circumference = 2 * Math.PI * r;
  const filled = Math.min(1, net / budget) * circumference;

  return (
    <div className="flex flex-col items-center gap-1 shrink-0">
      <svg viewBox="0 0 100 100" className="w-28 h-28" role="img" aria-label={`${percent}% of budget used`}>
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--color-sky-line)" strokeWidth="10" />
        <circle
          cx="50" cy="50" r={r} fill="none"
          stroke={COLOURS[level]} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference}`}
          transform="rotate(-90 50 50)"
          style={{ transition: 'stroke-dasharray 0.6s ease' }}
        />
        <text x="50" y="57" textAnchor="middle" fontSize="20" fontWeight="700"
          fontFamily="var(--font-display)" fill="var(--color-ink)">{percent}%</text>
      </svg>
      <span className="text-xs font-semibold" style={{ color: COLOURS[level] }}>{WORDS[level]}</span>
    </div>
  );
}
