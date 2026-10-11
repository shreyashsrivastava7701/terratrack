// demoData.test.js: checks the demo data follows the spec.
import { describe, it, expect } from 'vitest';
import { buildDemoData } from './demoData.js';
import { dailyNets, netFootprint } from '../lib/calc.js';

const settings = { dailyBudgetKg: 6, offsetCapShare: 0.3, baseline: { transport: 'auto', food: 'chicken_meal' } };

describe('demo data', () => {
  const today = '2026-10-11';
  const { activities, trees } = buildDemoData(today);
  const nets = dailyNets(activities, trees, settings, today, 10);

  it('covers 10 days', () => {
    expect(nets.every((d) => d.gross > 0)).toBe(true);
  });
  it('has at least two days under 6 kg net', () => {
    expect(nets.filter((d) => d.net < 6).length).toBeGreaterThanOrEqual(2);
  });
  it('today is the test day (Net about 7.33 kg)', () => {
    // The 400-day-old tree adds a tiny extra credit on top of the test day's own tree
    const r = netFootprint(activities, trees, settings, today);
    expect(r.gross).toBeCloseTo(8.02, 2);
    expect(r.net).toBeGreaterThan(7.32);
    expect(r.net).toBeLessThan(7.34);
  });
  it('has a tree planted 400 days ago and one today', () => {
    expect(trees.map((t) => t.plantedOn)).toEqual(['2025-09-06', '2026-10-11']);
  });
});
