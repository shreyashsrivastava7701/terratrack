// items.js: small helpers to list items per tab and find each item's unit.
import factors from '../data/emission_factors.json';

// The nine tabs: 7 sectors + Eco Actions + All
export const TABS = [
  ...Object.entries(factors.sectors).map(([id, s]) => ({ id, label: s.label })),
  { id: 'eco', label: factors.eco.label },
  { id: 'all', label: 'All' },
];

// Every sector id that holds items, in tab order
export const SECTOR_IDS = [...Object.keys(factors.sectors), 'eco'];

// Item ids for one sector, e.g. "energy" -> ["led_light", "laptop", ...]
export function itemsOf(sector) {
  return Object.keys(sector === 'eco' ? factors.eco.items : factors.sectors[sector].items);
}

// [{ sector, item }] for a tab. The All tab lists everything.
export function itemsForTab(tab) {
  const sectors = tab === 'all' ? SECTOR_IDS : [tab];
  return sectors.flatMap((sector) => itemsOf(sector).map((item) => ({ sector, item })));
}

// Find which sector an item belongs to, e.g. "auto" -> "transport"
export function sectorOf(item) {
  return SECTOR_IDS.find((s) => itemsOf(s).includes(item)) ?? null;
}

export function sectorLabel(sector) {
  return sector === 'eco' ? factors.eco.label : factors.sectors[sector].label;
}

// The unit an item is counted in: "km", "hour", "meal", "kg", ...
export function unitOf(sector, item) {
  if (sector === 'eco') return factors.eco.items[item].unit;
  if (item === 'food_waste_100g') return '100 g';
  if (item === 'electricity_kwh') return 'kWh'; // from an electricity bill (India grid, about 0.72 kg per unit)
  if (sector === 'waste') return 'piece';
  return factors.sectors[sector].unit;
}

// Short unit text shown after a quantity: "8 km", "2 h", "1 meal"
export function unitText(sector, item, qty) {
  const unit = unitOf(sector, item);
  if (unit === 'hour') return 'h';
  if (unit === '100 g') return '× 100 g';
  if (unit === 'km' || unit === 'kg' || unit === 'kWh') return unit;
  return qty === 1 ? unit : unit + 's'; // meal -> meals, use -> uses
}

// The biggest believable quantity (from the spec): km 500, hours 24, meals 6, anything else 50
export function maxQty(sector, item) {
  const unit = unitOf(sector, item);
  if (unit === 'km') return 500;
  if (unit === 'hour') return 24;
  if (unit === 'meal') return 6;
  if (unit === 'kWh') return 2000;
  return 50;
}

// How much the + and − buttons change the quantity
export function stepFor(sector, item) {
  const unit = unitOf(sector, item);
  if (unit === 'hour') return 0.25;
  if (unit === 'kg') return 0.1;
  return 1;
}
