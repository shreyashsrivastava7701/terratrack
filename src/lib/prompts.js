// prompts.js: the exact words we send to Gemma. Change wording here only after testing.
// The model only turns a sentence into structured entries. It never sees or outputs kg numbers.
import { SECTOR_IDS, itemsOf, unitOf, sectorLabel } from './items.js';

// Short hints for items the model could mix up
const HINTS = {
  streaming: 'watching videos: YouTube, Netflix, OTT, movies',
  video_call: 'live calls only: Zoom, Google Meet, online class',
  social_media: 'Instagram, reels, scrolling',
  music_streaming: 'songs, Spotify, podcasts',
  street_food: 'samosa, chaat, momos, vada pav',
  tea_coffee: 'one cup',
  gadget_small: 'earphones, charger, smartwatch',
};

// The list of allowed items for a tab, one sector per line:
//   transport (unit per item): walk: km, cycle: km, ...
function itemListFor(tab) {
  const sectors = tab === 'all' ? SECTOR_IDS : [tab];
  return sectors
    .map((s) => `${s}: ` + itemsOf(s).map((item) => {
      const hint = HINTS[item] ? `; ${HINTS[item]}` : '';
      return `${item} (${unitOf(s, item)}${hint})`;
    }).join(', '))
    .join('\n');
}

export function buildSystemPrompt(tab) {
  const tabName = tab === 'all' ? 'All (any category)' : sectorLabel(tab);
  return `You turn one sentence about a person's day into JSON entries. The sentence may be in English, Hindi or Hinglish.
Active category: ${tabName}.
Allowed items (sector: id (unit)):
${itemListFor(tab)}
Rules:
- Return one entry per activity. Quantity is a number in the item's unit.
- "sector" must be the sector the item is listed under.
- "Went and came back" means two legs of the stated distance unless a total is given.
- 15 minutes = 0.25 hours. 200 g of food waste = 2 (units of 100 g). Half a kg = 0.5.
- A meal, a shower, a wash cycle, a purchase or a use counts as 1 unless a number is given. Minutes do not change these counts.
- If the activity is not listed, choose the closest allowed item and set match to "closest". If nothing fits, use item "unknown" and match "none".
- Use match "exact" only when the item is clearly named.
- Never output emissions, advice or any text outside the JSON.
Example: "aaj 8 km auto se gaya" -> {"entries":[{"sector":"transport","item":"auto","quantity":8,"match":"exact"}]}
Example: "AC 4 hours" -> {"entries":[{"sector":"energy","item":"ac","quantity":4,"match":"exact"}]}
Example: "watched 2 hours of Netflix" -> {"entries":[{"sector":"digital","item":"streaming","quantity":2,"match":"exact"}]}
Example: "egg roll for breakfast" -> {"entries":[{"sector":"food","item":"egg_meal","quantity":1,"match":"closest"}]}`;
}

// The JSON shape we ask Gemma to follow (the API's type names are uppercase)
export const PARSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    entries: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          sector: { type: 'STRING' },
          item: { type: 'STRING' },
          quantity: { type: 'NUMBER' },
          match: { type: 'STRING', enum: ['exact', 'closest', 'none'] },
        },
        required: ['sector', 'item', 'quantity', 'match'],
      },
    },
  },
  required: ['entries'],
};

// The Carbon Coach instruction (from the spec). Code supplies every number.
export const COACH_PROMPT = `You are a friendly carbon coach for a student in India.
Write at most 120 words in 4 to 5 short sentences.
First name the top category and its share, choose one tip for it, and say what it could have saved.
Then give one sentence for each of the other biggest categories listed: its share and its best swap or tip, with the saving if one is given.
End by naming which single change would have saved the most kg.
Use only the numbers given. Do not add any other number.
Write plain sentences, no lists, no headings, no emojis.`;

// The 10 test sentences from the spec, with the entries we expect
export const TEST_SET = [
  { tab: 'transport', text: 'Went to college 8 km by auto and came back by bus', expected: [['auto', 8], ['bus', 8]] },
  { tab: 'transport', text: 'aaj 8 km auto se gaya', expected: [['auto', 8]] },
  { tab: 'energy', text: 'AC on for 4 hours and geyser for 15 minutes', expected: [['ac', 4], ['geyser', 0.25]] },
  { tab: 'food', text: 'Dal rice for lunch, chicken roll for dinner', expected: [['dal_rice', 1], ['chicken_meal', 1]] },
  { tab: 'food', text: 'maine aaj mutton khaya', expected: [['mutton_meal', 1]] },
  { tab: 'shopping', text: 'Bought a T-shirt from a thrift shop', expected: [['clothing_secondhand', 1]] },
  { tab: 'waste', text: 'Left about 200 g of food in the mess and used two plastic bags', expected: [['food_waste_100g', 2], ['plastic_bag', 2]] },
  { tab: 'water', text: '10 minute hot shower and one wash cycle', expected: [['hot_shower', 1], ['machine_wash', 1]] },
  { tab: 'digital', text: 'Watched 3 hours of YouTube', expected: [['streaming', 3]] },
  { tab: 'eco', text: 'Composted half a kg of scraps and planted a tree', expected: [['compost', 0.5], ['tree', 1]] },
];

// "What this means" card: one emotional but true line, plus everyday ideas
export const IMPACT_PROMPT = `You help a college student in India feel what their carbon footprint means.
Reply with JSON only: {"line": "...", "ideas": ["...", "...", "..."]}
"line": one or two sentences, at most 40 words, that make the person feel the real-world cost. Speak to them as "you".
Use one or two of the facts given, with their numbers. Be moving but truthful: no exaggeration, no deaths, no blame.
"ideas": exactly 3 everyday, practical and slightly unusual habits for a student in India that would cut their biggest categories, each under 18 words.
Use only the numbers given. Do not add any other number. No emojis.`;

// "Search any item": match one thing (a dish, a ride, a product) to the closest item we have a factor for
export function buildMatchPrompt(tab) {
  return `You match one thing a student in India names (a dish, a ride, a product, an appliance, a habit) to the closest item in a fixed list.
The name may be in English, Hindi or Hinglish. Think about what it is made of or how it works, then pick the item with the most similar carbon footprint.
Allowed items (sector: id (unit)):
${itemListFor(tab)}
Reply with JSON only: {"sector": "...", "item": "...", "name": "the thing, nicely written", "why": "under 12 words, no numbers"}
If nothing is even roughly similar, use item "unknown".
Example: "chicken biryani" -> {"sector":"food","item":"chicken_meal","name":"Chicken biryani","why":"Rice with chicken, like a chicken meal"}
Example: "Rapido bike" -> {"sector":"transport","item":"bike","name":"Rapido bike taxi","why":"A motorbike ride"}`;
}

// Screenshot or bill reader: Swiggy/Zomato orders, Myntra/Amazon orders, electricity bills, receipts, Uber/Ola rides
export function buildReceiptPrompt() {
  return `You read a screenshot or photo of an order, receipt or bill from India (Swiggy, Zomato, Blinkit, Myntra, Amazon, Flipkart, Uber, Ola, Rapido, an electricity bill, a shop receipt).
List what was bought, eaten or used, matched to the closest allowed item.
Allowed items (sector: id (unit)):
${itemListFor('all')}
Rules:
- Food orders: one entry per dish, quantity = number of servings. Pick the closest meal item by main ingredient.
- Clothes, shoes, gadgets and books: one entry per product, quantity = number of pieces. Other parcels: online_order.
- Rides: the distance in km if shown.
- Electricity bills: item electricity_kwh, quantity = units (kWh) consumed in the bill.
- Add the plastic or takeaway containers only if the receipt shows them.
- "name" is the product or dish name as printed, shortened. "match" is "closest" unless the item is exactly that.
- Ignore prices, taxes, delivery fees and discounts.
Reply with JSON only: {"title": "e.g. Swiggy order from Behrouz", "entries": [{"sector": "...", "item": "...", "quantity": 1, "name": "...", "match": "closest"}]}
If it is not an order, receipt or bill, reply {"title": "", "entries": []}.`;
}
