// Leaderboard.jsx: ranked students for one challenge (or this week's overall board)
import { METRICS } from '../lib/campus.js';

export function formatScore(metric, value) {
  if (value == null) return 'no entries yet';
  if (metric === 'low_net') return `${value.toFixed(2)} kg a day`;
  if (metric === 'saved') return `${value.toFixed(1)} kg saved`;
  return `${value} ${METRICS[metric].unit}`;
}

export default function Leaderboard({ rows, metric, highlightId, limit }) {
  const shown = limit ? rows.slice(0, limit) : rows;
  if (rows.length === 0) return <p className="text-sm text-ink-soft">No students yet.</p>;
  return (
    <ol className="space-y-1.5">
      {shown.map((r, i) => (
        <li
          key={r.studentId}
          className={`flex items-center gap-3 rounded-2xl px-3 py-2 text-sm ${
            r.studentId === highlightId ? 'bg-sprout-light' : 'bg-white/70'
          }`}
        >
          <span className={`w-7 h-7 rounded-full grid place-items-center font-display font-bold ${
            r.eligible && i < 3 ? 'bg-sun text-sun-dark' : 'bg-sky-card text-ink-soft'
          }`}>{r.eligible ? i + 1 : '–'}</span>
          <span className="flex-1 font-medium truncate">{r.name}{r.studentId === highlightId && ' (you)'}</span>
          <span className="tabular-nums text-ink-soft">{formatScore(metric, r.value)}</span>
        </li>
      ))}
    </ol>
  );
}
