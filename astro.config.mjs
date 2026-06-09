// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import react from '@astrojs/react';

// HINWEIS: `site` ist aktuell ein Platzhalter — bitte durch die echte Domain ersetzen.
// Wird für Canonical-URLs, hreflang und die Sitemap genutzt.
export default defineConfig({
  site: 'https://alpsagency.de',
  integrations: [sitemap(), react()],
  vite: {
    plugins: [tailwindcss()],
  },
});
