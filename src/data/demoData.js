// demoData.js: 10 days of made-up activity for the demo ("Load demo data" in Settings).
// Today matches the spec's test day (Net 7.33 kg). Days 10 and 7 ago stay under 6 kg.
// There is one tree planted 400 days ago and one planted today.
import { kgFor, dayKey, addDays } from '../lib/calc.js';
import { kindFor } from '../lib/store.js';
import { testDayActivities } from './testDay.js';

// Each line: [time, sector, item, quantity]. Index 0 is 9 days ago, index 8 is yesterday.
const DAYS = [
  [['08:40', 'transport', 'metro', 12], ['13:00', 'food', 'veg_thali', 1], ['20:30', 'food', 'veg_thali', 1],
   ['15:00', 'energy', 'laptop', 5], ['23:00', 'energy', 'fan', 8], ['21:30', 'digital', 'streaming', 2],
   ['07:30', 'water', 'cold_shower', 1], ['09:00', 'eco', 'own_bottle', 2]],
  [['08:30', 'transport', 'car', 15], ['13:30', 'food', 'chicken_meal', 1], ['20:00', 'food', 'dal_rice', 1],
   ['14:00', 'energy', 'ac', 3], ['22:00', 'digital', 'social_media', 2], ['18:00', 'waste', 'plastic_bag', 2]],
  [['09:00', 'transport', 'auto', 10], ['13:00', 'food', 'paneer_meal', 1], ['20:30', 'food', 'dal_rice', 1],
   ['15:00', 'energy', 'ac', 2], ['22:30', 'digital', 'gaming', 2], ['11:00', 'water', 'machine_wash', 1],
   ['10:00', 'eco', 'own_bottle', 2]],
  [['08:45', 'transport', 'bus', 16], ['08:00', 'food', 'egg_meal', 1], ['20:00', 'food', 'veg_thali', 1],
   ['23:00', 'energy', 'fan', 6], ['21:00', 'digital', 'streaming', 3], ['07:30', 'water', 'cold_shower', 1],
   ['19:00', 'eco', 'own_bag', 1]],
  [['09:15', 'transport', 'car', 20], ['20:30', 'food', 'mutton_meal', 1], ['13:00', 'food', 'dal_rice', 1],
   ['16:00', 'shopping', 'online_order', 2], ['07:45', 'water', 'hot_shower', 1]],
  [['08:50', 'transport', 'e_rickshaw', 6], ['13:30', 'food', 'chicken_meal', 1], ['17:00', 'food', 'tea_coffee', 3],
   ['14:00', 'energy', 'ac', 4], ['16:00', 'energy', 'laptop', 4], ['22:00', 'digital', 'video_call', 1]],
  [['08:40', 'transport', 'metro', 12], ['20:30', 'food', 'pizza', 1], ['13:00', 'food', 'dal_rice', 1],
   ['14:30', 'energy', 'ac', 2], ['07:30', 'water', 'hot_shower', 1], ['18:30', 'eco', 'compost', 0.5]],
  [['09:00', 'transport', 'auto', 8], ['13:30', 'food', 'chicken_meal', 1], ['20:00', 'food', 'veg_thali', 1],
   ['07:00', 'energy', 'geyser', 0.5], ['15:00', 'energy', 'ac', 3], ['22:00', 'digital', 'streaming', 2]],
  [['08:45', 'transport', 'bus', 10], ['17:30', 'food', 'street_food', 2], ['13:00', 'food', 'dal_rice', 1],
   ['15:00', 'energy', 'ac', 3], ['21:00', 'waste', 'food_waste_100g', 2], ['18:00', 'shopping', 'clothing_new', 1],
   ['10:00', 'eco', 'own_cup', 1]],
];

export function buildDemoData(today = new Date()) {
  const todayKey = dayKey(today);
  const activities = [];

  DAYS.forEach((lines, index) => {
    const date = addDays(todayKey, index - DAYS.length); // 9 days ago ... yesterday
    lines.forEach(([time, sector, item, qty], n) => {
      activities.push({
        id: `d${index}-${n}`,
        ts: `${date}T${time}:00`,
        sector, item, qty,
        kg: kgFor(sector, item, qty),
        kind: kindFor(sector, item),
        note: null,
      });
    });
  });

  activities.push(...testDayActivities(todayKey)); // today = the spec's test day

  const trees = [
    { id: 'tree-old', plantedOn: addDays(todayKey, -400) },
    { id: 'tree-new', plantedOn: todayKey },
  ];
  return { activities, trees };
}
