// calc.test.js: checks the maths. Run with: npm test
import { describe, it, expect } from 'vitest';
import {
  kgFor, verdict, swapFor, treeKgPerYear, treeOffsetOn, netFootprint,
  savedVsUsual, forecastYearTonnes, equivalents, budgetLevel, questStreak, whatIfNet,
} from './calc.js';
import { testDayActivities, testDayTrees } from '../data/testDay.js';

const settings = {
  dailyBudgetKg: 6,
  offsetCapShare: 0.3,
  baseline: { transport: 'auto', food: 'chicken_meal' },
  language: 'en-IN',
};

describe('the test day from the spec', () => {
  const date = '2026-10-11';
  const result = netFootprint(testDayActivities(date), testDayTrees(date), settings, date);

  it('has gross emissions of 8.02 kg', () => {
    expect(result.gross).toBeCloseTo(8.02, 2);
  });

  it('has credits of 0.69 kg (0.3 kg compost)', () => {
    expect(result.credits).toBeCloseTo(0.69, 2);
  });

  it('has a tree offset of about 0.003 kg', () => {
    expect(result.offset).toBeCloseTo(0.003, 3);
  });

  it('has a Net of 7.33 kg', () => {
    expect(Math.abs(result.net - 7.33)).toBeLessThanOrEqual(0.01);
  });
});

describe('kgFor', () => {
  it('8 km auto = 0.80 kg', () => expect(kgFor('transport', 'auto', 8)).toBeCloseTo(0.8));
  it('AC for 4 h = 4.40 kg', () => expect(kgFor('energy', 'ac', 4)).toBeCloseTo(4.4));
  it('streaming 2 h = 0.12 kg', () => expect(kgFor('digital', 'streaming', 2)).toBeCloseTo(0.12));
  it('compost 0.5 kg = 1.15 kg credit', () => expect(kgFor('eco', 'compost', 0.5)).toBeCloseTo(1.15));
  it('a tree gives 0 here (its credit comes from the Tree Wallet)', () => expect(kgFor('eco', 'tree', 1)).toBe(0));
});

describe('verdict', () => {
  it('auto is Neutral at 100%', () => {
    const v = verdict('transport', 'auto');
    expect(v.label).toBe('neutral');
    expect(v.ratio).toBeCloseTo(1.0);
  });
  it('AC is Con at 220%', () => {
    const v = verdict('energy', 'ac');
    expect(v.label).toBe('con');
    expect(v.ratio).toBeCloseTo(2.2);
  });
  it('chicken meal is Con at 133%', () => {
    expect(verdict('food', 'chicken_meal').label).toBe('con');
    expect(verdict('food', 'chicken_meal').ratio).toBeCloseTo(1.333, 2);
  });
  it('dal rice is Pro at 47%', () => {
    expect(verdict('food', 'dal_rice').label).toBe('pro');
    expect(verdict('food', 'dal_rice').ratio).toBeCloseTo(0.467, 2);
  });
  it('streaming is Pro at 60%', () => expect(verdict('digital', 'streaming').label).toBe('pro'));
  it('walking is always Pro', () => expect(verdict('transport', 'walk').label).toBe('pro'));
  it('waste is always Con', () => expect(verdict('waste', 'plastic_bag').label).toBe('con'));
  it('bike is Neutral at 80%', () => expect(verdict('transport', 'bike').label).toBe('neutral'));
});

describe('swapFor', () => {
  it('car swaps to metro and saves 1.4 kg on 10 km', () => {
    const s = swapFor('transport', 'car', 10);
    expect(s.item).toBe('metro');
    expect(s.savedKg).toBeCloseTo(1.4);
  });
  it('AC swaps to fan', () => {
    const s = swapFor('energy', 'ac', 4);
    expect(s.item).toBe('fan');
    expect(s.savedKg).toBeCloseTo(4.2);
  });
  it('chicken swaps to dal rice (the lowest)', () => expect(swapFor('food', 'chicken_meal', 1).item).toBe('dal_rice'));
  it('geyser has no swap', () => expect(swapFor('energy', 'geyser', 1)).toBeNull());
});

describe('trees', () => {
  it('a young tree absorbs 1 kg a year', () => expect(treeKgPerYear(0)).toBe(1));
  it('a 2-year-old tree absorbs 3 kg a year (between 1 and 5)', () => expect(treeKgPerYear(2)).toBeCloseTo(3));
  it('a 4-year-old tree absorbs 8.5 kg a year', () => expect(treeKgPerYear(4)).toBeCloseTo(8.5));
  it('an old tree stays at 21 kg a year', () => expect(treeKgPerYear(30)).toBe(21));
  it('an older tree gives more per day than a new one', () => {
    const today = '2026-10-11';
    const newTree = treeOffsetOn([{ id: 'a', plantedOn: today }], today);
    const oldTree = treeOffsetOn([{ id: 'b', plantedOn: '2025-09-06' }], today); // about 400 days ago
    expect(oldTree).toBeGreaterThan(newTree);
  });
  it('a tree planted in the future gives nothing yet', () => {
    expect(treeOffsetOn([{ id: 'c', plantedOn: '2026-12-01' }], '2026-10-11')).toBe(0);
  });
  it('a tree whose photo the college rejected gives nothing', () => {
    expect(treeOffsetOn([{ id: 'd', plantedOn: '2025-09-06', rejected: true }], '2026-10-11')).toBe(0);
  });
});

describe('the 30% cap on tree offsets', () => {
  it('cuts the tree credit to 30% of gross', () => {
    const date = '2026-10-11';
    const activities = [{ id: 'x', ts: `${date}T10:00:00`, sector: 'transport', item: 'auto', qty: 1, kg: 0.1, kind: 'emit' }];
    const oldTrees = [{ id: 't', plantedOn: '2010-01-01' }]; // gives 21/365 = 0.058 kg a day
    const r = netFootprint(activities, oldTrees, settings, date);
    expect(r.offset).toBeCloseTo(0.03); // 30% of 0.1
    expect(r.capApplied).toBe(true);
  });
  it('net never goes below zero', () => {
    const date = '2026-10-11';
    const activities = [
      { id: 'x', ts: `${date}T10:00:00`, sector: 'transport', item: 'auto', qty: 1, kg: 0.1, kind: 'emit' },
      { id: 'y', ts: `${date}T11:00:00`, sector: 'eco', item: 'compost', qty: 1, kg: 2.3, kind: 'credit' },
    ];
    expect(netFootprint(activities, [], settings, date).net).toBe(0);
  });
  it('only counts entries from the chosen day', () => {
    const activities = [{ id: 'x', ts: '2026-10-10T10:00:00', sector: 'energy', item: 'ac', qty: 2, kg: 2.2, kind: 'emit' }];
    expect(netFootprint(activities, [], settings, '2026-10-11').gross).toBe(0);
  });
});

describe('saved vs your usual', () => {
  it('metro instead of usual auto for 10 km saves 0.7 kg', () => {
    const a = [{ sector: 'transport', item: 'metro', qty: 10 }];
    expect(savedVsUsual(a, settings)).toBeCloseTo(0.7);
  });
  it('dal rice instead of usual chicken saves 1.3 kg', () => {
    const a = [{ sector: 'food', item: 'dal_rice', qty: 1 }];
    expect(savedVsUsual(a, settings)).toBeCloseTo(1.3);
  });
  it('a worse choice than usual saves nothing (not negative)', () => {
    const a = [{ sector: 'transport', item: 'car', qty: 10 }];
    expect(savedVsUsual(a, settings)).toBe(0);
  });
});

describe('forecast, equivalents and ring colour', () => {
  it('6 kg a day is about 2.19 tonnes a year', () => {
    expect(forecastYearTonnes([6, 6, 6, 6, 6, 6, 6])).toBeCloseTo(2.19, 2);
  });
  it('uses only the last 7 days', () => {
    expect(forecastYearTonnes([100, 6, 6, 6, 6, 6, 6, 6])).toBeCloseTo(2.19, 2);
  });
  it('1.7 kg = 10 km by car', () => expect(equivalents(1.7).carKm).toBeCloseTo(10));
  it('ring is green at 70%, amber at 100%, red above', () => {
    expect(budgetLevel(4.2)).toBe('green');
    expect(budgetLevel(6)).toBe('amber');
    expect(budgetLevel(7.33)).toBe('red');
  });
});

describe('quest streak', () => {
  const q = (date, done = true) => ({ date, questId: 'x', done });
  it('counts days in a row up to today', () => {
    expect(questStreak([q('2026-10-09'), q('2026-10-10'), q('2026-10-11')], '2026-10-11')).toBe(3);
  });
  it('still counts up to yesterday if today is not done yet', () => {
    expect(questStreak([q('2026-10-09'), q('2026-10-10')], '2026-10-11')).toBe(2);
  });
  it('a missed day breaks the streak', () => {
    expect(questStreak([q('2026-10-08'), q('2026-10-10'), q('2026-10-11')], '2026-10-11')).toBe(2);
  });
});

describe('what-if', () => {
  const date = '2026-10-11';
  const day = testDayActivities(date);
  it('metro and a veg meal lowers the test day', () => {
    // 8 km metro (0.24) + 2 veg thalis (1.6) instead of auto (0.8) + chicken (2.0) + dal rice (0.7)
    const r = whatIfNet(day, testDayTrees(date), settings, date, 'metro', 'veg_thali');
    expect(r.gross).toBeCloseTo(8.02 - 0.8 - 2.0 - 0.7 + 0.24 + 1.6, 2);
    expect(r.net).toBeLessThan(7.33);
  });
  it('assumes 10 km and 2 meals on an empty day', () => {
    const r = whatIfNet([], [], settings, date, 'car', 'dal_rice');
    expect(r.gross).toBeCloseTo(1.7 + 1.4, 2);
  });
});

describe('coach inputs', () => {
  it('finds the top sector and the biggest swap', async () => {
    const { buildDemoData } = await import('../data/demoData.js');
    const { activities, trees } = buildDemoData('2026-10-11');
    const { coachInputs } = await import('./calc.js');
    const r = coachInputs(activities, trees, settings, '2026-10-11');
    expect(r.summary.topSector).toBe('Food');
    expect(r.tips.length).toBe(3);
    expect(r.tips[0].savedKg).toBeGreaterThan(0);
  });
});
