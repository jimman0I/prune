// Builds the production installer: frontend bundle, a production-only
// copy of the backend, then electron-builder. Run via `npm run dist`
// (electron/package.json) rather than calling electron-builder directly --
// electron-builder alone would package the SHARED dev backend/node_modules
// (vitest and its whole dependency tree included) and never rebuild
// frontend/dist first, silently shipping a stale UI.
import { execFileSync } from 'node:child_process';
import { existsSync, rmSync, mkdirSync, cpSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const electronRoot = join(here, '..');
const repoRoot = join(electronRoot, '..');
const frontendRoot = join(repoRoot, 'frontend');
const backendRoot = join(repoRoot, 'backend');
const buildRoot = join(electronRoot, 'build');
const backendProdRoot = join(buildRoot, 'backend-prod');

const started = Date.now();
const elapsed = () => `${((Date.now() - started) / 1000).toFixed(1)}s`;

function step(label, fn) {
  console.log(`\n[build-installer] ${label}`);
  fn();
  console.log(`[build-installer] done (${elapsed()})`);
}

// Real bug, found running this live (2026-09-01): execFileSync('npm.cmd',
// ...) fails with EINVAL on this machine without `shell: true` -- Windows'
// CreateProcess can't exec a .cmd shim directly, it needs a shell to
// interpret it (same reason Re:Route's own build-installer.mjs spawns
// via `shell: process.platform === 'win32'`). Applies to every .cmd
// invocation below (npm.cmd, npx.cmd).
const winShell = { shell: process.platform === 'win32' };

step('1/4 Building frontend (vite build)', () => {
  execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build'], {
    cwd: frontendRoot,
    stdio: 'inherit',
    ...winShell
  });
});

step('2/4 Copying backend source into a clean build-only directory', () => {
  // A FRESH copy every run, not a reused/incrementally-updated one -- a
  // stale file left over from a previous build (or from a manual edit
  // made directly in build/backend-prod/ by mistake) must never survive
  // into the next installer.
  rmSync(backendProdRoot, { recursive: true, force: true });
  mkdirSync(backendProdRoot, { recursive: true });
  cpSync(join(backendRoot, 'src'), join(backendProdRoot, 'src'), { recursive: true });
  cpSync(join(backendRoot, 'package.json'), join(backendProdRoot, 'package.json'));
  const lockfile = join(backendRoot, 'package-lock.json');
  if (existsSync(lockfile)) cpSync(lockfile, join(backendProdRoot, 'package-lock.json'));
});

step('3/4 Installing production-only backend dependencies (npm ci --omit=dev)', () => {
  // This installs into build/backend-prod/ -- a throwaway directory, never
  // the real backend/node_modules the dev environment (and its test
  // suite) depends on. Falls back to `npm install` when there's no
  // lockfile yet, same as any other bootstrap.
  const hasLockfile = existsSync(join(backendProdRoot, 'package-lock.json'));
  const cmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const args = hasLockfile ? ['ci', '--omit=dev'] : ['install', '--omit=dev'];
  execFileSync(cmd, args, { cwd: backendProdRoot, stdio: 'inherit', ...winShell });
});

step('4/4 Running electron-builder', () => {
  // -c explicitly: electron-builder does not auto-detect a .cjs config
  // file and says nothing when it fails to find one -- it just builds
  // with defaults, producing an app with no backend inside it.
  //
  // Real bug, found running this live (2026-09-01): even with no signing
  // config anywhere, electron-builder's default "auto discover a signing
  // identity" behavior for win targets downloads winCodeSign (a macOS
  // code-signing tool bundled for cross-platform signing support) and
  // tries to extract it -- winCodeSign's archive contains real macOS
  // symlinks (.dylib -> .dylib), which 7-Zip on Windows can only recreate
  // with SeCreateSymbolicLinkPrivilege (Developer Mode or an elevated
  // prompt). Failed identically 4/4 retries with "Cannot create symbolic
  // link: A required privilege is not held by the client." This app ships
  // unsigned by design (no cert), so there is nothing to auto-discover --
  // CSC_IDENTITY_AUTO_DISCOVERY=false skips that entire step rather than
  // requiring Developer Mode or an elevated shell just to build.
  execFileSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['electron-builder', '-c', 'electron-builder.config.cjs'], {
    cwd: electronRoot,
    stdio: 'inherit',
    env: { ...process.env, CSC_IDENTITY_AUTO_DISCOVERY: 'false' },
    ...winShell
  });
});

console.log(`\n[build-installer] All done in ${elapsed()}.`);
