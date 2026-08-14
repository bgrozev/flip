import { copyFileSync } from 'node:fs';
import { resolve } from 'node:path';

import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

/**
 * History-routing fallback for GitHub Pages: Pages serves 404.html for any
 * unknown path, so shipping a copy of index.html there makes deep links
 * (/wind, /pattern, ...) reload-safe on static hosting.
 *
 * Runs with `enforce: 'post'` so it copies the *final* index.html — after
 * VitePWA has injected the manifest link and service-worker registration.
 */
function spa404Fallback(): Plugin {
  return {
    name: 'spa-404-fallback',
    apply: 'build',
    enforce: 'post',
    closeBundle() {
      copyFileSync(
        resolve(__dirname, 'build/index.html'),
        resolve(__dirname, 'build/404.html')
      );
    }
  };
}

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // We ship our own icons; don't let the plugin manage extra assets.
      includeAssets: ['favicon.ico', 'favicon.svg', 'robots.txt'],
      manifest: {
        name: 'FliP Flight Planner',
        short_name: 'FliP',
        description: 'Wind-corrected landing-pattern planner for skydivers',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        // Precache the app shell (JS/CSS/HTML). navigateFallback lets the
        // installed app open deep links offline.
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            // Winds aloft + elevation (OpenMeteo). NetworkFirst so a live
            // forecast is preferred, but the last one is available offline.
            urlPattern: ({ url }) => url.hostname === 'api.open-meteo.com',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'openmeteo',
              networkTimeoutSeconds: 6,
              expiration: { maxEntries: 40, maxAgeSeconds: 6 * 60 * 60 }
            }
          },
          {
            // Observed stations + gridpoints (NWS).
            urlPattern: ({ url }) => url.hostname === 'api.weather.gov',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'nws',
              networkTimeoutSeconds: 6,
              expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 }
            }
          },
          {
            // Radiosonde soundings (Iowa Environmental Mesonet).
            urlPattern: ({ url }) => url.hostname === 'mesonet.agron.iastate.edu',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'iem-soundings',
              networkTimeoutSeconds: 6,
              expiration: { maxEntries: 20, maxAgeSeconds: 6 * 60 * 60 }
            }
          }
          // NOTE: Google Maps tiles are deliberately NOT cached — Google's
          // terms restrict tile caching. Offline maps are tracked as the
          // MapLibre adapter item in docs/redesign/BACKLOG.md.
        ]
      }
    }),
    spa404Fallback()
  ],
  server: {
    // Default to CRA's traditional port; PORT env overrides
    port: Number(process.env.PORT) || 3000
  },
  build: {
    // Keep CRA's output directory so the Pages deploy workflow is unchanged
    outDir: 'build',
    sourcemap: false
  },
  test: {
    globals: true,
    environment: 'node'
  }
});
