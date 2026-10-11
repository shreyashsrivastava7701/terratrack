// Wallet.jsx: the Eco Wallet. Your trees (their credit grows with age),
// your direct credits, and the rule that trees can cover at most 30% of a day.
import { useState } from 'react';
import { useStore, addTree, removeTree } from '../lib/store.js';
import TreePhoto from '../components/TreePhoto.jsx';
import { useCampusApi } from '../lib/campusApi.js';
import { checkTreePhoto } from '../lib/ai.js';
import { treeKgPerDay, treeKgPerYear, netFootprint, dayKey, addDays } from '../lib/calc.js';
import { itemLabel } from '../data/labels.js';
import { unitText } from '../lib/items.js';
import factors from '../data/emission_factors.json';

export default function Wallet() {
  const { activities, trees, settings } = useStore();
  const today = dayKey();
  const [plantedOn, setPlantedOn] = useState(today);
  const [treePhoto, setTreePhoto] = useState(null); // a tree needs a photo of the planting
  const campus = useCampusApi();
  const capPercent = Math.round(settings.offsetCapShare * 100);
  const todayResult = netFootprint(activities, trees, settings, today);

  // Credits from the last 7 days, newest first
  const weekStart = addDays(today, -6);
  const credits = activities
    .filter((a) => a.kind === 'credit' && dayKey(a.ts) >= weekStart)
    .sort((a, b) => b.ts.localeCompare(a.ts));
  const creditTotal = credits.reduce((t, a) => t + a.kg, 0);

  // Oldest tree first
  const sortedTrees = [...trees].sort((a, b) => a.plantedOn.localeCompare(b.plantedOn));

  return (
    <div className="space-y-5">
      <h1 className="font-display font-bold text-3xl">Eco Wallet</h1>

      <section className="rounded-3xl bg-sprout-light p-5">
        <p className="font-display font-semibold text-xl text-sprout-dark">Reduce first, offset second</p>
        <p className="text-sm mt-1">
          Trees can cover at most {capPercent}% of a day's emissions. A young tree absorbs very little,
          so its credit grows as it gets older.
        </p>
        <p className="text-sm mt-3 font-medium">
          {trees.length === 0
            ? 'You have no trees yet, so nothing is taken off today.'
            : <>
                Today your trees give {todayResult.offsetRaw.toFixed(3)} kg
                {todayResult.capApplied
                  ? `, but only ${todayResult.offset.toFixed(3)} kg counts because of the ${capPercent}% cap.`
                  : ', and all of it counts.'}
              </>}
        </p>
      </section>

      {/* Trees */}
      <section className="rounded-3xl bg-white border border-sky-line p-5 space-y-4">
        <h2 className="font-display font-semibold text-xl">Your trees ({trees.length})</h2>

        <TreePhoto photo={treePhoto} onPhoto={setTreePhoto} />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!treePhoto || !plantedOn || plantedOn > today) return;
            const treeId = addTree(plantedOn);
            const { preview, image } = treePhoto;
            campus.addProof({ activityId: treeId, photo: preview, day: plantedOn })
              .then((proofId) => checkTreePhoto(image).then((ai) => campus.setProofAi(proofId, ai)));
            setTreePhoto(null);
          }}
          className="flex flex-wrap items-end gap-3"
        >
          <label className="flex flex-col gap-1 text-sm" htmlFor="tree-date">
            <span className="text-ink-soft">Planted on</span>
            <input id="tree-date" type="date" value={plantedOn} max={today}
              onChange={(e) => setPlantedOn(e.target.value)} className="field" />
          </label>
          <button type="submit" disabled={!treePhoto} className="px-5 py-2.5 rounded-full bg-sprout text-white font-semibold hover:bg-sprout-dark disabled:opacity-40">
            Add a tree
          </button>
          {!treePhoto && <span className="text-xs text-sun-dark w-full">Upload the tree photo first.</span>}
        </form>

        {sortedTrees.length === 0 ? (
          <p className="text-sm text-ink-soft">No trees yet. Add one you planted, or log "planted a tree" on the Log screen.</p>
        ) : (
          <ul className="divide-y divide-sky-line">
            {sortedTrees.map((t) => {
              const ageDays = Math.max(0, Math.round((new Date(today) - new Date(t.plantedOn)) / 86400000));
              const ageYears = ageDays / 365;
              return (
                <li key={t.id} className={`py-3 flex items-center gap-3 ${t.rejected ? 'opacity-70' : ''}`}>
                  <span className="grid place-items-center w-10 h-10 rounded-full bg-sprout-light text-sprout text-lg shrink-0" aria-hidden="true">
                    {ageYears >= 1 ? '🌳' : '🌱'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">Planted {new Date(t.plantedOn).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                    {t.rejected && <p className="text-xs font-semibold text-con-fg">College rejected the photo, so this tree gives no credit</p>}
                    <p className="text-xs text-ink-soft">
                      {ageDays < 365 ? `${ageDays} days old` : `${ageYears.toFixed(1)} years old`} · about {treeKgPerYear(ageYears).toFixed(1)} kg a year
                    </p>
                  </div>
                  <span className="tabular-nums font-semibold text-pro-fg text-right">
                    −{(t.rejected ? 0 : treeKgPerDay(t, today)).toFixed(4)}<span className="block text-xs font-normal text-ink-soft">kg a day</span>
                  </span>
                  <button onClick={() => removeTree(t.id)} className="w-9 h-9 rounded-full text-ink-soft hover:bg-con-bg hover:text-con-fg" aria-label="Remove tree">×</button>
                </li>
              );
            })}
          </ul>
        )}

        {/* How a tree's credit grows */}
        <div>
          <p className="text-sm font-medium mb-2">How a tree's credit grows</p>
          <div className="grid grid-cols-4 gap-2 text-center">
            {factors.treeSchedule.map((s) => (
              <div key={s.ageYears} className="rounded-2xl bg-sky-card py-2">
                <p className="text-xs text-ink-soft">{s.ageYears} yr{s.ageYears > 1 ? 's' : ''}</p>
                <p className="font-semibold tabular-nums">{s.kgPerYear} kg</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-ink-soft mt-2">Per year, a rough schedule. Not a measurement of a real tree.</p>
        </div>
      </section>

      {/* Direct credits */}
      <section className="rounded-3xl bg-white border border-sky-line p-5 space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display font-semibold text-xl">Credits this week</h2>
          <span className="tabular-nums font-semibold text-pro-fg">{creditTotal > 0.004 ? '−' : ''}{creditTotal.toFixed(2)} kg</span>
        </div>
        <p className="text-xs text-ink-soft">
          Composting {factors.eco.items.compost.creditKg} kg per kg, own bottle {factors.eco.items.own_bottle.creditKg} kg,
          own bag {factors.eco.items.own_bag.creditKg} kg, own cup {factors.eco.items.own_cup.creditKg} kg per use.
        </p>
        {credits.length === 0 ? (
          <p className="text-sm text-ink-soft">No credits this week. Try the Eco Actions tab on the Log screen.</p>
        ) : (
          <ul className="divide-y divide-sky-line">
            {credits.map((a) => (
              <li key={a.id} className="py-2 flex justify-between gap-3 text-sm">
                <span>
                  {itemLabel(a.item)} · {a.qty} {unitText(a.sector, a.item, a.qty)}
                  <span className="text-ink-soft"> · {new Date(a.ts).toLocaleDateString('en-IN', { weekday: 'short' })}</span>
                </span>
                <span className="tabular-nums font-semibold text-pro-fg">−{a.kg.toFixed(2)} kg</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
