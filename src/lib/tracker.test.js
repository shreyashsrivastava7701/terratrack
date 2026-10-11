import { describe, it, expect } from 'vitest';
import { distanceKm, addFix, newTrip, guessMode, simulatedRide } from './tracker.js';

describe('trip tracker', () => {
  it('measures distance between two points', () => {
    // about 1.11 km per 0.01 degree of latitude
    expect(distanceKm({ lat: 28.5, lon: 77.2 }, { lat: 28.51, lon: 77.2 })).toBeCloseTo(1.11, 2);
  });

  it('adds up a trip and ignores bad fixes', () => {
    let trip = newTrip(0);
    trip = addFix(trip, { lat: 28.5, lon: 77.2, t: 0, accuracy: 10 });
    trip = addFix(trip, { lat: 28.501, lon: 77.2, t: 60000, accuracy: 10 }); // 111 m in a minute
    trip = addFix(trip, { lat: 29.5, lon: 77.2, t: 61000, accuracy: 10 }); // impossible jump: ignored
    trip = addFix(trip, { lat: 28.502, lon: 77.2, t: 120000, accuracy: 200 }); // poor accuracy: ignored
    expect(trip.km).toBeCloseTo(0.111, 2);
    expect(trip.speeds[0]).toBeCloseTo(6.7, 0);
  });

  it('guesses walking, cycling, auto and car from speed', () => {
    expect(guessMode([4, 5, 4.5, 5.5]).mode).toBe('walk');
    expect(guessMode([12, 14, 15, 13]).mode).toBe('cycle');
    expect(guessMode([20, 30, 25, 40, 10]).mode).toBe('auto');
    expect(guessMode([50, 60, 70, 40]).mode).toBe('car');
  });

  it('the demo ride comes out as about 4 km by auto', () => {
    let trip = newTrip(0);
    for (const f of simulatedRide({ lat: 28.5, lon: 77.2 }, 0)) trip = addFix(trip, f);
    expect(trip.km).toBeGreaterThan(3);
    expect(trip.km).toBeLessThan(5);
    expect(guessMode(trip.speeds).mode).toBe('auto');
  });
});
