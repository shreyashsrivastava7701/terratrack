// vite.config.js
// Vite runs our dev server. It also has a small "proxy":
// when the browser calls /api/gemma/..., Vite forwards the call to Google AI Studio
// and adds the secret key from .env. The key never reaches the browser.
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig(({ mode }) => {
  // Load every variable from .env (the '' means "not only VITE_ ones")
  const env = loadEnv(mode, process.cwd(), '');

  return {
    // "npm run dev:phone" uses mode "phone": https (needed for GPS on a phone) and open on the Wi-Fi network
    plugins: [react(), tailwindcss(), ...(mode === 'phone' ? [basicSsl()] : [])],
    server: {
      host: mode === 'phone' ? true : undefined,
      proxy: {
        '/api/gemma': {
          target: 'https://generativelanguage.googleapis.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/gemma/, ''),
          headers: { 'x-goog-api-key': env.GEMINI_API_KEY || '' },
        },
        // OpenStreetMap: place search (Nominatim) and routes (OSRM at routing.openstreetmap.de). Free, no key.
        '/api/geo': {
          target: 'https://nominatim.openstreetmap.org',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/geo/, ''),
          headers: { 'User-Agent': 'TerraTrack student project (localhost)' },
        },
        '/api/route': {
          target: 'https://routing.openstreetmap.de',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/route/, ''),
          headers: { 'User-Agent': 'TerraTrack student project (localhost)' },
        },
      },
    },
  };
});
