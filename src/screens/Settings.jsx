// Settings.jsx: your usual commute and meal, voice language and daily budget.
// Changes save straight away.
import { useStore, updateSettings } from '../lib/store.js';
import { itemsOf } from '../lib/items.js';
import { itemLabel } from '../data/labels.js';
import DemoTools from '../components/DemoTools.jsx';
import MathsCheck from '../components/MathsCheck.jsx';
import StatusDot, { useAiStatus } from '../components/StatusDot.jsx';

export default function Settings({ onNavigate }) {
  const { settings } = useStore();
  const aiStatus = useAiStatus();

  return (
    <div className="space-y-4">
      <h1 className="font-display font-bold text-3xl">Settings</h1>

      <section className="rounded-3xl bg-white border border-sky-line divide-y divide-sky-line">
        <Row label="Usual commute" hint="Used for “saved vs your usual”" htmlFor="set-commute">
          <select
            id="set-commute"
            value={settings.baseline.transport}
            onChange={(e) => updateSettings({ baseline: { ...settings.baseline, transport: e.target.value } })}
            className="field"
          >
            {itemsOf('transport').map((it) => <option key={it} value={it}>{itemLabel(it)}</option>)}
          </select>
        </Row>

        <Row label="Usual meal" hint="Your typical lunch or dinner" htmlFor="set-meal">
          <select
            id="set-meal"
            value={settings.baseline.food}
            onChange={(e) => updateSettings({ baseline: { ...settings.baseline, food: e.target.value } })}
            className="field"
          >
            {itemsOf('food').map((it) => <option key={it} value={it}>{itemLabel(it)}</option>)}
          </select>
        </Row>

        <Row label="Voice language" hint="For the mic on the Log screen" htmlFor="set-lang">
          <select
            id="set-lang"
            value={settings.language}
            onChange={(e) => updateSettings({ language: e.target.value })}
            className="field"
          >
            <option value="en-IN">English</option>
            <option value="hi-IN">हिंदी (Hindi)</option>
          </select>
        </Row>

        <Row label="Daily budget" hint="6 kg is about a 1.5 °C-aligned day" htmlFor="set-budget">
          <div className="flex items-center gap-2">
            <input
              id="set-budget"
              type="number"
              min="1"
              max="30"
              step="0.5"
              value={settings.dailyBudgetKg}
              onChange={(e) => {
                const kg = parseFloat(e.target.value);
                if (kg >= 1 && kg <= 30) updateSettings({ dailyBudgetKg: kg });
              }}
              className="field w-20 text-right tabular-nums"
            />
            <span className="text-ink-soft">kg</span>
          </div>
        </Row>

        <Row label="Gemma connection" hint={aiStatus.message}>
          <StatusDot />
        </Row>
      </section>

      <MathsCheck />

      <DemoTools onNavigate={onNavigate} />
    </div>
  );
}

function Row({ label, hint, htmlFor, children }) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-4">
      <div className="min-w-0 flex-1">
        <label htmlFor={htmlFor} className="font-medium">{label}</label>
        {hint && <p className="text-xs text-ink-soft">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
