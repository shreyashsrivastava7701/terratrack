// TripTracker.jsx: "Track a trip". Uses the phone's live GPS while you travel, adds up the km,
// guesses how you travelled from your speed, and asks you to confirm before anything is logged.
// GPS in a browser needs https on a phone: run "npm run dev:phone" (see README).
import { useEffect, useRef, useState } from 'react';
import { addFix, newTrip, guessMode, simulatedRide } from '../lib/tracker.js';
import { kgPerUnit } from '../lib/calc.js';
import { itemLabel } from '../data/labels.js';

export default function TripTracker({ onLog, onChangeMode }) {
  const [trip, setTrip] = useState(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null); // { km, minutes, guess, mode }
  const watchId = useRef(null);
  const wakeLock = useRef(null);
  const [now, setNow] = useState(Date.now());
  const [signal, setSignal] = useState(null); // accuracy in metres of the latest fix
  const [demo, setDemo] = useState(false);
  const demoTimer = useRef(null);

  useEffect(() => () => stopWatching(), []);
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [running]);

  function stopWatching() {
    clearInterval(demoTimer.current);
    if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
    wakeLock.current?.release?.().catch(() => {});
    wakeLock.current = null;
  }

  async function start() {
    setError(null);
    setResult(null);
    if (!('geolocation' in navigator)) return setError('This browser has no GPS access.');
    if (!window.isSecureContext) return setError('GPS needs https. On your phone, open the https address from "npm run dev:phone".');
    setTrip(newTrip());
    setRunning(true);
    setDemo(false);
    setSignal(null);
    try { wakeLock.current = await navigator.wakeLock?.request('screen'); } catch { /* not supported: fine */ }
    const onFix = (pos) => {
      setSignal(Math.round(pos.coords.accuracy));
      setTrip((t) => t && addFix(t, {
        lat: pos.coords.latitude, lon: pos.coords.longitude, t: Date.now(), accuracy: pos.coords.accuracy,
      }));
    };
    // A quick first fix (Wi-Fi or cell is fine), then high-accuracy GPS updates as you move
    navigator.geolocation.getCurrentPosition(onFix, () => {}, { enableHighAccuracy: false, maximumAge: 60000, timeout: 10000 });
    watchId.current = navigator.geolocation.watchPosition(
      onFix,
      (err) => {
        // code 3 is a timeout: the signal is weak for a moment, the watch keeps going
        if (err.code === 1) setError('Location permission was denied. Allow it in the browser settings.');
        else if (err.code === 2) setError('No GPS signal. Go near a window or outside.');
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 },
    );
  }

  // For laptops and stage demos: replays a made-up 4 km auto ride in about 15 seconds
  function startDemo() {
    setError(null);
    setResult(null);
    const fixes = simulatedRide();
    const start = Date.now();
    setTrip({ ...newTrip(start), startedAt: start });
    setRunning(true);
    setDemo(true);
    setSignal(8);
    let i = 0;
    demoTimer.current = setInterval(() => {
      if (i >= fixes.length) { clearInterval(demoTimer.current); return; }
      const f = fixes[i++];
      setTrip((t) => t && addFix(t, { ...f, t: start + (f.t - fixes[0].t) }));
    }, 330);
  }

  function stop() {
    stopWatching();
    setError(null);
    setRunning(false);
    const guess = guessMode(trip.speeds);
    const km = Math.round(trip.km * 10) / 10;
    const lastT = trip.points.at(-1)?.t ?? Date.now();
    const minutes = Math.round(((demo ? lastT : Date.now()) - trip.startedAt) / 60000);
    if (km < 0.1) return setResult({ km, minutes, guess, mode: guess.mode });
    // Straight onto the check card as a preview; the user confirms or changes it there
    const hint = `Detected from GPS: ${km} km, average ${Math.round(guess.medianKmh)} km/h, top ${Math.round(guess.topKmh)} km/h`;
    const key = onLog(guess.mode, km, `Tracked trip, ${minutes} min`, hint);
    setResult({ km, minutes, guess, mode: guess.mode, key });
    setTimeout(() => document.getElementById('check-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 150);
  }

  const clock = demo ? (trip?.points.at(-1)?.t ?? trip?.startedAt) : now; // the demo ride runs on its own fast clock
  const elapsed = trip ? Math.max(0, Math.floor((clock - trip.startedAt) / 1000)) : 0;
  const lastSpeed = trip?.speeds.at(-1);
  const liveGuess = trip && trip.speeds.filter((v) => v >= 1.5).length >= 3 ? guessMode(trip.speeds) : null;

  return (
    <section className="rounded-3xl bg-white border border-sky-line p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Track a trip</p>
          <p className="text-xs text-ink-soft">Start when you leave, stop when you arrive. Keep this page open.</p>
        </div>
        {running ? (
          <button onClick={stop} className="px-5 py-2.5 rounded-full bg-con-fg text-white font-semibold shrink-0">Stop</button>
        ) : (
          <button onClick={start} className="px-5 py-2.5 rounded-full bg-sprout text-white font-semibold shrink-0">Start</button>
        )}
      </div>

      {running && trip && (
        <div className="grid grid-cols-3 gap-2 text-center">
          <Live value={`${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`} label="time" />
          <Live value={trip.km.toFixed(2)} label="km" />
          <Live value={lastSpeed != null ? Math.round(lastSpeed) : '–'} label="km/h now" />
        </div>
      )}
      {running && liveGuess && (
        <p className="rounded-2xl bg-sprout-light px-3 py-2 text-sm text-sprout-dark">
          Looks like you're going by <b>{itemLabel(liveGuess.mode).toLowerCase()}</b> (about {Math.round(liveGuess.medianKmh)} km/h)
        </p>
      )}
      {running && (
        <p className="text-xs text-ink-soft">
          {demo
            ? 'Demo ride: replaying a made-up 4 km auto trip, sped up.'
            : signal == null
              ? 'Looking for your location… On a laptop this can take a few seconds; allow location when asked.'
              : `Location found (±${signal} m). ${signal > 100 ? 'Weak signal: go near a window or outside.' : 'Start moving; distance adds up as you travel.'}`}
        </p>
      )}
      {!running && (!result || result.km < 0.1) && (
        <button onClick={startDemo} className="text-sm text-sprout font-semibold">
          No GPS here? Try a demo ride
        </button>
      )}

      {result && (
        <div className="rounded-2xl bg-sky-card p-3 space-y-2">
          {result.km < 0.1 ? (
            <p className="text-sm">That trip was too short to log (under 100 m).</p>
          ) : (
            <>
              <p className="text-sm">
                <b>{result.km} km</b> in {result.minutes} min · average {Math.round(result.guess.medianKmh)} km/h.
                Looks like <b>{itemLabel(result.mode).toLowerCase()}</b> ({(kgPerUnit('transport', result.mode) * result.km).toFixed(2)} kg CO₂e).
                It's on the check card below: tap Save, or pick the right vehicle.
              </p>
              <div className="flex flex-wrap gap-2">
                {result.guess.choices.map((m) => (
                  <button
                    key={m}
                    onClick={() => { setResult({ ...result, mode: m }); onChangeMode?.(result.key, m); }}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium ${result.mode === m ? 'bg-sprout text-white' : 'bg-white'}`}
                  >
                    {itemLabel(m)}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
      {error && <p className="text-sm text-sun-dark">{error}</p>}
    </section>
  );
}

function Live({ value, label }) {
  return (
    <div className="rounded-2xl bg-sky-card py-2">
      <p className="font-display font-bold text-2xl tabular-nums">{value}</p>
      <p className="text-xs text-ink-soft">{label}</p>
    </div>
  );
}
