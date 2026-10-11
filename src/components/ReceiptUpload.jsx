// ReceiptUpload.jsx: upload a screenshot (Swiggy, Zomato, Myntra, Amazon, Uber...) or a bill.
// The AI lists what was bought or used; the entries go to the confirm card, where the user
// checks them before saving. The picture is shrunk first and is never stored.
import { useRef, useState } from 'react';
import { readReceipt } from '../lib/ai.js';
import { toSmallJpeg } from '../lib/image.js';

export default function ReceiptUpload({ onEntries }) {
  const input = useRef(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);
  const [people, setPeople] = useState(1); // for electricity bills shared by a home

  async function pick(ev) {
    const file = ev.target.files?.[0];
    ev.target.value = '';
    if (!file) return;
    setNote(null);
    setBusy(true);
    try {
      const small = await toSmallJpeg(file);
      setPreview(small.preview);
      const result = await readReceipt(small.image);
      if (result.entries.length === 0) {
        setNote(result.source
          ? "We couldn't find anything to log in that picture. Try a clearer screenshot of the order or bill."
          : `The AI couldn't read it right now (${result.reason}). Try again, or type it instead.`);
      } else {
        const share = Math.max(1, people);
        const entries = result.entries.map((e) => e.item === 'electricity_kwh'
          ? { ...e, quantity: Math.round((e.quantity / share) * 10) / 10, name: share > 1 ? `${e.name ?? 'Electricity bill'} (your share of ${share})` : e.name }
          : e);
        onEntries(entries, result.source);
        const skipped = result.dropped.length ? ` Skipped: ${result.dropped.join(', ')}.` : '';
        setNote(`Read ${result.title || 'your picture'}: ${entries.length} ${entries.length === 1 ? 'item' : 'items'} added below. Check them, then Save.${skipped}`);
      }
    } catch {
      setNote("That file couldn't be opened. Use a PNG or JPG screenshot.");
    }
    setBusy(false);
  }

  return (
    <section className="rounded-3xl bg-white border border-sky-line p-4 space-y-3">
      <div className="flex items-center gap-3">
        {preview
          ? <img src={preview} alt="Your upload" className="w-14 h-14 rounded-xl object-cover border border-sky-line" />
          : <div className="w-14 h-14 rounded-xl bg-sky-card grid place-items-center text-2xl" aria-hidden="true">🧾</div>}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Upload an order or bill</p>
          <p className="text-xs text-ink-soft">Swiggy, Zomato, Myntra, Amazon, Uber, electricity bill or a receipt</p>
        </div>
        <button
          onClick={() => input.current.click()}
          disabled={busy}
          className="px-4 py-2.5 rounded-full bg-sprout text-white font-semibold hover:bg-sprout-dark disabled:opacity-50 shrink-0"
        >
          {busy ? 'Reading…' : 'Upload'}
        </button>
        <input ref={input} type="file" accept="image/*" onChange={pick} className="hidden" />
      </div>
      <label className="flex items-center gap-2 text-xs text-ink-soft">
        Electricity bill shared by
        <input
          type="number" min="1" max="20" value={people}
          onChange={(ev) => setPeople(Number(ev.target.value) || 1)}
          className="w-14 rounded-lg border border-sky-line px-2 py-1 text-ink"
        />
        people
      </label>
      {note && <p className="text-sm rounded-2xl bg-sky-card px-3 py-2">{note}</p>}
    </section>
  );
}
