// testDay.js: the "known test day" from the spec.
// calc.test.js checks that it gives Net 7.33 kg, and the Maths check card in Settings shows it.
// Later, the demo data reuses it as "today".
import { kgFor } from '../lib/calc.js';

// Build one activity in the shape the app stores
function entry(id, date, time, sector, item, qty, kind) {
  return { id, ts: `${date}T${time}`, sector, item, qty, kg: kgFor(sector, item, qty), kind, note: null };
}

export function testDayActivities(date) {
  return [
    entry('t1', date, '09:30:00', 'transport', 'auto', 8, 'emit'),
    entry('t2', date, '14:00:00', 'energy', 'ac', 4, 'emit'),
    entry('t3', date, '20:00:00', 'food', 'chicken_meal', 1, 'emit'),
    entry('t4', date, '13:00:00', 'food', 'dal_rice', 1, 'emit'),
    entry('t5', date, '22:00:00', 'digital', 'streaming', 2, 'emit'),
    entry('t6', date, '18:00:00', 'eco', 'compost', 0.3, 'credit'),
    entry('t7', date, '18:10:00', 'eco', 'tree', 1, 'offset'),
  ];
}

// One tree, planted on the test day itself
export function testDayTrees(date) {
  return [{ id: 'tree1', plantedOn: date }];
}
