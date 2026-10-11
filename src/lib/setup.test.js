// setup.test.js: a tiny first test, so "npm test" works from Step 0.
// In Step 1 we add calc.test.js with the real maths tests.
import { describe, it, expect } from 'vitest';
import factors from '../data/emission_factors.json';
import synonyms from '../data/synonyms.json';

describe('data files', () => {
  it('has the 6 kg daily budget', () => {
    expect(factors.dailyBudgetKg).toBe(6);
  });

  it('has 7 sectors', () => {
    expect(Object.keys(factors.sectors)).toHaveLength(7);
  });

  it('every synonym points to a real item', () => {
    const allItems = [
      ...Object.values(factors.sectors).flatMap((s) => Object.keys(s.items)),
      ...Object.keys(factors.eco.items),
    ];
    for (const itemId of Object.values(synonyms)) {
      expect(allItems).toContain(itemId);
    }
  });
});
