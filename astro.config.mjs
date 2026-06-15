// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import react from '@astrojs/react';
import vercel from '@astrojs/vercel';

// HINWEIS: `site` ist aktuell ein Platzhalter — bitte durch die echte Domain ersetzen.
// Wird für Canonical-URLs, hreflang und die Sitemap genutzt.
//
// output: 'static' bleibt Standard → Marketing-Seiten werden statisch gebaut.
// Die Admin-Seiten (ATEAM) opten per `export const prerender = false` in SSR
// (Login-Guard + echte Supabase-Daten). Der Vercel-Adapter liefert das On-Demand-Rendering.
export default defineConfig({
  site: 'https://alpsagency.de',
  output: 'static',
  adapter: vercel(),
  security: { checkOrigin: false },
  integrations: [sitemap(), react()],
  vite: {
    plugins: [tailwindcss()],
    // Verhindert „Invalid hook call" / doppelte React-Instanz: React (und motion, das
    // React als Peer nutzt) müssen GENAU eine React-Kopie teilen. Dedupe erzwingt das,
    // optimizeDeps bündelt motion zusammen mit React vor.
    resolve: {
      dedupe: ['react', 'react-dom'],
    },
    optimizeDeps: {
      include: ['react', 'react-dom', 'react/jsx-runtime', 'motion/react'],
    },
  },
});
