// ai.test.js: checks the Gemma client without calling the real API (we fake the network).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { parse, validate, extractJson, getStatus, coach, numbersAreAllowed, impact, matchItem } from './ai.js';
import { impactFacts } from './calc.js';

// Build a fake API answer containing the given JSON text
function gemmaReply(json, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => (status === 200 ? { candidates: [{ content: { parts: [{ text: json }] } }] } : { error: { message: 'Bad request' } }),
    clone() { return this; },
  };
}

afterEach(() => vi.unstubAllGlobals());

describe('validate', () => {
  it('keeps good entries and fixes the sector from our own table', () => {
    const r = validate([{ sector: 'food', item: 'auto', quantity: 8, match: 'exact' }], 'transport');
    expect(r.entries).toEqual([{ sector: 'transport', item: 'auto', quantity: 8, match: 'exact' }]);
  });
  it('drops items that are not on the tab', () => {
    const r = validate([{ sector: 'energy', item: 'ac', quantity: 2, match: 'exact' }], 'transport');
    expect(r.entries).toEqual([]);
    expect(r.dropped).toEqual(['ac']);
  });
  it('drops made-up items and "unknown"', () => {
    expect(validate([{ item: 'spaceship', quantity: 1 }, { item: 'unknown', quantity: 1 }], 'all').entries).toEqual([]);
  });
  it('drops impossible quantities (over 500 km, 24 h, 6 meals)', () => {
    const r = validate([
      { item: 'car', quantity: 900 }, { item: 'ac', quantity: 30 }, { item: 'pizza', quantity: 10 }, { item: 'bus', quantity: -2 },
    ], 'all');
    expect(r.entries).toEqual([]);
    expect(r.dropped).toHaveLength(4);
  });
  it('keeps the closest-match flag', () => {
    expect(validate([{ item: 'chicken_meal', quantity: 1, match: 'closest' }], 'food').entries[0].match).toBe('closest');
  });
});

describe('extractJson', () => {
  it('reads JSON wrapped in code fences', () => {
    expect(extractJson('```json\n{"entries":[]}\n```')).toEqual({ entries: [] });
  });
});

describe('parse', () => {
  it('uses Gemma when it answers', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      gemmaReply('{"entries":[{"sector":"transport","item":"auto","quantity":8,"match":"exact"}]}')));
    const r = await parse('aaj 8 km auto se gaya', 'transport');
    expect(r.source).toBe('gemma');
    expect(r.entries[0]).toMatchObject({ item: 'auto', quantity: 8 });
    expect(getStatus().state).toBe('ok');
  });

  it('retries without the schema when Gemma says 400', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(gemmaReply('', 400))
      .mockResolvedValueOnce(gemmaReply('{"entries":[{"sector":"energy","item":"ac","quantity":4,"match":"exact"}]}'));
    vi.stubGlobal('fetch', fetchMock);
    const r = await parse('AC 4 hours please', 'energy');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).generationConfig.responseSchema).toBeUndefined();
    expect(r.source).toBe('gemma');
  });

  it('falls back to the keyword parser when the network fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    const r = await parse('8 km by bus', 'transport');
    expect(r.source).toBe('keyword');
    expect(r.entries[0]).toMatchObject({ item: 'bus', quantity: 8 });
    expect(getStatus().state).toBe('failed');
  });

  it('falls back to the keyword parser when every model is rate-limited (429)', async () => {
    const fetchMock = vi.fn(async () => gemmaReply('', 429));
    vi.stubGlobal('fetch', fetchMock);
    const r = await parse('2 hours of AC', 'energy');
    expect(fetchMock).toHaveBeenCalledTimes(3); // Gemma, then two Gemini backups
    expect(r.source).toBe('keyword');
  });

  it('switches to a Gemini backup when Gemma fails', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(gemmaReply('', 500))
      .mockResolvedValueOnce(gemmaReply('{"entries":[{"sector":"food","item":"pizza","quantity":2,"match":"exact"}]}'));
    vi.stubGlobal('fetch', fetchMock);
    const r = await parse('two pizzas tonight', 'food');
    expect(fetchMock.mock.calls[0][0]).toContain('gemma-4');
    expect(fetchMock.mock.calls[1][0]).toContain('gemini');
    expect(r.source).toBe('gemini');
    expect(r.entries[0]).toMatchObject({ item: 'pizza', quantity: 2 });
  });

  it('the test set mode asks Gemma only', async () => {
    const fetchMock = vi.fn(async () => gemmaReply('', 500));
    vi.stubGlobal('fetch', fetchMock);
    await expect(parse('3 hours YouTube', 'digital', { fallback: false, gemmaOnly: true })).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('a wrong API key stops straight away (no backups)', async () => {
    const fetchMock = vi.fn(async () => ({ ok: false, status: 400, clone() { return this; },
      json: async () => ({ error: { message: 'API key not valid' } }) }));
    vi.stubGlobal('fetch', fetchMock);
    const r = await parse('1 hour of TV', 'energy');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(r.source).toBe('keyword');
  });

  it('remembers answers, so the same sentence calls the model only once', async () => {
    const fetchMock = vi.fn(async () => gemmaReply('{"entries":[{"sector":"food","item":"pizza","quantity":1,"match":"exact"}]}'));
    vi.stubGlobal('fetch', fetchMock);
    await parse('one pizza', 'food');
    await parse('one pizza', 'food');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('coach', () => {
  const summary = { weekNetKg: 56.1, days: 7, topSector: 'Food', topSectorKg: 19.8, topSharePercent: 34 };
  const tips = [{ text: 'swap AC for Fan (Set 26 °C and add a fan)', savedKg: 12.6 }];

  it('accepts a plan that only uses the given numbers', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      gemmaReply('Food was 34% of your week. Swap the AC for a fan at 26 °C to save 12.6 kg.')));
    const r = await coach(summary, tips);
    expect(r.source).toBe('gemma');
  });

  it('rejects a plan with a made-up number and uses the code-written plan', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => gemmaReply('Food was 34%. You could save 40 kg!')));
    const r = await coach({ ...summary, weekNetKg: 50 }, tips);
    expect(r.source).toBe('template');
    expect(r.text).toContain('34%');
    expect(r.text).toContain('12.6 kg');
  });

  const sectors = [
    { label: 'Food', kg: 19.8, sharePercent: 34, swap: 'Swap mutton meal for dal rice', savedKg: 4.3, tip: 'Keep red meat for rare occasions' },
    { label: 'Energy', kg: 18.8, sharePercent: 32, swap: 'Swap AC for fan', savedKg: 16.8, tip: 'Set 26 °C and add a fan' },
    { label: 'Shopping', kg: 11, sharePercent: 19, swap: 'Swap new clothes for second-hand clothes', savedKg: 8, tip: null },
  ];

  it('sends the top three categories and accepts their numbers in the plan', async () => {
    let sent = '';
    vi.stubGlobal('fetch', vi.fn(async (url, opts) => {
      sent = opts.body;
      return gemmaReply('Food was 34%. Energy was 32%: a fan would have saved 16.8 kg. Shopping was 19%: second-hand saves 8 kg.');
    }));
    const r = await coach({ ...summary, weekNetKg: 51 }, tips, sectors);
    expect(sent).toContain('Energy: 18.8 kg (32%)');
    expect(sent).toContain('Shopping: 11 kg (19%)');
    expect(r.source).toBe('gemma');
  });

  it('the code-written plan also covers the other categories', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => gemmaReply('Save 99 kg!')));
    const r = await coach({ ...summary, weekNetKg: 52 }, tips, sectors);
    expect(r.source).toBe('template');
    expect(r.text).toContain('In energy (32%)');
    expect(r.text).toContain('16.8 kg');
  });

  it('numbersAreAllowed spots new numbers', () => {
    expect(numbersAreAllowed('save 12.6 kg', [12.6])).toBe(true);
    expect(numbersAreAllowed('save 13 kg', [12.6])).toBe(false);
  });
});

describe('impact', () => {
  const facts = impactFacts(2.92);

  it('works out the facts in code', () => {
    expect(facts.timesTarget).toBe(1.3);
    expect(facts.seaIceM2).toBe(9);
    expect(facts.treesForAYear).toBe(138);
  });

  it('accepts a line that only uses given numbers', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => gemmaReply(JSON.stringify({
      line: 'Every year at this pace, 9 m² of Arctic ice your children will never see disappears.',
      ideas: ['Cook dal with friends', 'Share autos', 'Swap clothes'],
    }))));
    const r = await impact(facts, ['Food']);
    expect(r.source).toBe('gemma');
    expect(r.ideas).toHaveLength(3);
  });

  it('rejects made-up numbers and uses the app-written version', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => gemmaReply(JSON.stringify({
      line: 'This will kill 10000 people.', ideas: ['a', 'b', 'c'],
    }))));
    const r = await impact({ ...facts, forecastTonnes: 2.93 }, ['Food', 'Energy']);
    expect(r.source).toBe('template');
    expect(r.line).toContain('2.93');
    expect(r.ideas.length).toBe(3);
  });
});

describe('matchItem', () => {
  it('returns the closest known item for any dish', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => gemmaReply(JSON.stringify({
      sector: 'food', item: 'chicken_meal', name: 'Chicken biryani', why: 'Rice with chicken',
    }))));
    const r = await matchItem('chicken biryani', 'food');
    expect(r.item).toBe('chicken_meal');
    expect(r.name).toBe('Chicken biryani');
  });

  it('refuses an item that is not in our table, then falls back to keywords', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => gemmaReply(JSON.stringify({ sector: 'food', item: 'biryani_x' }))));
    const r = await matchItem('mutton biryani', 'food');
    expect(r?.item ?? null).not.toBe('biryani_x');
  });
});
