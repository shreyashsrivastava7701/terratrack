// ConfirmCard.jsx: shows the entries we understood, before anything is saved.
// The user can change the item, change the quantity, or remove an entry, then tap Save.
import { kgFor, verdict } from '../lib/calc.js';
import { SECTOR_IDS, itemsOf, sectorLabel, unitText, maxQty, stepFor, sectorOf } from '../lib/items.js';
import { itemLabel } from '../data/labels.js';
import Badge from './Badge.jsx';
import EntryFeedback from './EntryFeedback.jsx';

// children: extra content above the Save button (the tree photo box). blocker: why Save is not allowed yet.
export default function ConfirmCard({ entries, onChange, onSave, onCancel, source, children, blocker }) {
  // Change one entry, e.g. update({ qty: 3 })
  function update(index, changes) {
    onChange(entries.map((e, i) => (i === index ? { ...e, ...changes } : e)));
  }

  function remove(index) {
    onChange(entries.filter((_, i) => i !== index));
  }

  return (
    <section id="check-card" className="rounded-3xl bg-white border-2 border-sprout/30 p-4 sm:p-5 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display font-semibold text-xl">Check before saving</h2>
        {source === 'keyword' && (
          <span className="text-xs px-3 py-1 rounded-full bg-sky-card text-ink-soft">fallback parser</span>
        )}
        {source === 'gemma' && (
          <span className="text-xs px-3 py-1 rounded-full bg-sprout-light text-sprout-dark">read by Gemma 4</span>
        )}
        {source === 'gemini' && (
          <span className="text-xs px-3 py-1 rounded-full bg-sky-card text-ink">read by Gemini (backup)</span>
        )}
      </div>

      {entries.length === 0 && (
        <p className="text-sm text-ink-soft">No entries left. Tap a chip or type again.</p>
      )}

      <ul className="space-y-3">
        {entries.map((e, i) => (
          <EntryRow
            key={e.key}
            entry={e}
            onItemChange={(item) => update(i, { item, sector: sectorOf(item), match: 'exact' })}
            onQtyChange={(qty) => update(i, { qty })}
            onRemove={() => remove(i)}
          />
        ))}
      </ul>

      {children}
      {blocker && <p className="text-sm font-medium text-sun-dark">{blocker}</p>}

      <div className="flex gap-3 pt-1">
        <button
          onClick={onSave}
          disabled={entries.length === 0 || Boolean(blocker)}
          className="flex-1 py-3 rounded-full bg-sprout text-white font-semibold hover:bg-sprout-dark disabled:opacity-40 transition-colors"
        >
          Save {entries.length > 1 ? `${entries.length} entries` : 'entry'}
        </button>
        <button onClick={onCancel} className="px-5 py-3 rounded-full bg-sky-card font-medium hover:bg-sky-line">
          Cancel
        </button>
      </div>
    </section>
  );
}

function EntryRow({ entry, onItemChange, onQtyChange, onRemove }) {
  const { sector, item, qty } = entry;
  const step = stepFor(sector, item);
  const max = maxQty(sector, item);
  const kg = kgFor(sector, item, qty);

  // Keep the quantity between one step and the maximum, rounded neatly
  const setQty = (value) => {
    const clean = Math.min(max, Math.max(step, Math.round(value * 100) / 100));
    if (!Number.isNaN(clean)) onQtyChange(clean);
  };

  return (
    <li className="rounded-2xl bg-sky-card p-3 space-y-3">
      <div className="flex items-start gap-2">
        {/* Item dropdown, grouped by sector */}
        <select
          value={item}
          onChange={(ev) => onItemChange(ev.target.value)}
          className="flex-1 min-w-0 rounded-xl bg-white border border-sky-line px-3 py-2.5 font-medium"
          aria-label="Item"
        >
          {SECTOR_IDS.map((s) => (
            <optgroup key={s} label={sectorLabel(s)}>
              {itemsOf(s).map((it) => (
                <option key={it} value={it}>{itemLabel(it)}</option>
              ))}
            </optgroup>
          ))}
        </select>
        <button
          onClick={onRemove}
          className="shrink-0 w-11 h-11 rounded-xl text-ink-soft hover:bg-con-bg hover:text-con-fg text-xl"
          aria-label={`Remove ${itemLabel(item)}`}
        >
          ×
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Quantity stepper */}
        <div className="flex items-center gap-1">
          <button onClick={() => setQty(qty - step)} className="w-11 h-11 rounded-xl bg-white text-xl font-semibold" aria-label="Less">−</button>
          <input
            type="number"
            value={qty}
            step={step}
            min={step}
            max={max}
            onChange={(ev) => setQty(parseFloat(ev.target.value))}
            className="w-20 h-11 rounded-xl bg-white text-center font-semibold tabular-nums"
            aria-label="Quantity"
            autoFocus={entry.focus}
          />
          <button onClick={() => setQty(qty + step)} className="w-11 h-11 rounded-xl bg-white text-xl font-semibold" aria-label="More">+</button>
          <span className="ml-1 text-sm text-ink-soft">{unitText(sector, item, qty)}</span>
        </div>

        <ResultTag sector={sector} item={item} kg={kg} />
      </div>

      <EntryFeedback sector={sector} item={item} qty={qty} compact />

      {entry.hint ? (
        <p className="text-xs text-sun-dark bg-sun rounded-lg px-2 py-1 inline-block">
          🛰 {entry.hint}. Wrong vehicle? Change it in the list above.
        </p>
      ) : entry.match === 'closest' && (
        <p className="text-xs text-sun-dark bg-sun rounded-lg px-2 py-1 inline-block">
          Closest match{entry.heard ? ` for "${entry.heard}"` : ''}: check it's right
        </p>
      )}
    </li>
  );
}

// The kg figure and badge on the right of each entry
function ResultTag({ sector, item, kg }) {
  if (item === 'tree') {
    return <span className="text-sm text-pro-fg font-medium">Goes to your Tree Wallet</span>;
  }
  if (sector === 'eco') {
    return (
      <span className="flex items-center gap-2">
        <span className="font-semibold tabular-nums text-pro-fg">−{kg.toFixed(2)} kg</span>
        <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-pro-bg text-pro-fg">Credit</span>
      </span>
    );
  }
  const v = verdict(sector, item);
  return (
    <span className="flex items-center gap-2">
      <span className="font-semibold tabular-nums">{kg.toFixed(2)} kg</span>
      <Badge label={v.label} />
    </span>
  );
}
