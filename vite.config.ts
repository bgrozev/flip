import { copyFileSync } from 'node:fs';
import { resolve } from 'node:path';

import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

/**
 * History-routing fallback for GitHub Pages: Pages serves 404.html for any
 * unknown path, so shipping a copy of index.html there makes deep links
 * (/wind, /pattern, ...) reload-safe on static hosting.
 */
function spa404Fallback(): Plugin {
  return {
    name: 'spa-404-fallback',
    apply: 'build',
    closeBundle() {
      copyFileSync(
        resolve(__dirname, 'build/index.html'),
        resolve(__dirname, 'build/404.html')
      );
    }
  };
}

export default defineConfig({
  plugins: [react(), spa404Fallback()],
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
