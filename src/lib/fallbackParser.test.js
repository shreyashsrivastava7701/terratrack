// fallbackParser.test.js: checks the keyword parser on the spec's 10 test sentences.
import { describe, it, expect } from 'vitest';
import { fallbackParse } from './fallbackParser.js';

// Shorter way to write the result: "auto 8, bus 8"
function short(entries) {
  return entries.map((e) => `${e.item} ${e.quantity}`).join(', ');
}

describe('keyword parser', () => {
  const cases = [
    ['transport', 'Went to college 8 km by auto and came back by bus', 'auto 8, bus 8'],
    ['transport', 'aaj 8 km auto se gaya', 'auto 8'],
    ['energy', 'AC on for 4 hours and geyser for 15 minutes', 'ac 4, geyser 0.25'],
    ['food', 'Dal rice for lunch, chicken roll for dinner', 'dal_rice 1, chicken_meal 1'],
    ['food', 'maine aaj mutton khaya', 'mutton_meal 1'],
    ['shopping', 'Bought a T-shirt from a thrift shop', 'clothing_secondhand 1'],
    ['waste', 'Left about 200 g of food in the mess and used two plastic bags', 'food_waste_100g 2, plastic_bag 2'],
    ['water', '10 minute hot shower and one wash cycle', 'hot_shower 1, machine_wash 1'],
    ['digital', 'Watched 3 hours of YouTube', 'streaming 3'],
    ['eco', 'Composted half a kg of scraps and planted a tree', 'compost 0.5, tree 1'],
  ];
  for (const [tab, sentence, expected] of cases) {
    it(`${tab}: "${sentence}"`, () => {
      expect(short(fallbackParse(sentence, tab))).toBe(expected);
    });
  }

  it('typing "8 km auto" works', () => {
    expect(short(fallbackParse('8 km auto', 'transport'))).toBe('auto 8');
  });

  it('only finds items from the open tab', () => {
    expect(fallbackParse('8 km auto', 'food')).toEqual([]);
  });

  it('the All tab finds items from every sector', () => {
    expect(short(fallbackParse('8 km auto and 2 hours of AC', 'all'))).toBe('auto 8, ac 2');
  });

  it('reads Hindi number words and units', () => {
    expect(short(fallbackParse('आज आठ किलोमीटर ऑटो से गया', 'transport'))).toBe('auto 8');
    expect(short(fallbackParse('आज 8 किलोमीटर ऑटो से गया', 'transport'))).toBe('auto 8');
  });

  it('works with Hindi script', () => {
    expect(short(fallbackParse('पंखा 3 घंटे', 'energy'))).toBe('fan 3');
  });
});
