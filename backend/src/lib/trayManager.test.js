import { describe, it, expect } from 'vitest';
import { initTray } from './trayManager.js';

describe('initTray', () => {
  it('resolves without throwing outside a real Electron runtime', async () => {
    // There is no Electron runtime in the test environment -- 'electron'
    // is not even an installed package here (it's a devDependency of
    // electron/package.json, a completely separate npm project). The
    // guarded dynamic import inside initTray() must fail silently rather
    // than crash the caller; that IS the behavior under test.
    await expect(initTray()).resolves.toBeUndefined();
  });

  it('is safe to call more than once (the initialized guard)', async () => {
    await expect(initTray()).resolves.toBeUndefined();
    await expect(initTray()).resolves.toBeUndefined();
  });
});
