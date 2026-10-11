// ImpactCard.jsx: "What this means". Code works out the hard facts from the year forecast
// (tonnes, trees, Arctic sea ice); the AI turns them into one honest, moving line and
// three everyday ideas. Any number the AI adds on its own gets the answer rejected.
import { useEffect, useState } from 'react';
import { impactFacts } from '../lib/calc.js';
import { impact } from '../lib/ai.js';

export default function ImpactCard({ forecastTonnes, topSectors }) {
  const facts = impactFacts(forecastTonnes);
  const factsKey = JSON.stringify({ facts, topSectors });
  const [result, setResult] = useState(null);

  useEffect(() => {
    let live = true;
    setResult(null);
    impact(JSON.parse(factsKey).facts, topSectors).then((r) => live && setResult(r));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [factsKey]);

  const sourceText = {
    gemma: 'Words by Gemma 4. Numbers from the app.',
    gemini: 'Words by Gemini (backup). Numbers from the app.',
    template: 'Written by the app from your numbers.',
  };

  return (
    <section className="rounded-3xl bg-ink text-white p-5 space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-white/60">What this means</p>
        <h2 className="font-display font-semibold text-xl">
          {facts.forecastTonnes} t a year at this pace
        </h2>
        <p className="text-sm text-white/60">A 1.5 °C-safe share is about {facts.targetTonnes} t a year.</p>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <Fact value={`${facts.timesTarget}×`} label="a 1.5 °C-safe share" />
        <Fact value={facts.treesForAYear} label="grown trees needed for a year" />
        <Fact value={`${facts.seaIceM2} m²`} label="Arctic sea ice lost a year" />
      </div>

      {result ? (
        <>
          <p className="text-lg leading-relaxed font-medium">{result.line}</p>
          <div>
            <p className="text-sm font-semibold text-sprout-light mb-2">Try this, starting tomorrow</p>
            <ol className="space-y-2">
              {result.ideas.map((idea, i) => (
                <li key={i} className="flex gap-3 rounded-2xl bg-white/10 p-3 text-sm">
                  <span className="font-display font-bold text-sprout-light">{i + 1}</span>
                  <span>{idea}</span>
                </li>
              ))}
            </ol>
          </div>
          <p className="text-xs text-white/60">{sourceText[result.source]} Sea ice: about 3 m² per tonne of CO₂ (Notz &amp; Stroeve, 2016).</p>
        </>
      ) : (
        <p className="text-sm text-white/70">Reading your forecast…</p>
      )}
    </section>
  );
}

function Fact({ value, label }) {
  return (
    <div className="rounded-2xl bg-white/10 px-2 py-3">
      <p className="font-display font-bold text-2xl tabular-nums">{value}</p>
      <p className="text-xs text-white/70 leading-tight">{label}</p>
    </div>
  );
}
