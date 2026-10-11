// Insights.jsx: how the last 7 days add up, where emissions come from, and the year forecast.
import { useStore } from '../lib/store.js';
import { dailyNets, sectorTotals, forecastYearTonnes, savedVsUsual, equivalents, dayKey } from '../lib/calc.js';
import { itemLabel } from '../data/labels.js';
import { WeekChart, SectorBars } from '../components/Charts.jsx';
import WhatIf from '../components/WhatIf.jsx';
import CoachBox from '../components/CoachBox.jsx';
import ImpactCard from '../components/ImpactCard.jsx';
import ShareCard from '../components/ShareCard.jsx';
import factors from '../data/emission_factors.json';

export default function Insights({ onNavigate }) {
  const { activities, trees, settings } = useStore();
  const week = dailyNets(activities, trees, settings, new Date(), 7);
  const loggedDays = week.filter((d) => d.gross > 0 || d.credits > 0);
  const totals = sectorTotals(activities, week.map((d) => d.date));
  const average = loggedDays.length ? loggedDays.reduce((a, d) => a + d.net, 0) / loggedDays.length : 0;
  const forecast = forecastYearTonnes(loggedDays.map((d) => d.net));
  const underBudget = loggedDays.filter((d) => d.net <= settings.dailyBudgetKg).length;

  // Saved vs your usual, for this week's trips and meals (shown only, never subtracted from Net)
  const weekDays = new Set(week.map((d) => d.date));
  const weekActs = activities.filter((a) => weekDays.has(dayKey(a.ts)));
  const saved = savedVsUsual(weekActs, settings);

  // The week's total net in real-life terms
  const weekNet = week.reduce((t, d) => t + d.net, 0);
  const eq = equivalents(weekNet);

  if (loggedDays.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="font-display font-bold text-3xl">Insights</h1>
        <section className="rounded-3xl bg-white border border-sky-line p-6 text-center">
          <p className="font-display font-semibold text-xl">No days logged yet</p>
          <p className="text-sm text-ink-soft mt-1">Log a few activities, or load the demo data in Settings, to see your week.</p>
          <button onClick={() => onNavigate('log')} className="mt-4 px-6 py-3 rounded-full bg-sprout text-white font-semibold hover:bg-sprout-dark">
            Log an activity
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <h1 className="font-display font-bold text-3xl">Insights</h1>

      {/* Three headline numbers */}
      <section className="grid grid-cols-3 gap-3">
        <Stat label="Daily average" value={average.toFixed(1)} unit="kg" />
        <Stat label="Year forecast" value={forecast.toFixed(2)} unit="t" />
        <Stat label="Days on budget" value={`${underBudget}/${loggedDays.length}`} />
      </section>

      <section className="rounded-3xl bg-white border border-sky-line p-4 sm:p-5">
        <h2 className="font-display font-semibold text-xl">Last 7 days</h2>
        <p className="text-sm text-ink-soft mb-3">Your net footprint each day. Below the dashed line is within budget.</p>
        <WeekChart days={week} budget={settings.dailyBudgetKg} />
      </section>

      <section className="rounded-3xl bg-white border border-sky-line p-4 sm:p-5">
        <h2 className="font-display font-semibold text-xl">Where it comes from</h2>
        <p className="text-sm text-ink-soft mb-4">Emissions by category over the last 7 days.</p>
        <SectorBars totals={totals} />
      </section>

      <section className="rounded-3xl bg-sprout-light p-5">
        <p className="text-sm text-sprout-dark">Saved vs your usual this week</p>
        <p className="font-display font-bold text-3xl tabular-nums text-sprout-dark">{saved.toFixed(2)} kg</p>
        <p className="text-sm mt-1">
          Compared with {itemLabel(settings.baseline.transport).toLowerCase()} and {itemLabel(settings.baseline.food).toLowerCase()} every time.
          This is not subtracted again: the lower emissions are already in your net.
        </p>
      </section>

      <CoachBox activities={activities} trees={trees} settings={settings} />

      <WhatIf activities={activities} trees={trees} settings={settings} />

      <section className="rounded-3xl bg-white border border-sky-line p-5">
        <h2 className="font-display font-semibold text-xl">This week in real life</h2>
        <p className="text-sm text-ink-soft mb-4">Your {weekNet.toFixed(1)} kg net over 7 days is about the same as:</p>
        <div className="grid grid-cols-3 gap-3 text-center">
          <Equivalent value={Math.round(eq.carKm)} label="km by car" />
          <Equivalent value={Math.round(eq.phoneCharges).toLocaleString('en-IN')} label="phone charges" />
          <Equivalent value={Math.round(eq.treeDays)} label="days for a grown tree to absorb" />
        </div>
      </section>

      <ImpactCard
        forecastTonnes={forecast}
        topSectors={totals.slice(0, 3).map((t) => factors.sectors[t.sector].label)}
      />

      <ShareCard activities={activities} trees={trees} settings={settings} />
    </div>
  );
}

function Equivalent({ value, label }) {
  return (
    <div className="rounded-2xl bg-sky-card px-2 py-3">
      <p className="font-display font-bold text-2xl tabular-nums">{value}</p>
      <p className="text-xs text-ink-soft leading-tight">{label}</p>
    </div>
  );
}

function Stat({ label, value, unit }) {
  return (
    <div className="rounded-2xl bg-sky-card px-3 py-3">
      <p className="text-xs text-ink-soft">{label}</p>
      <p className="font-display font-bold text-2xl tabular-nums leading-tight">
        {value}{unit && <span className="text-sm font-semibold ml-0.5">{unit}</span>}
      </p>
    </div>
  );
}
