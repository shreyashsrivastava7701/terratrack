// EntryList.jsx: a list of saved activities with their kg and badge.
import { verdict } from '../lib/calc.js';
import { unitText } from '../lib/items.js';
import { itemLabel } from '../data/labels.js';
import { removeActivity } from '../lib/store.js';
import Badge from './Badge.jsx';
import EntryFeedback from './EntryFeedback.jsx';

export default function EntryList({ activities }) {
  return (
    <ul className="space-y-2">
      {activities.map((a) => (
        <li key={a.id} className="rounded-2xl bg-white border border-sky-line px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">
                {a.note ?? itemLabel(a.item)}
                {a.note && <span className="text-xs font-normal text-ink-soft"> · as {itemLabel(a.item).toLowerCase()}</span>}
              </p>
              <p className="text-xs text-ink-soft">
                {a.qty} {unitText(a.sector, a.item, a.qty)} ·{' '}
                {new Date(a.ts).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}
              </p>
            </div>
            <Amount activity={a} />
            <button
              onClick={() => removeActivity(a.id)}
              className="shrink-0 w-9 h-9 rounded-full text-ink-soft hover:bg-con-bg hover:text-con-fg"
              aria-label={`Delete ${itemLabel(a.item)}`}
            >
              ×
            </button>
          </div>
          {a.kind === 'emit' && verdict(a.sector, a.item).label !== 'pro' && (
            <EntryFeedback sector={a.sector} item={a.item} qty={a.qty} />
          )}
        </li>
      ))}
    </ul>
  );
}

function Amount({ activity: a }) {
  if (a.kind === 'offset') {
    if (a.rejected) return <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-con-bg text-con-fg">Photo rejected</span>;
    return <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-pro-bg text-pro-fg">Tree</span>;
  }
  if (a.kind === 'credit') {
    return (
      <span className="flex items-center gap-2">
        <span className="tabular-nums font-semibold text-pro-fg">−{a.kg.toFixed(2)}</span>
        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-pro-bg text-pro-fg">Credit</span>
      </span>
    );
  }
  return (
    <span className="flex items-center gap-2">
      <span className="tabular-nums font-semibold">{a.kg.toFixed(2)}</span>
      <Badge label={verdict(a.sector, a.item).label} />
    </span>
  );
}
