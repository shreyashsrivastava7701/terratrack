// fallbackParser.js: the keyword parser. It needs no AI and no internet.
// It looks for known words (from synonyms.json) and numbers in the sentence.
// Gemma (Step 4) is smarter, but this one always works.
//
// fallbackParse("aaj 8 km auto se gaya", "transport")
//   -> [{ sector: "transport", item: "auto", quantity: 8, match: "exact" }]
import synonyms from '../data/synonyms.json';
import { itemsForTab, sectorOf, unitOf, maxQty } from './items.js';

// Number words in English and Hindi (Roman script)
const NUMBER_WORDS = {
  half: 0.5, aadha: 0.5, adha: 0.5, quarter: 0.25,
  one: 1, ek: 1, two: 2, three: 3, teen: 3, four: 4, char: 4, chaar: 4,
  five: 5, paanch: 5, panch: 5, six: 6, chhe: 6, seven: 7, saat: 7, eight: 8, aath: 8,
  nine: 9, nau: 9, ten: 10, das: 10, dedh: 1.5, dhai: 2.5,
  // Hindi script
  'आधा': 0.5, 'एक': 1, 'दो': 2, 'तीन': 3, 'चार': 4, 'पांच': 5, 'पाँच': 5, 'छह': 6, 'सात': 7,
  'आठ': 8, 'नौ': 9, 'दस': 10, 'डेढ़': 1.5, 'ढाई': 2.5,
};

// Hindi digits ०-९ become 0-9, so "८ किमी" reads like "8 किमी"
function toLatinDigits(text) {
  return text.replace(/[०-९]/g, (d) => String('०१२३४५६७८९'.indexOf(d)));
}

// Words that split a sentence into separate activities
const CLAUSE_SPLIT = /,|;|\.(?!\d)|\band\b|\baur\b|\bthen\b|\bphir\b|\bplus\b|\bthen\b|और|फिर/;

// Units we understand after a number
const UNIT_WORDS = [
  ['km', /^(km|kms|kilometers?|kilometres?|kilometer|किमी|किलोमीटर)/],
  ['min', /^(minutes?|mins?|minute|मिनट)/],
  ['hour', /^(hours?|hrs?|h|ghante|ghanta|घंटे|घंटा)(?![a-z])/],
  ['kg', /^(kg|kgs|kilos?|kilograms?)/],
  ['g', /^(g|gm|gms|grams?|grammes?)(?![a-z])/],
];

// When both items show up in one clause, the first one wins:
// "a T-shirt from a thrift shop" is second-hand clothing, not new clothing
const OVERRIDES = { clothing_secondhand: ['clothing_new'] };

// Synonyms sorted longest first, so "plastic bag" wins over "bag"
const SYNONYM_KEYS = Object.keys(synonyms).sort((a, b) => b.length - a.length);

// Escape a word so we can use it inside a regular expression
function escape(word) {
  return word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Find all numbers in a clause, with the unit word right after them (if any)
function findNumbers(clause) {
  const found = [];
  const re = /(\d+(?:\.\d+)?)|([a-z\u0900-\u097f]+)/g;
  let m;
  while ((m = re.exec(clause))) {
    let value = null;
    if (m[1]) value = parseFloat(m[1]);
    else if (m[2] in NUMBER_WORDS) value = NUMBER_WORDS[m[2]];
    if (value === null) continue;

    // Look at what comes right after the number: "8 km", "15 minutes", "200g", "half a kg"
    const after = clause.slice(re.lastIndex).replace(/^\s*(a|an)?\s*/, '');
    const unit = UNIT_WORDS.find(([, pattern]) => pattern.test(after))?.[0] ?? null;
    found.push({ value, unit, used: false });
  }
  return found;
}

// Can this number be the quantity for this item? Converts units where needed.
// Returns the quantity in the item's own unit, or null if it doesn't fit.
function quantityFor(number, sector, item) {
  const unit = unitOf(sector, item);
  switch (number.unit) {
    case null: return number.value;
    case 'km': return unit === 'km' ? number.value : null;
    case 'hour': return unit === 'hour' ? number.value : null;
    case 'min': return unit === 'hour' ? number.value / 60 : null;
    case 'kg': return unit === 'kg' ? number.value : null;
    case 'g':
      if (unit === '100 g') return number.value / 100;
      if (unit === 'kg') return number.value / 1000;
      return null;
    default: return null;
  }
}

// Find the items mentioned in one clause (only items allowed on this tab)
function findItems(clause, allowed) {
  let text = ` ${clause} `;
  const items = [];
  for (const key of SYNONYM_KEYS) {
    const item = synonyms[key];
    if (!allowed.has(item)) continue;
    // Match the whole word, allowing a plural "s" or "es": "bag" matches "bags"
    const re = new RegExp(`(^|[^a-z\\u0900-\\u097f])${escape(key)}(s|es)?(?![a-z\\u0900-\\u097f])`);
    const m = re.exec(text);
    if (!m) continue;
    // Blank out the matched words so a shorter synonym can't match them again
    text = text.slice(0, m.index) + ' '.repeat(m[0].length) + text.slice(m.index + m[0].length);
    if (!items.some((i) => i.item === item)) items.push({ item, at: m.index });
  }
  const found = items.sort((a, b) => a.at - b.at).map((i) => i.item);
  const beaten = found.flatMap((item) => OVERRIDES[item] ?? []);
  return found.filter((item) => !beaten.includes(item));
}

export function fallbackParse(text, tab) {
  const allowed = new Set(itemsForTab(tab).map((x) => x.item));
  const clauses = toLatinDigits(text.toLowerCase()).split(CLAUSE_SPLIT).map((c) => c.trim()).filter(Boolean);
  const entries = [];
  let lastKm = null; // remembered so "came back by bus" reuses the same distance

  for (const clause of clauses) {
    const numbers = findNumbers(clause);
    for (const item of findItems(clause, allowed)) {
      const sector = sectorOf(item);

      // Use the first unused number that fits this item
      let quantity = null;
      for (const n of numbers) {
        if (n.used) continue;
        const q = quantityFor(n, sector, item);
        if (q !== null) {
          quantity = q;
          n.used = true;
          if (n.unit === 'km') lastKm = q;
          break;
        }
      }
      if (quantity === null && unitOf(sector, item) === 'km' && lastKm !== null) quantity = lastKm;
      if (quantity === null || quantity <= 0) quantity = 1;
      quantity = Math.min(quantity, maxQty(sector, item));

      entries.push({ sector, item, quantity: Math.round(quantity * 100) / 100, match: 'exact' });
    }
  }
  return entries;
}
