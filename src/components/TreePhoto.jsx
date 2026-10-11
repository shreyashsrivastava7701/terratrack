// TreePhoto.jsx: a tree entry needs a photo of the planting. It is saved small (480 px)
// with the entry; the AI gives a first opinion and the college approves or rejects it.
import { useRef } from 'react';
import { toSmallJpeg } from '../lib/image.js';

export default function TreePhoto({ photo, onPhoto }) {
  const input = useRef(null);

  async function pick(ev) {
    const file = ev.target.files?.[0];
    ev.target.value = '';
    if (!file) return;
    try {
      onPhoto(await toSmallJpeg(file, 480, 0.7));
    } catch {
      alert("That file couldn't be opened. Use a JPG or PNG photo.");
    }
  }

  return (
    <section className="rounded-3xl bg-sun p-4 space-y-3">
      <div>
        <p className="font-semibold text-sun-dark">{photo ? '✓ Tree photo added' : '📸 Upload a photo of your planted tree'}</p>
        <p className="text-xs text-sun-dark">Show the sapling in the soil. AI checks it, then your college approves it.</p>
      </div>
      <div className="flex items-center gap-3">
        {photo
          ? <img src={photo.preview} alt="Your planting" className="w-16 h-16 rounded-xl object-cover" />
          : <div className="w-16 h-16 rounded-xl bg-white/70 grid place-items-center text-2xl" aria-hidden="true">🌱</div>}
        <button onClick={() => input.current.click()} className="px-5 py-2.5 rounded-full bg-white font-semibold">
          {photo ? 'Change photo' : 'Take or choose photo'}
        </button>
      </div>
      <input ref={input} type="file" accept="image/*" onChange={pick} className="hidden" />
    </section>
  );
}
