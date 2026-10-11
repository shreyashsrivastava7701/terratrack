// Checks the per-category summary that sits under the Carbon Coach plan
import { describe, it, expect } from 'vitest';
import { coachInputs } from './calc.js';
import { buildDemoData } from '../data/demoData.js';

describe('coach sector summary', () => {
  const { activities, trees, settings } = buildDemoData('2026-10-11');
  const r = coachInputs(activities, trees, settings, '2026-10-11');

  it('lists every logged category, biggest first, with shares adding up to about 100', () => {
    expect(r.sectors.length).toBeGreaterThan(3);
    for (let i = 1; i < r.sectors.length; i++) expect(r.sectors[i - 1].kg).toBeGreaterThanOrEqual(r.sectors[i].kg);
    const total = r.sectors.reduce((t, s) => t + s.sharePercent, 0);
    expect(total).toBeGreaterThanOrEqual(97);
    expect(total).toBeLessThanOrEqual(103);
  });

  it('gives each high-carbon category a swap with a saving', () => {
    const food = r.sectors.find((s) => s.sector === 'food');
    expect(food.swap).toMatch(/^Swap /);
    expect(food.savedKg).toBeGreaterThan(0);
  });

  it('leaves a category with only low-carbon entries without a swap', () => {
    const digital = r.sectors.find((s) => s.sector === 'digital');
    expect(digital.swap).toBeNull();
  });

  it('never lists a category as both logged and not logged', () => {
    const labels = r.sectors.map((s) => s.label);
    for (const n of r.notLogged) expect(labels).not.toContain(n);
  });
});
