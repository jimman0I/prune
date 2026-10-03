import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The running app's version, for anything the renderer remembers between
// launches that an update can make wrong (Deep Clean's remembered scan). It is
// the backend's: that is the number the packaged app reports and releases
// bump, while this package's own version is not kept in step with it.
const appVersion = JSON.parse(readFileSync(new URL('../backend/package.json', import.meta.url), 'utf8')).version;

export default defineConfig({
  plugins: [react()],
  base: './',
  define: { __APP_VERSION__: JSON.stringify(appVersion) },
  server: { port: 5174 },
  test: {
    setupFiles: ['./src/testSupport/setup.js'],
    // Above the 5 s asyncUtilTimeout in setup.js, so a slow wait fails as
    // a missing element rather than as a bare test timeout.
    testTimeout: 15000
  }
});
