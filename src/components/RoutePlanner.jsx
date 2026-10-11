// RoutePlanner.jsx: "Plan a trip". Pick two places, see every way to travel with time and kg,
// the greenest sensible option, and how much it saves vs your usual mode. One tap logs the trip.
import { useState } from 'react';
import { searchPlace, planRoute, MODE_LABELS, osmLink } from '../lib/routes.js';
import { itemLabel } from '../data/labels.js';
import { useStore } from '../lib/store.js';

function PlaceInput({ label, value, onChange, allowHere }) {
  const [text, setText] = useState('');
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function find(ev) {
    ev.preventDefault();
    if (!text.trim()) return;
    setBusy(true); setError(null);
    try {
      const list = await searchPlace(text);
      setResults(list);
      if (list.length === 0) setError('No place found. Add the city, e.g. "Hauz Khas, Delhi".');
    } catch (err) {
      setError(`${err.message}. Check the internet and that npm run dev is running.`);
    }
    setBusy(false);
  }

  function here() {
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => onChange({ name: 'My location', lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => setError("Couldn't get your location. Allow location access, or type a place."),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  if (value) {
    return (
      <div className="flex items-center gap-2 rounded-2xl bg-sky-card px-3 py-2">
        <span className="text-xs text-ink-soft w-10 shrink-0">{label}</span>
        <span className="flex-1 text-sm font-medium truncate">{value.name}</span>
        <button onClick={() => { onChange(null); setResults([]); }} className="text-sm text-sprout font-semibold">Change</button>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <form onSubmit={find} className="flex gap-2">
        <input value={text} onChange={(ev) => setText(ev.target.value)} placeholder={`${label}: a place, e.g. Rajiv Chowk, Delhi`} className="field flex-1 min-w-0" />
        <button disabled={busy} className="px-4 rounded-full bg-sky-card font-semibold disabled:opacity-50">{busy ? '…' : 'Find'}</button>
      </form>
      {allowHere && (
        <button onClick={here} className="text-sm text-sprout font-semibold">Use my current location</button>
      )}
      {results.length > 0 && (
        <ul className="rounded-2xl border border-sky-line divide-y divide-sky-line overflow-hidden">
          {results.map((r, i) => (
            <li key={i}>
              <button onClick={() => onChange({ ...r, name: r.name.split(',').slice(0, 3).join(',') })} className="w-full text-left px-3 py-2 text-sm hover:bg-sky-card">
                {r.name}
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="text-sm text-sun-dark">{error}</p>}
    </div>
  );
}

export default function RoutePlanner({ onLog }) {
  const { settings } = useStore();
  const [from, setFrom] = useState(null);
  const [to, setTo] = useState(null);
  const [plan, setPlan] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const usual = settings.baseline.transport;

  async function go() {
    setBusy(true); setError(null); setPlan(null);
    try {
      setPlan(await planRoute(from, to, usual));
    } catch (err) {
      setError(`${err.message}. Try again in a moment.`);
    }
    setBusy(false);
  }

  return (
    <section className="rounded-3xl bg-white border border-sky-line p-4 space-y-3">
      <div>
        <p className="text-sm font-semibold">Plan a trip</p>
        <p className="text-xs text-ink-soft">See the greenest way to get there, and what it saves vs your usual {itemLabel(usual).toLowerCase()}.</p>
      </div>
      <PlaceInput label="From" value={from} onChange={(v) => { setFrom(v); setPlan(null); }} allowHere />
      <PlaceInput label="To" value={to} onChange={(v) => { setTo(v); setPlan(null); }} />
      {from && to && !plan && (
        <button onClick={go} disabled={busy} className="w-full py-3 rounded-full bg-sprout text-white font-semibold disabled:opacity-50">
          {busy ? 'Finding routes…' : 'Compare ways to travel'}
        </button>
      )}
      {error && <p className="text-sm text-sun-dark">{error}</p>}

      {plan && (
        <div className="space-y-2">
          <div className="rounded-2xl bg-sprout-light p-3">
            <p className="text-xs text-sprout-dark font-semibold uppercase tracking-wider">Best choice</p>
            <p className="font-display font-bold text-2xl text-sprout-dark">
              {MODE_LABELS[plan.best.mode]} · {Math.round(plan.best.min)} min
            </p>
            <p className="text-sm">
              {plan.best.kg.toFixed(2)} kg CO₂e for {plan.best.km.toFixed(1)} km.
              {plan.best.savedKg > 0.005
                ? <> Saves <b>{plan.best.savedKg.toFixed(2)} kg</b> vs your usual {itemLabel(plan.usualMode).toLowerCase()} ({plan.usualKg.toFixed(2)} kg).</>
                : ' Same as your usual.'}
            </p>
          </div>
          <ul className="space-y-1.5">
            {plan.options.map((o) => (
              <li key={o.mode} className="flex items-center gap-3 rounded-2xl bg-sky-card px-3 py-2 text-sm">
                <span className="w-24 font-medium">{MODE_LABELS[o.mode]}</span>
                <span className="flex-1 text-ink-soft tabular-nums">{Math.round(o.min)} min{o.estimated ? '*' : ''} · {o.km.toFixed(1)} km</span>
                <span className="tabular-nums font-semibold">{o.kg.toFixed(2)} kg</span>
                <button onClick={() => onLog(o.mode, Math.round(o.km * 10) / 10, `${from.name.split(',')[0]} to ${to.name.split(',')[0]}`)} className="px-3 py-1 rounded-full bg-white text-xs font-semibold">
                  Log
                </button>
              </li>
            ))}
          </ul>
          <p className="text-xs text-ink-soft">
            * Estimated from the road distance and typical city speeds; check that a metro or bus runs on this route.{' '}
            <a href={osmLink(from, to)} target="_blank" rel="noreferrer" className="underline">Open in map</a>. Routes © OpenStreetMap contributors.
          </p>
        </div>
      )}
    </section>
  );
}
