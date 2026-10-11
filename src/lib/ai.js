// ai.js: the AI client. All AI use goes through this file, so models can be changed in one place.
//
// parse(text, tab) turns a sentence into entries:
//   1. Ask Gemma 4 (open weights, our main model) through the /api/gemma proxy, which adds the secret key
//   2. If Gemma fails or takes too long, ask the Gemini backup models, one after another
//   3. Check every entry with validate(): the item must exist, the quantity must be sensible
//   4. If every model fails, use the keyword parser instead
//
// No model ever gives a kg number. calc.js does all the maths.
import { buildSystemPrompt, PARSE_SCHEMA, COACH_PROMPT, IMPACT_PROMPT, buildMatchPrompt, buildReceiptPrompt } from './prompts.js';
import { fallbackParse } from './fallbackParser.js';
import { itemsForTab, sectorOf, maxQty } from './items.js';

// The models we try, in order. "seconds" is how long we wait before moving to the next one.
// An error (like a rate limit) moves on straight away; only a model that hangs uses the full wait.
// Change the backup list in .env with VITE_BACKUP_MODELS=model-a,model-b
const env = import.meta.env ?? {};
const BACKUPS = (env.VITE_BACKUP_MODELS || 'gemini-3.5-flash-lite,gemini-3.8-flash')
  .split(',').map((id) => id.trim()).filter(Boolean);

export const MODELS = [
  { id: env.VITE_GEMMA_MODEL || 'gemma-4-26b-a4b-it', name: 'Gemma 4', family: 'gemma', seconds: 45 },
  ...BACKUPS.map((id) => ({ id, name: 'Gemini (backup)', family: 'gemini', seconds: 15 })),
];

// ---------- connection status (for the status dot) ----------
// "unknown" before the first call, "ok" after a good answer, "failed" after an error

let status = { state: 'unknown', message: 'Not tried yet' };
const statusListeners = new Set();

function setStatus(state, message) {
  status = { state, message };
  statusListeners.forEach((fn) => fn(status));
}

export function getStatus() {
  return status;
}

export function onStatusChange(fn) {
  statusListeners.add(fn);
  return () => statusListeners.delete(fn);
}

// ---------- cache: the same sentence on the same tab never calls the model twice ----------
const cache = new Map();

// ---------- calling Gemma ----------

// One request to a model. "request" holds { system, user, temperature, schema }.
// "mode" decides how much we ask for:
//   "full":   system prompt + JSON schema (if any) + minimal thinking (the best case)
//   "plain":  system prompt + minimal thinking, no schema (if the schema is refused)
//   "simple": the rules go inside the user message, no extras (if system prompts are refused)
async function callModel(model, request, mode) {
  const { system, user, temperature = 0, schema = null, image = null } = request;
  // A photo or screenshot goes along with the text as base64 (image = { mimeType, data })
  const imagePart = image ? [{ inlineData: { mimeType: image.mimeType, data: image.data } }] : [];
  const body =
    mode === 'simple'
      ? {
          contents: [{ role: 'user', parts: [{ text: `${system}\n\n${user}` }, ...imagePart] }],
          generationConfig: { temperature },
        }
      : {
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: user }, ...imagePart] }],
          generationConfig: {
            temperature,
            thinkingConfig: { thinkingLevel: 'minimal' },
            ...(mode === 'full' && schema ? { responseMimeType: 'application/json', responseSchema: schema } : {}),
          },
        };

  return fetch(`/api/gemma/v1beta/models/${model.id}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(model.seconds * 1000),
  });
}

// Turn an error reply into a short message a person can act on
async function explainError(res, model) {
  let detail = '';
  try {
    detail = (await res.json())?.error?.message ?? '';
  } catch {
    // body was not JSON
  }
  if (/api key/i.test(detail)) return 'API key missing or wrong. Put your key in .env and restart npm run dev.';
  if (res.status === 429) return 'Rate limit reached. Wait a minute and try again.';
  if (res.status === 404) return `Model ${model.id} was not found.`;
  return `${model.id} error ${res.status}${detail ? `: ${detail.slice(0, 120)}` : ''}`;
}

async function isKeyProblem(res) {
  try {
    return /api key/i.test((await res.clone().json())?.error?.message ?? '');
  } catch {
    return false;
  }
}

// Pull the JSON object out of the model's text, even if it is wrapped in ```json fences
export function extractJson(raw) {
  const cleaned = raw.replace(/```json|```/g, '');
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON in the answer');
  return JSON.parse(cleaned.slice(start, end + 1));
}

// Ask one model and return its answer text. Throws on any problem.
async function askModelText(model, request) {
  // Try the best request first, and simpler ones only if the model says "400 Bad Request"
  const modes = request.schema ? ['full', 'plain', 'simple'] : ['plain', 'simple'];
  let res;
  for (const mode of modes) {
    res = await callModel(model, request, mode);
    if (res.status !== 400) break;
    if (await isKeyProblem(res)) break; // a bad key won't get better by retrying
  }
  if (!res.ok) {
    const err = new Error(await explainError(res, model));
    err.keyProblem = /api key/i.test(err.message);
    throw err;
  }

  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  // Skip the model's "thinking" parts, keep only the answer
  return parts.filter((p) => !p.thought).map((p) => p.text ?? '').join('').trim();
}

// Try each model in order until one answers. "check" can reject an answer (it throws),
// which moves on to the next model. Returns { value, model } or throws the last problem.
async function runChain(request, { gemmaOnly = false, check = (text) => text } = {}) {
  const models = gemmaOnly ? MODELS.slice(0, 1) : MODELS;
  let lastProblem = 'No model answered';

  for (const model of models) {
    try {
      const value = check(await askModelText(model, request));
      setStatus('ok', `Answered by ${model.id}`);
      return { value, model };
    } catch (err) {
      lastProblem = err.message;
      if (err.name === 'TimeoutError') lastProblem = `${model.id} took longer than ${model.seconds} seconds`;
      if (err.name === 'TypeError') lastProblem = "Can't reach the AI. Check the internet and that npm run dev is running.";
      if (err.keyProblem || err.name === 'TypeError') break; // the next model would fail the same way
    }
  }
  setStatus('failed', lastProblem);
  throw new Error(lastProblem);
}

// ---------- the validator ----------
// Keeps only entries we can trust: a real item on this tab and a sensible quantity.
// Returns { entries, dropped } where dropped lists what we could not use.
export function validate(rawEntries, tab) {
  const allowed = new Set(itemsForTab(tab).map((x) => x.item));
  const entries = [];
  const dropped = [];

  for (const e of Array.isArray(rawEntries) ? rawEntries : []) {
    const item = String(e?.item ?? '').trim().toLowerCase();
    const quantity = Number(e?.quantity);

    if (!allowed.has(item)) {
      dropped.push(item || 'unknown');
      continue;
    }
    const sector = sectorOf(item); // trust our own table, not the model, for the sector
    if (!(quantity > 0) || quantity > maxQty(sector, item)) {
      dropped.push(`${item} (quantity ${e?.quantity})`);
      continue;
    }
    entries.push({
      sector,
      item,
      quantity: Math.round(quantity * 100) / 100,
      match: e?.match === 'closest' ? 'closest' : 'exact',
      ...(e?.name ? { name: String(e.name).slice(0, 40) } : {}), // e.g. "Paneer butter masala" from a receipt
    });
  }
  return { entries, dropped };
}

// ---------- parse: the main function the app uses ----------
// Returns { entries, dropped, source, model } where source is "gemma", "gemini" or "keyword".
// Options:
//   fallback: false  -> throw instead of using the keyword parser
//   gemmaOnly: true  -> skip the Gemini backups (the test set measures Gemma alone)
export async function parse(text, tab, { fallback = true, gemmaOnly = false } = {}) {
  const key = `${gemmaOnly ? 'g' : 'a'}|${tab}|${text.trim().toLowerCase()}`;
  if (cache.has(key)) return cache.get(key);

  const request = { system: buildSystemPrompt(tab), user: text, temperature: 0, schema: PARSE_SCHEMA };
  try {
    const { value, model } = await runChain(request, {
      gemmaOnly,
      check: (raw) => extractJson(raw).entries ?? [],
    });
    const result = { ...validate(value, tab), source: model.family, model: model.id };
    cache.set(key, result);
    return result;
  } catch (err) {
    if (!fallback) throw err;
    // Silent fallback: the keyword parser always works
    return { entries: fallbackParse(text, tab), dropped: [], source: 'keyword', model: null, reason: err.message };
  }
}

// ---------- coach: the weekly plan (add-on) ----------
// "summary" and "tips" are worked out by code (see coachInputs in calc.js).
// The model only turns them into a short friendly plan. It must not invent any number:
// numbersAreAllowed() checks this, and an answer with a new number is rejected.
// Returns { text, source, model }. If every model fails, source is "template" and code writes the plan.
// "sectors" (optional) is the per-category list from coachInputs; the plan covers the top three.
export async function coach(summary, tips, sectors = []) {
  const top3 = sectors.slice(0, 3);
  const key = 'coach|' + JSON.stringify({ summary, tips, top3 });
  if (cache.has(key)) return cache.get(key);

  const facts = [
    `Week net total: ${summary.weekNetKg} kg CO2e over ${summary.days} days.`,
    `Top category: ${summary.topSector}, ${summary.topSectorKg} kg, which is ${summary.topSharePercent}% of emissions.`,
    'Candidate tips:',
    ...tips.map((t, i) => `${i + 1}. ${t.text}${t.savedKg != null ? ` (would have saved ${t.savedKg} kg this week)` : ''}`),
    ...(top3.length ? ['Biggest categories this week:', ...top3.map(sectorFact)] : []),
  ].join('\n');

  const request = { system: COACH_PROMPT, user: facts, temperature: 0.3 };
  const allowed = allowedNumbers(summary, tips, top3);

  try {
    const { value, model } = await runChain(request, {
      check: (text) => {
        const clean = text.replace(/\s+/g, ' ').trim();
        if (!clean) throw new Error('Empty answer');
        if (!numbersAreAllowed(clean, allowed)) throw new Error('The plan used a number it was not given');
        return clean;
      },
    });
    const result = { text: value, source: model.family, model: model.id };
    cache.set(key, result);
    return result;
  } catch {
    return { text: templateCoach(summary, tips, top3), source: 'template', model: null };
  }
}

// Every number the coach is allowed to say, as text: the facts we gave it, plus the 7 of "7 days"
function allowedNumbers(summary, tips, sectors = []) {
  const list = [summary.weekNetKg, summary.days, summary.topSectorKg, summary.topSharePercent, 7, 1, 2, 3];
  tips.forEach((t) => {
    if (t.savedKg != null) list.push(t.savedKg);
    (t.text.match(/\d+(?:\.\d+)?/g) ?? []).forEach((n) => list.push(n)); // e.g. "26 °C" in a tip
  });
  sectors.forEach((s) => {
    list.push(s.kg, s.sharePercent);
    if (s.savedKg != null) list.push(s.savedKg);
    (sectorFact(s).match(/\d+(?:\.\d+)?/g) ?? []).forEach((n) => list.push(n));
  });
  return list.map((n) => Number(n));
}

// True when every number in the text is one we gave it (within rounding)
export function numbersAreAllowed(text, allowed) {
  const found = text.match(/\d+(?:\.\d+)?/g) ?? [];
  return found.every((n) => allowed.some((a) => Math.abs(Number(n) - a) < 0.051));
}

// One line describing a category for the model, e.g. "Energy: 18.8 kg (32%). Best swap: Swap AC for fan, would have saved 16.8 kg. Tip: ..."
function sectorFact(s) {
  const swap = s.swap ? ` Best swap: ${s.swap}, would have saved ${s.savedKg} kg this week.` : '';
  const tip = s.tip ? ` Tip: ${s.tip}.` : '';
  return `- ${s.label}: ${s.kg} kg (${s.sharePercent}%).${swap}${tip}`;
}

// The plan code writes itself when no model is available
function templateCoach(summary, tips, sectors = []) {
  const best = tips[0];
  const first = `${summary.topSector} was your biggest category this week at ${summary.topSharePercent}% of emissions.`;
  if (!best) return `${first} Keep logging to get a personal tip.`;
  const saving = best.savedKg != null ? ` Doing that this week would have saved about ${best.savedKg} kg.` : '';
  const others = sectors.slice(1)
    .filter((s) => s.swap)
    .map((s) => ` In ${s.label.toLowerCase()} (${s.sharePercent}%), ${s.swap[0].toLowerCase()}${s.swap.slice(1)} to save about ${s.savedKg} kg.`)
    .join('');
  return `${first} Try this: ${best.text}.${saving}${others}`;
}

// ---------- impact: "what this means" (emotional line + everyday ideas) ----------
// facts come from impactFacts() in calc.js; topSectors are category names like "Food".
// Returns { line, ideas, source, model }. Falls back to a code-written version.
export async function impact(facts, topSectors = []) {
  const key = 'impact|' + JSON.stringify({ facts, topSectors });
  if (cache.has(key)) return cache.get(key);

  const user = [
    `Forecast: ${facts.forecastTonnes} tonnes of CO2 a year at this pace.`,
    `A 1.5 °C-safe footprint is about ${facts.targetTonnes} tonnes a year, so this is ${facts.timesTarget} times that.`,
    `It would take ${facts.treesForAYear} grown trees a whole year to absorb it.`,
    `It melts about ${facts.seaIceM2} square metres of Arctic summer sea ice every year (about 3 per tonne).`,
    `Over 10 years: ${facts.tenYearTonnes} tonnes, about ${facts.tenYearSeaIceM2} square metres of sea ice.`,
    `Biggest categories: ${topSectors.join(', ') || 'not known yet'}.`,
  ].join('\n');
  const allowed = [...Object.values(facts).filter((v) => typeof v === 'number'), 1, 2, 3, 10, 1.5]
    .concat((user.match(/\d+(?:\.\d+)?/g) ?? []).map(Number));

  try {
    const { value, model } = await runChain({ system: IMPACT_PROMPT, user, temperature: 0.7 }, {
      check: (text) => {
        const json = extractJson(text);
        const line = String(json.line ?? '').replace(/\s+/g, ' ').trim();
        const ideas = (Array.isArray(json.ideas) ? json.ideas : []).map((x) => String(x).trim()).filter(Boolean).slice(0, 3);
        if (!line || ideas.length < 2) throw new Error('Incomplete answer');
        if (![line, ...ideas].every((t) => numbersAreAllowed(t, allowed))) throw new Error('Used a number it was not given');
        return { line, ideas };
      },
    });
    const result = { ...value, source: model.family, model: model.id };
    cache.set(key, result);
    return result;
  } catch {
    return { ...templateImpact(facts, topSectors), source: 'template', model: null };
  }
}

const IDEAS_BY_SECTOR = {
  Food: 'Make Monday a dal-sabzi day with your hostel or flatmates, and keep meat for weekends.',
  Energy: 'Set the AC to 26 °C with a fan, and switch it off half an hour before you leave.',
  Transport: 'Find one classmate on your route and share the auto or ride the metro together.',
  Shopping: 'Run a clothes swap in your hostel before buying anything new for a fest.',
  Waste: 'Carry a steel tiffin and bottle, and say no to the plastic bag at the counter.',
  Water: 'Swap the long hot shower for a bucket bath on weekdays.',
  Digital: 'Download playlists and shows on Wi-Fi instead of streaming in HD over data.',
};

function templateImpact(f, topSectors) {
  const line = f.overTarget
    ? `At this pace you'd release ${f.forecastTonnes} tonnes this year, ${f.timesTarget} times a 1.5 °C-safe share. That's about ${f.seaIceM2} square metres of Arctic sea ice that won't come back.`
    : `At this pace you'd release ${f.forecastTonnes} tonnes this year, within a 1.5 °C-safe share. Even so, it would take ${f.treesForAYear} grown trees a whole year to absorb it.`;
  const ideas = [...topSectors, 'Food', 'Energy', 'Transport']
    .map((s) => IDEAS_BY_SECTOR[s])
    .filter((x, i, a) => x && a.indexOf(x) === i)
    .slice(0, 3);
  return { line, ideas };
}

// ---------- match: "search any item" ----------
// Finds the closest known item for a name like "biryani" or "Rapido bike".
// Returns { sector, item, name, why, source } or null when nothing fits. kg always comes from our table.
export async function matchItem(name, tab) {
  const key = `match|${tab}|${name.trim().toLowerCase()}`;
  if (cache.has(key)) return cache.get(key);
  const allowed = new Set(itemsForTab(tab).map((x) => `${x.sector}|${x.item}`));

  try {
    const { value, model } = await runChain({ system: buildMatchPrompt(tab), user: name, temperature: 0 }, {
      check: (raw) => {
        const j = extractJson(raw);
        if (j.item === 'unknown') return null;
        if (!allowed.has(`${j.sector}|${j.item}`)) throw new Error('Picked an item we do not have');
        return {
          sector: j.sector,
          item: j.item,
          name: String(j.name || name).slice(0, 40),
          why: String(j.why || '').replace(/\d+/g, '').slice(0, 80),
        };
      },
    });
    const result = value && { ...value, source: model.family };
    cache.set(key, result);
    return result;
  } catch {
    // No AI: try the keyword parser on the name alone
    const [hit] = fallbackParse(name, tab);
    return hit ? { sector: hit.sector, item: hit.item, name, why: 'Matched by keyword', source: 'keyword' } : null;
  }
}

// ---------- readReceipt: screenshot or bill -> entries ----------
// image = { mimeType, data } (base64). Returns { entries, dropped, title, source }.
// The AI only reads what was bought or used; kg comes from our table as always.
export async function readReceipt(image) {
  try {
    const { value, model } = await runChain(
      { system: buildReceiptPrompt(), user: 'Read this screenshot or bill.', temperature: 0, image },
      { check: (raw) => {
          const j = extractJson(raw);
          if (!Array.isArray(j.entries)) throw new Error('No entries in the answer');
          return j;
        } },
    );
    return { ...validate(value.entries, 'all'), title: String(value.title ?? '').slice(0, 60), source: model.family };
  } catch (err) {
    return { entries: [], dropped: [], title: '', source: null, reason: err.message };
  }
}

// ---------- checkTreePhoto: does the proof photo show a tree being planted? ----------
// Returns { ok, reason, source }. The college still makes the final call.
export async function checkTreePhoto(image) {
  const system = `You check proof photos for a student eco app. Does this photo plausibly show a tree or sapling that was just planted
(a sapling in fresh soil or a pot, hands planting, a planting drive)? Screenshots, stock-looking images, grown trees with no planting sign, or unrelated photos are not proof.
Reply with JSON only: {"ok": true or false, "reason": "under 15 words"}`;
  try {
    const { value, model } = await runChain({ system, user: 'Check this photo.', temperature: 0, image }, {
      check: (raw) => {
        const j = extractJson(raw);
        if (typeof j.ok !== 'boolean') throw new Error('No verdict');
        return { ok: j.ok, reason: String(j.reason ?? '').slice(0, 100) };
      },
    });
    return { ...value, source: model.family };
  } catch (err) {
    return { ok: null, reason: `AI check unavailable: ${err.message}`, source: null };
  }
}
