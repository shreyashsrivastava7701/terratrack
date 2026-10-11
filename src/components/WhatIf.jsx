// WhatIf.jsx: two sliders. Pick tomorrow's commute and main meal and see the projected net,
// using today's other entries (or your latest logged day) as the starting point.
import { useState } from 'react';
import { whatIfNet, dayKey, kgPerUnit } from '../lib/calc.js';
import { itemsOf } from '../lib/items.js';
import { itemLabel } from '../data/labels.js';

// Options sorted from lowest to highest emissions, so sliding right means "more CO₂"
const COMMUTES = itemsOf('transport').filter((i) => i !== 'flight').sort((a, b) => kgPerUnit('transport', a) - kgPerUnit('transport', b));
const MEALS = itemsOf('food').filter((i) => i !== 'tea_coffee').sort((a, b) => kgPerUnit('food', a) - kgPerUnit('food', b));

export default function WhatIf({ activities, trees, settings }) {
  // Start from today's entries, or the most recent day that has any
  const days = [...new Set(activities.map((a) => dayKey(a.ts)))].sort();
  const baseDay = days.includes(dayKey()) ? dayKey() : days[days.length - 1] ?? dayKey();
  const dayActs = activities.filter((a) => dayKey(a.ts) === baseDay);

  const [commute, setCommute] = useState(Math.max(0, COMMUTES.indexOf(settings.baseline.transport)));
  const [meal, setMeal] = useState(Math.max(0, MEALS.indexOf(settings.baseline.food)));

  const usual = whatIfNet(dayActs, trees, settings, baseDay, settings.baseline.transport, settings.baseline.food);
  const picked = whatIfNet(dayActs, trees, settings, baseDay, COMMUTES[commute], MEALS[meal]);
  const diff = picked.net - usual.net;

  return (
    <section className="rounded-3xl bg-white border border-sky-line p-5 space-y-4">
      <div>
        <h2 className="font-display font-semibold text-xl">What if tomorrow…</h2>
        <p className="text-sm text-ink-soft">
          Same day as {baseDay === dayKey() ? 'today' : 'your last logged day'}, with {picked.km} km of travel and {picked.mealCount} meals.
        </p>
      </div>

      <Slider id="whatif-commute" label="I travel by" options={COMMUTES} value={commute} onChange={setCommute} />
      <Slider id="whatif-meal" label="I eat" options={MEALS} value={meal} onChange={setMeal} />

      <div className="rounded-2xl bg-sky-card p-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-ink-soft">Projected net</p>
          <p className="font-display font-bold text-3xl tabular-nums whitespace-nowrap">{picked.net.toFixed(2)} <span className="text-lg">kg</span></p>
        </div>
        <p className={`text-right font-semibold tabular-nums ${diff < 0 ? 'text-pro-fg' : diff > 0 ? 'text-con-fg' : 'text-ink-soft'}`}>
          {diff === 0 ? 'Same as your usual' : `${diff < 0 ? '−' : '+'}${Math.abs(diff).toFixed(2)} kg`}
          <span className="block text-xs font-normal text-ink-soft">vs your usual commute and meal</span>
        </p>
      </div>
    </section>
  );
}

function Slider({ id, label, options, value, onChange }) {
  return (
    <div>
      <label htmlFor={id} className="flex justify-between text-sm mb-1">
        <span className="text-ink-soft">{label}</span>
        <span className="font-semibold">{itemLabel(options[value])}</span>
      </label>
      <input
        id={id}
        type="range"
        min={0}
        max={options.length - 1}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[var(--color-sprout)] h-8"
        aria-valuetext={itemLabel(options[value])}
      />
      <div className="flex justify-between text-xs text-ink-soft">
        <span>Lower CO₂</span>
        <span>Higher CO₂</span>
      </div>
    </div>
  );
}
