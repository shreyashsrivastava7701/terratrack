// routes.js: the route suggester. Free OpenStreetMap services through the Vite proxy:
//   /api/geo   -> Nominatim, turns "IIT Delhi" into a point on the map
//   /api/route -> OSRM (routing.openstreetmap.de), real road distance and time for car, bike and foot
// Metro, bus and auto use the road distance with typical city speeds, so their times are estimates.
import { kgPerUnit } from './calc.js';

export async function searchPlace(text) {
  const url = `/api/geo/search?format=jsonv2&limit=5&countrycodes=in&q=${encodeURIComponent(text)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`Place search failed (${res.status})`);
  const list = await res.json();
  return list.map((p) => ({ name: p.display_name, lat: Number(p.lat), lon: Number(p.lon) }));
}

// Road distance (km) and time (minutes) for one OSRM profile: "car", "bike" or "foot"
async function osrm(profile, from, to) {
  const url = `/api/route/routed-${profile}/route/v1/driving/${from.lon},${from.lat};${to.lon},${to.lat}?overview=false`;
  const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
  if (!res.ok) throw new Error(`Route failed (${res.status})`);
  const data = await res.json();
  const r = data.routes?.[0];
  if (data.code !== 'Ok' || !r) throw new Error('No route found between these places');
  return { km: r.distance / 1000, min: r.duration / 60 };
}

// Typical door-to-door speeds in Indian cities (km/h) plus waiting time (minutes). Estimates.
const CITY = {
  metro: { speed: 32, wait: 12 },
  bus: { speed: 16, wait: 10 },
  auto: { speed: 22, wait: 4 },
  e_rickshaw: { speed: 15, wait: 4 },
};

export const MODE_LABELS = {
  walk: 'Walk', cycle: 'Cycle', metro: 'Metro', bus: 'Bus', e_rickshaw: 'E-rickshaw',
  auto: 'Auto', bike: 'Bike', car: 'Car',
};

// Every option with km, minutes, kg and kg saved vs the usual mode, best first
export async function planRoute(from, to, usualMode = 'auto') {
  const [car, bike, foot] = await Promise.all([
    osrm('car', from, to),
    osrm('bike', from, to).catch(() => null),
    osrm('foot', from, to).catch(() => null),
  ]);

  const options = [];
  const add = (mode, km, min, estimated) =>
    options.push({ mode, km, min, kg: kgPerUnit('transport', mode) * km, estimated });

  if (foot && foot.km <= 4) add('walk', foot.km, foot.min, false);
  if (bike && bike.km <= 15) add('cycle', bike.km, bike.min, false);
  if (car.km >= 3) add('metro', car.km, (car.km / CITY.metro.speed) * 60 + CITY.metro.wait, true);
  add('bus', car.km, (car.km / CITY.bus.speed) * 60 + CITY.bus.wait, true);
  if (car.km <= 8) add('e_rickshaw', car.km, (car.km / CITY.e_rickshaw.speed) * 60 + CITY.e_rickshaw.wait, true);
  add('auto', car.km, (car.km / CITY.auto.speed) * 60 + CITY.auto.wait, true);
  add('bike', car.km, car.min * 1.1, false);
  add('car', car.km, car.min, false);

  const usualKg = kgPerUnit('transport', usualMode) * car.km;
  for (const o of options) o.savedKg = Math.max(0, usualKg - o.kg);

  // Best = lowest kg that doesn't take more than double the fastest option (walking 4 km at night isn't "best")
  const fastest = Math.min(...options.map((o) => o.min));
  const sensible = options.filter((o) => o.min <= Math.max(fastest * 2, fastest + 20));
  const best = [...sensible].sort((a, b) => a.kg - b.kg || a.min - b.min)[0];

  options.sort((a, b) => a.kg - b.kg || a.min - b.min);
  return { roadKm: car.km, options, best, usualMode, usualKg };
}

// A link that opens the same trip on openstreetmap.org
export function osmLink(from, to) {
  return `https://www.openstreetmap.org/directions?route=${from.lat},${from.lon};${to.lat},${to.lon}`;
}
