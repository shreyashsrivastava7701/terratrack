// EntryFeedback.jsx: the verdict sentence under an entry, plus a swap and a tip
// for Neutral and Con entries. Every number comes from calc.js.
import { verdict, swapFor, tipFor } from '../lib/calc.js';
import { sectorLabel } from '../lib/items.js';
import { itemLabel } from '../data/labels.js';

export default function EntryFeedback({ sector, item, qty, compact = false }) {
  if (sector === 'eco') return null;
  const v = verdict(sector, item);
  const swap = v.label !== 'pro' ? swapFor(sector, item, qty) : null;
  const tip = v.label !== 'pro' ? tipFor(item) : null;

  // One plain sentence about how this item compares with a typical one
  let sentence;
  if (sector === 'waste') sentence = 'Waste always counts as Con: every piece adds up.';
  else if (v.ratio === 0) sentence = 'Zero emissions. Nice one.';
  else sentence = `${Math.round(v.ratio * 100)}% of a typical ${sectorLabel(sector).toLowerCase()} choice.`;

  return (
    <div className={`text-xs space-y-1 ${compact ? '' : 'pt-1'}`}>
      <p className="text-ink-soft">{sentence}</p>
      {swap && swap.savedKg > 0 && (
        <p className="text-pro-fg font-medium">
          Swap: {itemLabel(swap.item)} instead saves {swap.savedKg.toFixed(2)} kg
        </p>
      )}
      {tip && <p className="text-ink-soft">Tip: {tip}</p>}
    </div>
  );
}
