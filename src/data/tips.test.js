// tips.test.js: every Neutral or Con item must have a prevention tip (and a swap where one exists).
import { describe, it, expect } from 'vitest';
import factors from './emission_factors.json';
import tips from './tips.json';
import { verdict } from '../lib/calc.js';

describe('tips', () => {
  for (const [sector, s] of Object.entries(factors.sectors)) {
    for (const item of Object.keys(s.items)) {
      if (verdict(sector, item).label === 'pro') continue;
      it(`${item} has a tip`, () => {
        expect(tips.swaps[item]?.tip).toBeTruthy();
      });
    }
  }
});
