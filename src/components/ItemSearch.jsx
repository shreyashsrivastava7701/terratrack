// ItemSearch.jsx: "Search any item". Type anything (biryani, Rapido bike, hoodie, air fryer):
// the AI finds the closest item we have a factor for, and the kg comes from our own table.
import { useState } from 'react';
import { matchItem } from '../lib/ai.js';
import { kgPerUnit, verdict } from '../lib/calc.js';
import { unitOf, sectorLabel } from '../lib/items.js';
import { itemLabel } from '../data/labels.js';
import Badge from './Badge.jsx';

const EXAMPLES = {
  transport: 'Rapido bike, Uber, Vande Bharat…',
  energy: 'air fryer, microwave, inverter…',
  food: 'biryani, dosa, butter chicken…',
  shopping: 'hoodie, headphones, laptop bag…',
  waste: 'Zomato box, plastic spoon…',
  water: 'bath tub, washing car…',
  digital: 'BGMI, Spotify, Google Meet…',
  eco: 'refilled bottle, carried tiffin…',
  all: 'anything: biryani, Uber, hoodie…',
};

export default function ItemSearch({ tab, onPick }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [found, setFound] = useState(undefined); // undefined = not searched, null = no match

  async function search(ev) {
    ev.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    setFound(await matchItem(text, tab));
    setBusy(false);
  }

  function add() {
    onPick(found.sector, found.item, found.name);
    setText('');
    setFound(undefined);
  }

  const perUnit = found ? kgPerUnit(found.sector, found.item) : 0;
  const unit = found ? unitOf(found.sector, found.item) : '';
  const v = found && found.sector !== 'eco' ? verdict(found.sector, found.item) : null;

  return (
    <section className="rounded-3xl bg-white border border-sky-line p-4 space-y-3">
      <p className="text-sm font-semibold">Can't see it? Search any item</p>
      <form onSubmit={search} className="flex gap-2">
        <input
          value={text}
          onChange={(ev) => { setText(ev.target.value); setFound(undefined); }}
          placeholder={EXAMPLES[tab]}
          className="field flex-1 min-w-0"
          aria-label="Search any item"
        />
        <button
          type="submit"
          disabled={!text.trim() || busy}
          className="px-5 rounded-full bg-sky-card font-semibold hover:bg-sky-line disabled:opacity-40"
        >
          {busy ? 'Finding…' : 'Find'}
        </button>
      </form>

      {found === null && (
        <p className="text-sm text-sun-dark">We couldn't match that to anything similar. Try another word.</p>
      )}

      {found && (
        <div className="rounded-2xl bg-sky-card p-3 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold">{found.name}</p>
              <p className="text-xs text-ink-soft">
                Closest in our table: {itemLabel(found.item)} ({sectorLabel(found.sector)})
                {found.why && ` · ${found.why}`}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="font-display font-bold text-xl tabular-nums">
                {found.sector === 'eco' ? '−' : ''}{perUnit.toFixed(2)} kg
              </p>
              <p className="text-xs text-ink-soft">per {unit}</p>
            </div>
          </div>
          <div className="flex items-center justify-between gap-2">
            {v ? <Badge label={v.label} /> : <span className="text-xs font-semibold text-pro-fg">Credit</span>}
            <button onClick={add} className="px-5 py-2 rounded-full bg-sprout text-white font-semibold hover:bg-sprout-dark">
              Add
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
