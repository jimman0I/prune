import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  server: { port: 5174 },
  test: {
    setupFiles: ['./src/testSupport/setup.js'],
    // Above the 5 s asyncUtilTimeout in setup.js, so a slow wait fails as
    // a missing element rather than as a bare test timeout.
    testTimeout: 15000
  }
});
