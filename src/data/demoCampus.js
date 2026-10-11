// demoCampus.js: ready-made demo people for the presentation.
// Three students with different habits (7 days each, ending today) and a college's updates and challenge.
import { kgFor, dayKey, addDays } from '../lib/calc.js';
import { kindFor } from '../lib/store.js';

// Each day: [time, sector, item, quantity]. Index 0 = 6 days ago, index 6 = today.
export const PERSONAS = {
  aarav: {
    name: 'Aarav Sharma',
    blurb: 'Green commuter: metro, cycle, veg food, composts, planted a tree',
    baseline: { transport: 'auto', food: 'chicken_meal' },
    treeDay: 3,
    days: [
      [['08:30', 'transport', 'metro', 14], ['13:00', 'food', 'dal_rice', 1], ['20:00', 'food', 'veg_thali', 1], ['23:00', 'energy', 'fan', 7], ['09:00', 'eco', 'own_bottle', 2]],
      [['08:30', 'transport', 'cycle', 6], ['13:00', 'food', 'veg_thali', 1], ['20:00', 'food', 'dal_rice', 1], ['15:00', 'energy', 'laptop', 5], ['07:30', 'water', 'bucket_bath', 1]],
      [['08:30', 'transport', 'metro', 14], ['13:00', 'food', 'egg_meal', 1], ['20:00', 'food', 'dal_rice', 1], ['18:30', 'eco', 'compost', 0.5], ['21:00', 'digital', 'streaming', 1]],
      [['08:30', 'transport', 'bus', 12], ['13:00', 'food', 'dal_rice', 1], ['20:00', 'food', 'paneer_meal', 1], ['07:00', 'eco', 'tree', 1], ['10:00', 'eco', 'own_cup', 1]],
      [['08:30', 'transport', 'metro', 14], ['13:00', 'food', 'veg_thali', 1], ['20:00', 'food', 'dal_rice', 1], ['15:00', 'energy', 'ac', 1], ['09:00', 'eco', 'own_bottle', 2]],
      [['10:00', 'transport', 'walk', 3], ['13:00', 'food', 'street_food', 1], ['20:00', 'food', 'dal_rice', 1], ['11:00', 'shopping', 'clothing_secondhand', 1], ['18:00', 'eco', 'own_bag', 1]],
      [['08:30', 'transport', 'metro', 14], ['13:00', 'food', 'dal_rice', 1], ['20:00', 'food', 'veg_thali', 1], ['23:00', 'energy', 'fan', 6], ['18:30', 'eco', 'compost', 0.3]],
    ],
  },
  priya: {
    name: 'Priya Iyer',
    blurb: 'In the middle: auto rides, some chicken, AC in the afternoon',
    baseline: { transport: 'auto', food: 'chicken_meal' },
    days: [
      [['09:00', 'transport', 'auto', 8], ['13:30', 'food', 'chicken_meal', 1], ['20:00', 'food', 'dal_rice', 1], ['15:00', 'energy', 'ac', 2], ['22:00', 'digital', 'social_media', 2]],
      [['09:00', 'transport', 'shared_auto', 8], ['13:30', 'food', 'veg_thali', 1], ['20:00', 'food', 'egg_meal', 1], ['15:00', 'energy', 'ac', 3], ['09:30', 'eco', 'own_bottle', 1]],
      [['09:00', 'transport', 'bus', 10], ['13:30', 'food', 'chicken_meal', 1], ['17:00', 'food', 'tea_coffee', 2], ['07:30', 'water', 'hot_shower', 1], ['21:00', 'digital', 'streaming', 2]],
      [['09:00', 'transport', 'auto', 8], ['13:30', 'food', 'paneer_meal', 1], ['20:00', 'food', 'dal_rice', 1], ['15:00', 'energy', 'ac', 2], ['16:00', 'shopping', 'online_order', 1]],
      [['09:00', 'transport', 'metro', 10], ['13:30', 'food', 'veg_thali', 1], ['20:00', 'food', 'pizza', 1], ['15:00', 'energy', 'ac', 3], ['18:00', 'waste', 'plastic_bag', 2]],
      [['11:00', 'transport', 'auto', 12], ['13:30', 'food', 'chicken_meal', 1], ['20:00', 'food', 'veg_thali', 1], ['11:30', 'water', 'machine_wash', 1], ['18:30', 'eco', 'compost', 0.2]],
      [['09:00', 'transport', 'auto', 8], ['13:30', 'food', 'dal_rice', 1], ['20:00', 'food', 'chicken_meal', 1], ['15:00', 'energy', 'ac', 2], ['22:00', 'digital', 'gaming', 1]],
    ],
  },
  rohan: {
    name: 'Rohan Mehta',
    blurb: 'High footprint: car trips, mutton, long AC hours, new clothes',
    baseline: { transport: 'car', food: 'chicken_meal' },
    days: [
      [['09:00', 'transport', 'car', 18], ['13:30', 'food', 'mutton_meal', 1], ['20:00', 'food', 'chicken_meal', 1], ['14:00', 'energy', 'ac', 5], ['22:00', 'digital', 'gaming', 3]],
      [['09:00', 'transport', 'car', 18], ['13:30', 'food', 'chicken_meal', 1], ['20:00', 'food', 'pizza', 1], ['14:00', 'energy', 'ac', 6], ['07:30', 'water', 'hot_shower', 1]],
      [['09:00', 'transport', 'bike', 15], ['13:30', 'food', 'chicken_meal', 1], ['20:00', 'food', 'mutton_meal', 1], ['16:00', 'shopping', 'clothing_new', 1], ['18:00', 'waste', 'takeaway_container', 3]],
      [['09:00', 'transport', 'car', 18], ['13:30', 'food', 'fish_meal', 1], ['20:00', 'food', 'chicken_meal', 1], ['14:00', 'energy', 'ac', 5], ['07:00', 'energy', 'geyser', 0.5]],
      [['09:00', 'transport', 'metro', 15], ['13:30', 'food', 'chicken_meal', 1], ['20:00', 'food', 'veg_thali', 1], ['14:00', 'energy', 'ac', 4], ['21:00', 'digital', 'streaming', 3]],
      [['12:00', 'transport', 'car', 25], ['13:30', 'food', 'mutton_meal', 1], ['20:00', 'food', 'pizza', 1], ['16:00', 'shopping', 'shoes_new', 1], ['18:00', 'waste', 'plastic_bottle', 2]],
      [['09:00', 'transport', 'car', 18], ['13:30', 'food', 'chicken_meal', 1], ['20:00', 'food', 'dal_rice', 1], ['14:00', 'energy', 'ac', 4], ['09:30', 'eco', 'own_bottle', 1]],
    ],
  },
};

export const DEMO_PASSWORD = 'Demo@1234';

export const DEMO_COLLEGE = {
  name: 'Green Valley Institute',
  admin: 'Dr. Meera Kapoor',
  updates: [
    'Tree planting drive this Saturday, 8 am at the main gate. Saplings provided. Log your tree with a photo to count it!',
    'Canteen now gives ₹10 off when you bring your own steel tiffin or cup.',
    'Welcome to TerraTrack! Our goal this month: cut campus emissions by 10%.',
  ],
  challenges: [
    { title: 'Green Commute Week', metric: 'low_net', reward: 'Free canteen meal for a week', winners: 3, days: 7 },
    { title: 'Eco Action Sprint', metric: 'eco_actions', reward: 'TerraTrack champion badge + café voucher', winners: 1, days: 7 },
  ],
};

// A student's full data for a persona, ending on "today"
export function buildPersonaData(key, today = new Date()) {
  const p = PERSONAS[key];
  const todayKey = dayKey(today);
  const activities = [];
  const trees = [];
  p.days.forEach((lines, index) => {
    const date = addDays(todayKey, index - 6);
    lines.forEach(([time, sector, item, qty], n) => {
      activities.push({
        id: `${key}-${index}-${n}`,
        ts: new Date(`${date}T${time}:00`).toISOString(),
        sector, item, qty,
        kg: kgFor(sector, item, qty),
        kind: kindFor(sector, item),
        note: null,
      });
      if (item === 'tree') trees.push({ id: `${key}-tree-${index}`, plantedOn: date, activityId: `${key}-${index}-${n}` });
    });
  });
  return {
    activities,
    trees,
    settings: { baseline: p.baseline },
    quests: [],
    treeActivityId: activities.find((a) => a.item === 'tree')?.id ?? null,
  };
}

// A simple drawn photo of a sapling in soil, used as the demo tree proof (a data URL)
export function demoTreePhoto() {
  const c = document.createElement('canvas');
  c.width = 480; c.height = 360;
  const g = c.getContext('2d');
  g.fillStyle = '#bfe3f2'; g.fillRect(0, 0, 480, 220);
  g.fillStyle = '#6b4a2b'; g.fillRect(0, 220, 480, 140);
  g.fillStyle = '#4a3220'; g.beginPath(); g.ellipse(240, 235, 90, 22, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#3d6b2f'; g.lineWidth = 8; g.beginPath(); g.moveTo(240, 232); g.lineTo(240, 120); g.stroke();
  g.fillStyle = '#4caf50';
  [[210, 150, -0.6], [272, 135, 0.6], [215, 112, -0.4], [262, 100, 0.4], [240, 88, 0]].forEach(([x, y, r]) => {
    g.beginPath(); g.ellipse(x, y, 30, 14, r, 0, Math.PI * 2); g.fill();
  });
  g.fillStyle = '#1c3341'; g.font = '16px sans-serif'; g.fillText('Demo photo: sapling planted on campus', 100, 335);
  return c.toDataURL('image/jpeg', 0.8);
}
