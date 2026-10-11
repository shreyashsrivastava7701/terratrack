// Charts.jsx: the Insights charts, drawn with Recharts.
//   WeekChart:   net footprint for the last 7 days, with the daily budget as a dashed line
//   SectorBars:  which sectors emitted the most over the same days
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
} from 'recharts';
import { sectorLabel } from '../lib/items.js';

const GREEN = 'var(--color-ring-green)';
const INK_SOFT = 'var(--color-ink-soft)';
const LINE = 'var(--color-sky-line)';

// "2026-10-11" -> "Sat"
function weekday(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { weekday: 'short' });
}

export function WeekChart({ days, budget }) {
  const data = days.map((d) => ({ day: weekday(d.date), date: d.date, net: Math.round(d.net * 100) / 100 }));
  const top = Math.ceil(Math.max(budget * 1.2, ...data.map((d) => d.net)) / 2) * 2;

  return (
    <div className="h-60 w-full" role="img" aria-label={`Net footprint for the last 7 days: ${data.map((d) => `${d.day} ${d.net} kg`).join(', ')}`}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 16, right: 12, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="netFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2f9c68" stopOpacity={0.25} />
              <stop offset="100%" stopColor="#2f9c68" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={LINE} strokeDasharray="0" vertical={false} />
          <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: INK_SOFT, fontSize: 12 }} />
          <YAxis domain={[0, top]} tickLine={false} axisLine={false} tick={{ fill: INK_SOFT, fontSize: 12 }} width={52} unit=" kg" allowDecimals={false} />
          <ReferenceLine
            y={budget}
            stroke="var(--color-ring-amber)"
            strokeDasharray="6 4"
            label={{ value: `${budget} kg budget`, position: 'insideTopRight', fill: INK_SOFT, fontSize: 12 }}
          />
          <Tooltip
            cursor={{ stroke: INK_SOFT, strokeDasharray: '3 3' }}
            formatter={(value) => [`${value.toFixed(2)} kg`, 'Net']}
            labelFormatter={(_, items) => items?.[0]?.payload.date ?? ''}
            contentStyle={{ borderRadius: 12, border: '1px solid #d3e5ee', fontFamily: 'Lexend, sans-serif' }}
          />
          <Area
            type="monotone"
            dataKey="net"
            stroke={GREEN}
            strokeWidth={2}
            fill="url(#netFill)"
            dot={{ r: 4, fill: GREEN, stroke: 'white', strokeWidth: 2 }}
            activeDot={{ r: 6 }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// Plain horizontal bars: easier to compare than a pie with seven slices
export function SectorBars({ totals }) {
  const sum = totals.reduce((a, t) => a + t.kg, 0);
  const biggest = totals[0]?.kg ?? 1;

  return (
    <ul className="space-y-3">
      {totals.map((t) => (
        <li key={t.sector}>
          <div className="flex justify-between text-sm mb-1">
            <span className="font-medium">{sectorLabel(t.sector)}</span>
            <span className="tabular-nums text-ink-soft">
              {t.kg.toFixed(1)} kg · {Math.round((t.kg / sum) * 100)}%
            </span>
          </div>
          <div className="h-3 rounded-full bg-sky-card">
            <div className="h-3 rounded-full bg-ring-green" style={{ width: `${Math.max(2, (t.kg / biggest) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
