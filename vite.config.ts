import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
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
