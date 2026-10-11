// calc.js: the carbon engine. Every kg number in TerraTrack comes from here.
// These are "pure functions": same input, same answer, every time. No screens, no storage.
// All factors come from src/data/emission_factors.json, so fixing a number never means changing code.
import factors from '../data/emission_factors.json';
import tips from '../data/tips.json';

// ---------- small helpers ----------

// Turn a date (or ISO time like "2026-10-11T09:30:00") into a day key "2026-10-11" in local time
export function dayKey(dateLike = new Date()) {
  if (typeof dateLike === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateLike)) return dateLike;
  const d = new Date(dateLike);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

// Whole days between two day keys, e.g. "2026-10-01" to "2026-10-11" = 10
function daysBetween(fromKey, toKey) {
  const toUtc = (key) => {
    const [y, m, d] = key.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toUtc(toKey) - toUtc(fromKey)) / 86400000);
}

// Move a day key forward or back, e.g. addDays("2026-10-11", -1) -> "2026-10-10"
export function addDays(key, n) {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + n));
  return date.toISOString().slice(0, 10);
}

// kg per unit for one item, e.g. ("transport", "auto") -> 0.10
export function kgPerUnit(sector, item) {
  if (sector === 'eco') return factors.eco.items[item]?.creditKg ?? 0;
  return factors.sectors[sector]?.items[item] ?? 0;
}

// ---------- the functions from the spec ----------

// kg CO2e for one entry: quantity x factor.
// For eco credits (compost, own bottle, own bag) this is the credit. A tree gives 0 here.
export function kgFor(sector, item, qty) {
  return kgPerUnit(sector, item) * qty;
}

// Pro / Neutral / Con for an item, compared with the typical value for its sector.
// ratio = item kg per unit / sector benchmark. It depends on the item, not the quantity.
export function verdict(sector, item) {
  if (sector === 'eco') return { label: 'pro', ratio: 0 }; // eco actions are always good
  if (sector === 'waste') return { label: 'con', ratio: null }; // waste is always Con

  const perUnit = kgPerUnit(sector, item);
  if (perUnit === 0) return { label: 'pro', ratio: 0 }; // walking, cycling...

  const ratio = round4(perUnit / factors.sectors[sector].benchmark);
  if (ratio <= 0.7) return { label: 'pro', ratio };
  if (ratio <= 1.0) return { label: 'neutral', ratio };
  return { label: 'con', ratio };
}

// The best swap: the lowest-kg candidate from tips.json, and the kg it would save
// for the same quantity. Returns null when there is no swap for this item.
export function swapFor(sector, item, qty) {
  const candidates = tips.swaps[item]?.candidates ?? [];
  if (candidates.length === 0) return null;

  const best = candidates.reduce((a, b) => (kgPerUnit(sector, b) < kgPerUnit(sector, a) ? b : a));
  const savedKg = (kgPerUnit(sector, item) - kgPerUnit(sector, best)) * qty;
  return { item: best, savedKg };
}

// The prevention tip for an item, or null
export function tipFor(item) {
  return tips.swaps[item]?.tip ?? null;
}

// How much CO2 a tree absorbs per year at a given age.
// We draw straight lines between the points in treeSchedule.
// Younger than 1 year: use the first value. Older than 10: use the last value.
export function treeKgPerYear(ageYears) {
  const schedule = factors.treeSchedule;
  const first = schedule[0];
  const last = schedule[schedule.length - 1];
  if (ageYears <= first.ageYears) return first.kgPerYear;
  if (ageYears >= last.ageYears) return last.kgPerYear;

  for (let i = 0; i < schedule.length - 1; i++) {
    const a = schedule[i];
    const b = schedule[i + 1];
    if (ageYears >= a.ageYears && ageYears <= b.ageYears) {
      const share = (ageYears - a.ageYears) / (b.ageYears - a.ageYears);
      return a.kgPerYear + share * (b.kgPerYear - a.kgPerYear);
    }
  }
  return last.kgPerYear; // never reached, but keeps things safe
}

// One tree's credit for one day: kgPerYear(age) / 365
export function treeKgPerDay(tree, date = new Date()) {
  const ageDays = daysBetween(dayKey(tree.plantedOn), dayKey(date));
  if (ageDays < 0) return 0; // not planted yet on that day
  return treeKgPerYear(ageDays / 365) / 365;
}

// Total tree offset for one day (before the 30% cap)
export function treeOffsetOn(trees, date = new Date()) {
  // A tree whose photo the college rejected gives no credit
  return trees.reduce((sum, tree) => sum + (tree.rejected ? 0 : treeKgPerDay(tree, date)), 0);
}

// The day's balance:
//   Net = max(0, E - C - min(O, 0.3 x E))
//   E = gross emissions, C = direct credits, O = tree offset (capped at 30% of E)
export function netFootprint(activities, trees, settings, date = new Date()) {
  const key = dayKey(date);
  const todays = activities.filter((a) => dayKey(a.ts) === key);

  const gross = sum(todays.filter((a) => a.kind === 'emit').map((a) => a.kg));
  const credits = sum(todays.filter((a) => a.kind === 'credit').map((a) => a.kg));

  const capShare = settings?.offsetCapShare ?? factors.offsetCapShare;
  const offsetRaw = treeOffsetOn(trees, key);
  const offsetCap = capShare * gross;
  const offset = Math.min(offsetRaw, offsetCap);

  const net = Math.max(0, gross - credits - offset);
  return {
    gross,
    credits,
    offset,
    net,
    offsetRaw, // the trees' full credit before the cap
    capApplied: offsetRaw > offsetCap, // true when the 30% cap cut the tree credit
  };
}

// Net, gross and credits for each of the last N days, oldest first (for the 7-day chart)
export function dailyNets(activities, trees, settings, endDate = new Date(), days = 7) {
  const end = dayKey(endDate);
  const result = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = addDays(end, -i);
    result.push({ date, ...netFootprint(activities, trees, settings, date) });
  }
  return result;
}

// Emissions per sector over a set of days, biggest first: [{ sector, kg }]
export function sectorTotals(activities, dayKeys) {
  const days = new Set(dayKeys);
  const totals = {};
  for (const a of activities) {
    if (a.kind !== 'emit' || !days.has(dayKey(a.ts))) continue;
    totals[a.sector] = (totals[a.sector] ?? 0) + a.kg;
  }
  return Object.entries(totals)
    .map(([sector, kg]) => ({ sector, kg }))
    .sort((a, b) => b.kg - a.kg);
}

// "Saved vs your usual" for Transport and Food only.
// saved = max(0, usual kg per unit - actual kg per unit) x quantity
// This is shown on Insights but NEVER subtracted from Net (the lower emission is already counted).
export function savedVsUsual(activities, settings) {
  const baseline = settings?.baseline ?? factors.baselineDefaults;
  let saved = 0;
  for (const a of activities) {
    if (a.sector !== 'transport' && a.sector !== 'food') continue;
    const usual = kgPerUnit(a.sector, baseline[a.sector]);
    const actual = kgPerUnit(a.sector, a.item);
    saved += Math.max(0, usual - actual) * a.qty;
  }
  return saved;
}

// Year forecast in tonnes: average of the last 7 daily nets x 365 / 1000
export function forecastYearTonnes(dailyNets) {
  const last7 = dailyNets.slice(-7);
  if (last7.length === 0) return 0;
  return (sum(last7) / last7.length) * 365 / 1000;
}

// Real-life comparisons for a kg amount
export function equivalents(kg) {
  const e = factors.equivalents;
  return {
    carKm: kg / e.kgPerCarKm,
    phoneCharges: kg / e.kgPerPhoneCharge,
    treeDays: kg / e.kgPerTreeDay,
  };
}

// Everything the share card shows, for the last `days` days (7 = weekly, 30 = monthly)
export function periodSummary(activities, trees, settings, endDate = new Date(), days = 7) {
  const nets = dailyNets(activities, trees, settings, endDate, days);
  const keys = new Set(nets.map((d) => d.date));
  const inPeriod = activities.filter((a) => keys.has(dayKey(a.ts)));
  const logged = nets.filter((d) => d.gross > 0 || d.credits > 0);
  const budget = settings?.dailyBudgetKg ?? factors.dailyBudgetKg;
  const totals = sectorTotals(activities, [...keys]);
  const gross = sum(nets.map((d) => d.gross));

  // Eco actions done in the period, e.g. { compost: 1.5 kg, own_bottle: 6 uses, tree: 1 }
  const ecoCounts = {};
  for (const a of inPeriod) {
    if (a.sector !== 'eco' || a.rejected) continue;
    ecoCounts[a.item] = (ecoCounts[a.item] ?? 0) + a.qty;
  }

  return {
    days,
    from: nets[0].date,
    to: nets[nets.length - 1].date,
    loggedDays: logged.length,
    netKg: sum(nets.map((d) => d.net)),
    grossKg: gross,
    creditsKg: sum(nets.map((d) => d.credits)),
    treeKg: sum(nets.map((d) => d.offset)),
    averageKg: logged.length ? sum(logged.map((d) => d.net)) / logged.length : 0,
    daysOnBudget: logged.filter((d) => d.net <= budget).length,
    budgetKg: budget,
    savedKg: savedVsUsual(inPeriod, settings),
    sectors: totals.map((t) => ({ label: factors.sectors[t.sector].label, kg: t.kg, share: gross ? t.kg / gross : 0 })),
    ecoCounts,
    entries: inPeriod.length,
  };
}

// Hard facts behind the "what this means" card. Code works these out; the AI only words them.
// Sea ice: about 3 m² of Arctic summer sea ice is lost per tonne of CO2 (Notz & Stroeve, Science, 2016).
export const SEA_ICE_M2_PER_TONNE = 3;
export const TARGET_TONNES = 2.2; // a 1.5 °C-aligned yearly footprint per person

export function impactFacts(forecastTonnes) {
  const t = Math.round(forecastTonnes * 100) / 100;
  const treeKgPerYear = factors.equivalents.kgPerTreeDay * 365;
  return {
    forecastTonnes: t,
    targetTonnes: TARGET_TONNES,
    timesTarget: Math.round((t / TARGET_TONNES) * 10) / 10,
    overTarget: t > TARGET_TONNES,
    treesForAYear: Math.ceil((t * 1000) / treeKgPerYear),
    seaIceM2: Math.round(t * SEA_ICE_M2_PER_TONNE),
    tenYearTonnes: Math.round(t * 10 * 10) / 10,
    tenYearSeaIceM2: Math.round(t * 10 * SEA_ICE_M2_PER_TONNE),
  };
}

// The daily quest for a date: one per day, picked by day number
export function questFor(date = new Date()) {
  const key = dayKey(date);
  const [y, m, d] = key.split('-').map(Number);
  const dayNumber = Math.floor(Date.UTC(y, m - 1, d) / 86400000);
  return tips.quests[dayNumber % tips.quests.length];
}

// How many days in a row the quest was done, counting back from today.
// If today's quest isn't done yet, the streak still counts up to yesterday.
export function questStreak(quests, today = new Date()) {
  const done = new Set(quests.filter((q) => q.done).map((q) => q.date));
  let day = dayKey(today);
  if (!done.has(day)) day = addDays(day, -1);
  let streak = 0;
  while (done.has(day)) {
    streak += 1;
    day = addDays(day, -1);
  }
  return streak;
}

// What-if: take one day's entries, swap every trip to "commute" and every meal to "meal",
// and work out the new net. Quantities stay the same.
// If the day has no trips or meals, we assume a 10 km round trip and 2 meals.
export function whatIfNet(dayActivities, trees, settings, date, commute, meal) {
  const key = dayKey(date);
  const others = dayActivities.filter((a) => a.sector !== 'transport' && a.sector !== 'food');
  const trips = dayActivities.filter((a) => a.sector === 'transport');
  const meals = dayActivities.filter((a) => a.sector === 'food');
  const km = trips.length ? trips.reduce((t, a) => t + a.qty, 0) : 10;
  const mealCount = meals.length ? meals.reduce((t, a) => t + a.qty, 0) : 2;

  const ts = `${key}T12:00:00`;
  const changed = [
    ...others,
    { id: 'w1', ts, sector: 'transport', item: commute, qty: km, kg: kgFor('transport', commute, km), kind: 'emit' },
    { id: 'w2', ts, sector: 'food', item: meal, qty: mealCount, kg: kgFor('food', meal, mealCount), kind: 'emit' },
  ];
  return { ...netFootprint(changed, trees, settings, key), km, mealCount };
}

// Coach inputs: code works out every number the Carbon Coach may mention.
// Returns { summary, tips } or null when there is nothing logged this week.
//   summary: { weekNetKg, days, topSector, topSectorKg, topSharePercent }
//   tips:    up to 3 of { text, savedKg }, biggest saving first, top sector first
export function coachInputs(activities, trees, settings, endDate = new Date(), labelFor = (x) => x) {
  const week = dailyNets(activities, trees, settings, endDate, 7);
  const keys = new Set(week.map((d) => d.date));
  const emits = activities.filter((a) => a.kind === 'emit' && keys.has(dayKey(a.ts)));
  if (emits.length === 0) return null;

  const totals = sectorTotals(activities, [...keys]);
  const gross = totals.reduce((t, x) => t + x.kg, 0);
  const top = totals[0];

  // Add up this week's quantity of each item, e.g. ac: 12 hours
  const qtyByItem = {};
  for (const a of emits) {
    const k = `${a.sector}|${a.item}`;
    qtyByItem[k] = (qtyByItem[k] ?? 0) + a.qty;
  }

  const candidates = Object.entries(qtyByItem).map(([k, qty]) => {
    const [sector, item] = k.split('|');
    const swap = swapFor(sector, item, qty);
    const tip = tipFor(item);
    const savedKg = swap && swap.savedKg > 0 ? round1(swap.savedKg) : null;
    const text = swap && savedKg
      ? `swap ${labelFor(item)} for ${labelFor(swap.item)} (${tip})`
      : tip;
    const swapText = swap && savedKg ? `Swap ${lowerName(labelFor(item))} for ${lowerName(labelFor(swap.item))}` : null;
    return { sector, text, swapText, tip, savedKg, isTop: sector === top.sector };
  }).filter((c) => c.text);

  // Top sector first, then biggest saving first; tips without a saving go last
  candidates.sort((a, b) =>
    (b.isTop - a.isTop) || ((b.savedKg ?? -1) - (a.savedKg ?? -1)));

  const tips = candidates.slice(0, 3).map(({ text, savedKg }) => ({ text, savedKg }));

  // One line per category logged this week: its kg, its share, and the single best thing to do there
  const sectors = totals.map((t) => {
    const best = candidates
      .filter((c) => c.sector === t.sector)
      .sort((a, b) => (b.savedKg ?? -1) - (a.savedKg ?? -1))[0];
    return {
      sector: t.sector,
      label: factors.sectors[t.sector].label,
      kg: round1(t.kg),
      sharePercent: Math.round((t.kg / gross) * 100),
      swap: best ? best.swapText : null,
      tip: best ? best.tip ?? null : null,
      savedKg: best ? best.savedKg : null,
    };
  });

  // Categories with nothing logged this week (eco is credits, not emissions, so it's left out)
  const logged = new Set(totals.map((t) => t.sector));
  const notLogged = Object.keys(factors.sectors)
    .filter((s) => s !== 'eco' && !logged.has(s))
    .map((s) => factors.sectors[s].label);

  return {
    sectors,
    notLogged,
    summary: {
      weekNetKg: round1(week.reduce((t, d) => t + d.net, 0)),
      days: week.filter((d) => d.gross > 0).length,
      topSector: factors.sectors[top.sector].label,
      topSectorKg: round1(top.kg),
      topSharePercent: Math.round((top.kg / gross) * 100),
    },
    tips,
  };
}

// "Mutton meal" -> "mutton meal", but short forms like "AC" or "EV car" stay as they are
function lowerName(label) {
  return /^[A-Z][a-z]/.test(label) ? label[0].toLowerCase() + label.slice(1) : label;
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

// Ring colour: green up to 70% of budget, amber up to 100%, red above
export function budgetLevel(net, budgetKg = factors.dailyBudgetKg) {
  const share = round4(net / budgetKg);
  if (share <= 0.7) return 'green';
  if (share <= 1.0) return 'amber';
  return 'red';
}

// Round to 4 decimals, so 4.2 / 6 counts as exactly 0.70 (computers store decimals slightly off)
function round4(n) {
  return Math.round(n * 10000) / 10000;
}

function sum(numbers) {
  return numbers.reduce((a, b) => a + b, 0);
}
