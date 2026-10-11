// tracker.js: maths for the live trip tracker. The phone's GPS gives a point every few seconds;
// we add up the distance and use the speed to guess how you travelled. The user always confirms.

// Distance between two GPS points in km (haversine formula)
export function distanceKm(a, b) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Add one GPS fix to the trip. The first fix is always kept as the start point.
// After that, fixes worse than 100 m, or jumps faster than 200 km/h, are ignored.
export function addFix(trip, fix) {
  const last = trip.points[trip.points.length - 1];
  if (!last) return { ...trip, points: [fix] };
  if (fix.accuracy > 100) return trip;
  const km = distanceKm(last, fix);
  const hours = (fix.t - last.t) / 3600000;
  if (hours <= 0) return trip;
  const kmh = km / hours;
  if (kmh > 200) return trip; // GPS glitch
  if (km < 0.005) return { ...trip, points: [...trip.points.slice(0, -1), { ...last, t: fix.t }] }; // standing still
  return { ...trip, km: trip.km + km, points: [...trip.points, fix], speeds: [...trip.speeds, kmh] };
}

export function newTrip(startedAt = Date.now()) {
  return { startedAt, km: 0, points: [], speeds: [] };
}

function median(list) {
  if (list.length === 0) return 0;
  const s = [...list].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// Guess the mode from moving speeds (km/h). Returns { mode, choices, medianKmh, topKmh }.
// Typical speeds: walking 3-6, cycling 10-18, auto/bike/bus 15-35 in city traffic, car/metro/train faster.
export function guessMode(speeds) {
  const moving = speeds.filter((v) => v >= 1.5);
  const med = median(moving);
  const top = moving.length ? [...moving].sort((a, b) => a - b)[Math.floor(moving.length * 0.9)] : 0;
  let mode, choices;
  if (med < 7 && top < 12) { mode = 'walk'; choices = ['walk', 'cycle']; }
  else if (med < 18 && top < 28) { mode = 'cycle'; choices = ['cycle', 'e_rickshaw', 'walk', 'bus']; }
  else if (top < 55) { mode = 'auto'; choices = ['auto', 'bus', 'bike', 'e_rickshaw', 'car', 'metro']; }
  else if (top < 90) { mode = 'car'; choices = ['car', 'metro', 'bus', 'bike', 'auto']; }
  else { mode = 'train'; choices = ['train', 'metro', 'car']; }
  return { mode, choices, medianKmh: med, topKmh: top };
}

// Demo for laptops (no movement indoors): a made-up 4 km auto ride, as GPS fixes.
// Speeds vary like city traffic: stop, 15-35 km/h, short waits.
export function simulatedRide(start = { lat: 28.5494, lon: 77.2001 }, t0 = Date.now()) {
  const speeds = [0, 12, 22, 30, 34, 28, 8, 0, 18, 26, 32, 35, 30, 24, 10, 0, 20, 28, 33, 30, 25, 15, 5];
  const fixes = [];
  let lat = start.lat, t = t0;
  for (const kmh of speeds) {
    for (let i = 0; i < 2; i++) {
      t += 15000; // one fix every 15 seconds of "travel"
      lat += (kmh * (15 / 3600)) / 111.2; // km north, as degrees of latitude
      fixes.push({ lat, lon: start.lon, t, accuracy: 8 });
    }
  }
  return fixes;
}
