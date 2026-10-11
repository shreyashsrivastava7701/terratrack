// Log.jsx: where the user adds activities.
// Three ways in: speak, type a sentence and tap Parse, or tap a chip.
// Nothing is saved until the user checks the confirm card and taps Save.
import { useState } from 'react';
import { TABS, itemsForTab } from '../lib/items.js';
import { itemLabel } from '../data/labels.js';
import { parse as aiParse } from '../lib/ai.js';
import { saveEntries, useStore, updateSettings } from '../lib/store.js';
import ConfirmCard from '../components/ConfirmCard.jsx';
import MicButton from '../components/MicButton.jsx';
import StatusDot from '../components/StatusDot.jsx';
import ItemSearch from '../components/ItemSearch.jsx';
import ReceiptUpload from '../components/ReceiptUpload.jsx';
import TreePhoto from '../components/TreePhoto.jsx';
import RoutePlanner from '../components/RoutePlanner.jsx';
import TripTracker from '../components/TripTracker.jsx';
import { useCampusApi } from '../lib/campusApi.js';
import { dayKey } from '../lib/calc.js';
import { checkTreePhoto } from '../lib/ai.js';

const PLACEHOLDERS = {
  transport: 'e.g. aaj 8 km auto se gaya',
  energy: 'e.g. AC for 4 hours and fan all night',
  food: 'e.g. dal rice for lunch, chicken for dinner',
  shopping: 'e.g. bought a T-shirt from a thrift shop',
  waste: 'e.g. used two plastic bags',
  water: 'e.g. 10 minute hot shower',
  digital: 'e.g. watched 3 hours of YouTube',
  eco: 'e.g. composted half a kg and planted a tree',
  all: 'e.g. 8 km by metro, dal rice for lunch, 2 hours of AC',
};

let nextKey = 1; // a simple counter so React can tell the rows apart

export default function Log({ onNavigate }) {
  const { settings } = useStore();
  const campus = useCampusApi();
  const [tab, setTab] = useState('transport');
  const [text, setText] = useState('');
  const [draft, setDraft] = useState([]); // entries waiting on the confirm card
  const [source, setSource] = useState(null); // "gemma", "keyword" or "chip"
  const [message, setMessage] = useState(null); // "Saved..." or "Couldn't find..."
  const [busy, setBusy] = useState(false); // true while Gemma is reading
  const [showAllChips, setShowAllChips] = useState(false);
  const [treePhoto, setTreePhoto] = useState(null); // { preview, image } when a tree is being logged
  const hasTree = draft.some((d) => d.item === 'tree');

  // Long chip lists (like the All tab) show the first 12 until "Show all" is tapped
  const chips = itemsForTab(tab);
  const visibleChips = showAllChips ? chips : chips.slice(0, 12);

  // Send the sentence to Gemma (or the keyword parser if Gemma is down), once per tap
  async function parse() {
    if (!text.trim() || busy) return;
    setBusy(true);
    setMessage(null);
    const result = await aiParse(text, tab);
    setBusy(false);

    const skipped = result.dropped.length > 0 ? ` (skipped: ${result.dropped.join(', ')})` : '';
    if (result.entries.length === 0) {
      setMessage({ kind: 'warn', text: `We couldn't match that to an activity${skipped}. Try a chip, or name it like "8 km auto".` });
      return;
    }
    const entries = result.entries.map((e) => ({
      key: nextKey++, sector: e.sector, item: e.item, qty: e.quantity, match: e.match,
    }));
    setDraft([...draft, ...entries]);
    setSource(result.source);
    if (skipped) setMessage({ kind: 'warn', text: `Some words didn't match an activity${skipped}.` });
  }

  // A chip adds one entry with quantity 1, and puts the cursor in its quantity box
  // "name" is set when the item came from Search any item (e.g. "Chicken biryani")
  function addChip(sector, item, name = null) {
    const entry = name
      ? { key: nextKey++, sector, item, qty: 1, match: 'closest', heard: name, note: name, focus: true }
      : { key: nextKey++, sector, item, qty: 1, match: 'exact', focus: true };
    setDraft([...draft.map((d) => ({ ...d, focus: false })), entry]);
    if (!source) setSource('chip');
    setMessage(null);
  }

  // A trip from the route planner or the GPS tracker goes to the confirm card like any other entry
  // hint (GPS only) explains the guess, e.g. "Detected from GPS: average 25 km/h"; returns the row's key
  function addTrip(item, km, note, hint = null) {
    const key = nextKey++;
    setDraft((d) => [...d, { key, sector: 'transport', item, qty: km, match: hint ? 'closest' : 'exact', note, hint }]);
    if (!source) setSource('chip');
    setMessage(null);
    return key;
  }

  // The tracker's "Not auto? pick another" chips change the row already on the check card
  function changeTripMode(key, item) {
    setDraft((d) => d.map((row) => (row.key === key ? { ...row, item } : row)));
  }

  function save() {
    if (hasTree && !treePhoto) {
      setMessage({ kind: 'warn', text: 'Add a photo of your planting first. It is how your college checks tree entries.' });
      return;
    }
    const saved = saveEntries(draft);
    // Each tree entry gets the photo as proof; the AI gives a first opinion, the college decides
    if (hasTree) {
      const { preview, image } = treePhoto;
      for (const a of saved.filter((x) => x.item === 'tree')) {
        campus.addProof({ activityId: a.id, photo: preview, day: dayKey(a.ts) })
          .then((proofId) => checkTreePhoto(image).then((ai) => campus.setProofAi(proofId, ai)));
      }
      setTreePhoto(null);
    }
    const n = draft.length;
    setDraft([]);
    setText('');
    setSource(null);
    setMessage({ kind: 'ok', text: `Saved ${n} ${n === 1 ? 'entry' : 'entries'}.` });
  }

  function cancel() {
    setDraft([]);
    setTreePhoto(null);
    setSource(null);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h1 className="font-display font-bold text-3xl">Log an activity</h1>
        <StatusDot />
      </div>

      {/* All nine tabs, wrapping onto a second line when needed */}
      <div>
        <div className="flex flex-wrap gap-2" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => {
                setTab(t.id);
                setShowAllChips(false);
              }}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                tab === t.id ? 'bg-sprout text-white' : 'bg-sky-card text-ink hover:bg-sky-line'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Mic: the biggest button. Speech fills the text box so you can fix words before parsing. */}
      <MicButton
        language={settings.language}
        onLanguageChange={(language) => updateSettings({ language })}
        onText={(heard) => {
          setText(heard);
          setMessage(null);
        }}
        onError={(msg) => setMessage({ kind: 'warn', text: msg })}
      />

      {/* Text box + Parse */}
      <form
        onSubmit={(ev) => {
          ev.preventDefault();
          parse();
        }}
        className="flex gap-2"
      >
        <input
          id="log-text"
          value={text}
          onChange={(ev) => setText(ev.target.value)}
          placeholder={PLACEHOLDERS[tab]}
          className="flex-1 min-w-0 h-14 px-5 rounded-full bg-white border-2 border-sky-line focus:border-sprout outline-none text-base"
          aria-label="What did you do?"
        />
        <button
          type="submit"
          disabled={!text.trim() || busy}
          className="h-14 px-6 rounded-full bg-sprout text-white font-semibold hover:bg-sprout-dark disabled:opacity-40 transition-colors"
        >
          {busy ? 'Reading…' : 'Parse'}
        </button>
      </form>

      {/* Chips: one tap adds an entry */}
      <section>
        <p className="text-sm text-ink-soft mb-2">Or tap to add</p>
        <div className="flex flex-wrap gap-2">
          {visibleChips.map(({ sector, item }) => (
            <button
              key={item}
              onClick={() => addChip(sector, item)}
              className="px-4 py-2.5 rounded-full bg-sky-card text-sm font-medium hover:bg-sprout-light hover:text-sprout-dark active:scale-95 transition"
            >
              {itemLabel(item)}
            </button>
          ))}
          {chips.length > 12 && (
            <button
              onClick={() => setShowAllChips(!showAllChips)}
              className="px-4 py-2.5 rounded-full text-sm font-semibold text-sprout hover:bg-sprout-light"
            >
              {showAllChips ? 'Show fewer' : `Show all ${chips.length}`}
            </button>
          )}
        </div>
      </section>

      {tab === 'transport' && (
        <>
          <TripTracker onLog={addTrip} onChangeMode={changeTripMode} />
          <RoutePlanner onLog={addTrip} />
        </>
      )}

      <ItemSearch tab={tab} onPick={addChip} />

      <ReceiptUpload
        onEntries={(entries, from) => {
          const rows = entries.map((e) => ({
            key: nextKey++, sector: e.sector, item: e.item, qty: e.quantity, match: e.match,
            ...(e.name ? { heard: e.name, note: e.name } : {}),
          }));
          setDraft([...draft, ...rows]);
          setSource(from);
          setMessage(null);
        }}
      />

      {message && (
        <div className={`rounded-2xl px-4 py-3 text-sm flex items-center justify-between gap-3 ${
          message.kind === 'ok' ? 'bg-pro-bg text-pro-fg' : 'bg-sun text-sun-dark'
        }`}>
          <span>{message.text}</span>
          {message.kind === 'ok' && (
            <button onClick={() => onNavigate('today')} className="font-semibold underline underline-offset-2">
              See Today
            </button>
          )}
        </div>
      )}

      {draft.length > 0 && (
        <ConfirmCard
          entries={draft} onChange={setDraft} onSave={save} onCancel={cancel} source={source}
          blocker={hasTree && !treePhoto ? 'Upload a photo of the tree you planted to save this entry.' : null}
        >
          {hasTree && <TreePhoto photo={treePhoto} onPhoto={setTreePhoto} />}
        </ConfirmCard>
      )}
    </div>
  );
}
