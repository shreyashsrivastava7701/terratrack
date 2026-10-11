// api/proxy.js: on Vercel, this does the job the Vite proxy does on your laptop.
// The browser calls /api/geo/..., /api/route/... or /api/gemma/... and vercel.json sends them here.
// We forward the call to OpenStreetMap or Google AI Studio. The Gemini key is added here, on the
// server, from Vercel's Environment Variables, so it never reaches the browser.
const TARGETS = {
  geo: 'https://nominatim.openstreetmap.org',
  route: 'https://routing.openstreetmap.de',
  gemma: 'https://generativelanguage.googleapis.com',
};

export default async function handler(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const service = url.searchParams.get('service');
  const path = url.searchParams.get('path') ?? '';
  const target = TARGETS[service];
  if (!target || path.includes('..') || (service === 'gemma' && !path.startsWith('v1beta/models/'))) {
    res.status(404).json({ error: 'Unknown service' });
    return;
  }
  url.searchParams.delete('service');
  url.searchParams.delete('path');
  const query = url.searchParams.toString();

  const headers = { 'User-Agent': 'TerraTrack student project (vercel)' };
  if (service === 'gemma') {
    headers['x-goog-api-key'] = process.env.GEMINI_API_KEY || '';
    headers['Content-Type'] = 'application/json';
  }

  try {
    const upstream = await fetch(`${target}/${path}${query ? `?${query}` : ''}`, {
      method: req.method,
      headers,
      body: req.method === 'POST' ? JSON.stringify(req.body) : undefined,
    });
    const text = await upstream.text();
    res.status(upstream.status);
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json');
    res.send(text);
  } catch (err) {
    res.status(502).json({ error: `Could not reach ${service}: ${err.message}` });
  }
}
