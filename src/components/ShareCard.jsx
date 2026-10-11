// ShareCard.jsx: download a weekly or monthly summary card as a PDF to post on social media.
// On phones that can share files, a Share button sends it straight to WhatsApp or Instagram.
import { useState } from 'react';
import { periodSummary } from '../lib/calc.js';
import { buildSharePdf, shareFileName } from '../lib/shareCard.js';

export default function ShareCard({ activities, trees, settings }) {
  const [name, setName] = useState('');
  const [note, setNote] = useState(null);

  function make(days) {
    const s = periodSummary(activities, trees, settings, new Date(), days);
    return { s, doc: buildSharePdf(s, { name: name.trim() }) };
  }

  function download(days) {
    const { s, doc } = make(days);
    doc.save(shareFileName(s));
    setNote(`Saved ${shareFileName(s)} to your downloads.`);
  }

  async function share(days) {
    const { s, doc } = make(days);
    const file = new File([doc.output('blob')], shareFileName(s), { type: 'application/pdf' });
    try {
      await navigator.share({ files: [file], title: 'My TerraTrack card', text: 'My carbon footprint this ' + (days === 7 ? 'week' : 'month') });
    } catch {
      // the user closed the share sheet: nothing to do
    }
  }

  const canShare = typeof navigator !== 'undefined' && navigator.canShare?.({ files: [new File([''], 'x.pdf', { type: 'application/pdf' })] });

  return (
    <section className="rounded-3xl bg-white border border-sky-line p-5 space-y-3">
      <div>
        <h2 className="font-display font-semibold text-xl">Share your card</h2>
        <p className="text-sm text-ink-soft">A one-page PDF of your footprint and what you did for the planet. Post it and get your friends tracking.</p>
      </div>
      <input
        value={name}
        onChange={(ev) => setName(ev.target.value)}
        placeholder="Your name on the card (optional)"
        className="field w-full"
        maxLength={40}
      />
      <div className="flex flex-wrap gap-2">
        {[[7, 'Weekly card'], [30, 'Monthly card']].map(([days, label]) => (
          <div key={days} className="flex gap-1">
            <button onClick={() => download(days)} className="px-5 py-2.5 rounded-full bg-sprout text-white font-semibold hover:bg-sprout-dark">
              {label} PDF
            </button>
            {canShare && (
              <button onClick={() => share(days)} className="px-4 py-2.5 rounded-full bg-sky-card font-semibold hover:bg-sky-line">
                Share
              </button>
            )}
          </div>
        ))}
      </div>
      {note && <p className="text-sm text-pro-fg">{note}</p>}
    </section>
  );
}
