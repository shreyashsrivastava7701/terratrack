// Today.jsx: the home screen. Today's net against the budget, the three totals,
// the daily quest and today's saved entries.
import { useStore, setQuestDone } from '../lib/store.js';
import { netFootprint, dayKey, dailyNets, forecastYearTonnes, questFor, questStreak } from '../lib/calc.js';
import BudgetRing from '../components/BudgetRing.jsx';
import EntryList from '../components/EntryList.jsx';

export default function Today({ onNavigate }) {
  const { activities, trees, settings, quests } = useStore();
  const today = dayKey();
  const result = netFootprint(activities, trees, settings, today);
  const budget = settings.dailyBudgetKg;

  // Year forecast from the logged days of the last week
  const week = dailyNets(activities, trees, settings, today, 7).filter((d) => d.gross > 0 || d.credits > 0);
  const forecast = forecastYearTonnes(week.map((d) => d.net));

  // Today's entries, newest first
  const todays = activities
    .filter((a) => dayKey(a.ts) === today)
    .sort((a, b) => b.ts.localeCompare(a.ts));

  // Today's quest and the streak of days in a row it was done
  const quest = questFor(today);
  const questDone = quests.some((q) => q.date === today && q.done);
  const streak = questStreak(quests, today);
  const capPercent = Math.round(settings.offsetCapShare * 100);

  const dateText = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm text-ink-soft">{dateText}</p>
        <h1 className="font-display font-bold text-3xl">Your day so far</h1>
      </div>

      {/* Budget ring card */}
      <section className="rounded-3xl bg-sky-card p-5 flex items-center gap-5">
        <BudgetRing net={result.net} budget={budget} />
        <div>
          <p className="text-sm text-ink-soft">Net today</p>
          <p className="font-display font-bold text-4xl leading-tight tabular-nums">
            {result.net.toFixed(2)} <span className="text-xl">kg</span>
          </p>
          <p className="text-sm text-ink-soft">of your {budget} kg daily budget</p>
        </div>
      </section>

      {/* Three small cards: emitted, credits, trees */}
      <section className="grid grid-cols-3 gap-3">
        <MiniCard label="Emitted" value={result.gross.toFixed(2)} />
        <MiniCard label="Credits" value={minus(result.credits, 2)} />
        <MiniCard label="Trees" value={minus(result.offset, 3)} />
      </section>

      {/* The 30% cap, explained when it applies */}
      {result.capApplied && (
        <p className="rounded-2xl bg-sprout-light text-sprout-dark text-sm px-4 py-3">
          Your trees could offset {result.offsetRaw.toFixed(2)} kg today, but only {capPercent}% of what you emitted
          ({result.offset.toFixed(2)} kg) counts. Reduce first, offset second.
        </p>
      )}

      {/* Daily quest */}
      <section className="rounded-3xl bg-sun p-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-sun-dark">
            Today's quest{streak > 0 && ` · ${streak}-day streak`}
          </p>
          <p className={`font-display font-semibold text-xl mt-1 ${questDone ? 'line-through decoration-2 opacity-70' : ''}`}>
            {quest.text}
          </p>
        </div>
        <button
          onClick={() => setQuestDone(today, quest.id, !questDone)}
          aria-pressed={questDone}
          className={`shrink-0 px-4 py-2.5 rounded-full font-semibold transition-colors ${
            questDone ? 'bg-sprout text-white' : 'bg-white text-sun-dark hover:bg-white/70'
          }`}
        >
          {questDone ? '✓ Done' : 'Mark done'}
        </button>
      </section>

      {/* Today's entries */}
      {todays.length > 0 ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-semibold text-xl">Today's entries</h2>
            <button onClick={() => onNavigate('log')} className="text-sm font-semibold text-sprout">+ Add more</button>
          </div>
          <EntryList activities={todays} />
        </section>
      ) : (
        <section className="rounded-3xl bg-white border border-sky-line p-6 text-center">
          <p className="font-display font-semibold text-xl">Nothing logged yet</p>
          <p className="text-sm text-ink-soft mt-1">
            Tell TerraTrack how you got around, what you ate, or what you switched on.
          </p>
          <button
            onClick={() => onNavigate('log')}
            className="mt-4 px-6 py-3 rounded-full bg-sprout text-white font-semibold hover:bg-sprout-dark transition-colors"
          >
            Log an activity
          </button>
        </section>
      )}

      {/* Year forecast */}
      {week.length > 0 && (
        <section className="rounded-3xl bg-sky-card p-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-ink-soft">At this week's pace</p>
            <p className="font-display font-bold text-3xl tabular-nums">
              {forecast.toFixed(2)} <span className="text-lg whitespace-nowrap">t a year</span>
            </p>
          </div>
          <p className="text-xs text-ink-soft max-w-36 text-right">A 1.5 °C-aligned year is about 2.2 t</p>
        </section>
      )}
    </div>
  );
}

function MiniCard({ label, value }) {
  return (
    <div className="rounded-2xl bg-sky-card px-3 py-3">
      <p className="text-xs text-ink-soft">{label}</p>
      <p className="font-semibold text-lg tabular-nums">{value}</p>
    </div>
  );
}

// Show "−0.69" for a credit, but plain "0.00" when there is nothing to take off
function minus(kg, digits) {
  const text = kg.toFixed(digits);
  return Number(text) === 0 ? text : `−${text}`;
}
