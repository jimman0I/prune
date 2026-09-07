// Builds the production installer: frontend bundle, a production-only
// copy of the backend, then electron-builder. Run via `npm run dist`
// (electron/package.json) rather than calling electron-builder directly --
// electron-builder alone would package the SHARED dev backend/node_modules
// (vitest and its whole dependency tree included) and never rebuild
// frontend/dist first, silently shipping a stale UI.
import { execFileSync } from 'node:child_process';
import { existsSync, rmSync, mkdirSync, cpSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const electronRoot = join(here, '..');
const repoRoot = join(electronRoot, '..');
const frontendRoot = join(repoRoot, 'frontend');
const backendRoot = join(repoRoot, 'backend');
const buildRoot = join(electronRoot, 'build');
const backendProdRoot = join(buildRoot, 'backend-prod');
const distRoot = join(electronRoot, 'dist');

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

// electron-builder overwrites its OWN outputs but leaves every other
// version's alone, so dist/ accumulates rather than reflecting the build
// that just ran. Found live (2026-09-06): it still held "unrevo Setup
// 1.0.0.exe" -- an installer under the app's pre-rebrand name -- beside
// 1.0.0 and 1.0.1 Prune builds, 1.2 GB in total. A folder someone
// publishes out of is the wrong place to keep three superseded releases
// and a brand the app no longer uses: the risk is not the disk, it is
// uploading or linking the wrong file.
//
// Everything in here is reproducible by running this script, and nothing
// in it is tracked (electron/dist is gitignored), so a clean slate costs
// nothing. Note this is dist/ specifically, NOT build/ -- build/ holds
// icon.ico and icon.png, which are committed source.
step('1/6 Clearing dist/, so it holds only what this build produced', () => {
  rmSync(distRoot, { recursive: true, force: true });
});

step('2/6 Building frontend (vite build)', () => {
  execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build'], {
    cwd: frontendRoot,
    stdio: 'inherit',
    ...winShell
  });
});

step('3/6 Copying backend source into a clean build-only directory', () => {
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

step('4/6 Installing production-only backend dependencies (npm ci --omit=dev)', () => {
  // This installs into build/backend-prod/ -- a throwaway directory, never
  // the real backend/node_modules the dev environment (and its test
  // suite) depends on. Falls back to `npm install` when there's no
  // lockfile yet, same as any other bootstrap.
  const hasLockfile = existsSync(join(backendProdRoot, 'package-lock.json'));
  const cmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const args = hasLockfile ? ['ci', '--omit=dev'] : ['install', '--omit=dev'];
  execFileSync(cmd, args, { cwd: backendProdRoot, stdio: 'inherit', ...winShell });
});

step('5/6 Running electron-builder', () => {
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

/* Checksums for whatever this build actually produced.
 *
 * Prune ships unsigned by choice, so Windows warns on first run and the
 * warning never clears. A hash is not a substitute for a signature -- it
 * says nothing about WHO built the file -- but it is the one guarantee
 * still available without a certificate: that the download arrived
 * byte-for-byte as it left here. Published with the release so anyone can
 * check before running it.
 *
 * Generated rather than written by hand, because a checksum file that
 * disagrees with its artifacts is worse than none at all: it teaches
 * people that a mismatch is normal.
 *
 * One file is read at a time rather than all of them up front. These are
 * 115MB and 154MB, and holding both would be a third of a gigabyte for no
 * reason. */
step('6/6 Writing SHA256SUMS.txt for the release artifacts', () => {
  const artifacts = readdirSync(distRoot)
    .filter((name) => /\.(exe|zip)$/i.test(name))
    .sort();

  if (artifacts.length === 0) {
    // Not a silent skip. Reaching here with nothing to hash means the step
    // above produced no installer, which is a failed build wearing a
    // success message.
    throw new Error('No .exe or .zip found in dist/ to checksum.');
  }

  const lines = artifacts.map((name) => {
    const hash = createHash('sha256').update(readFileSync(join(distRoot, name))).digest('hex');
    // Two spaces before the name is the sha256sum format, so this can be
    // verified with `sha256sum -c` as well as read by eye.
    return `${hash}  ${name}`;
  });

  writeFileSync(join(distRoot, 'SHA256SUMS.txt'), `${lines.join('\n')}\n`, 'utf8');
  for (const line of lines) console.log(`  ${line}`);
});

console.log(`\n[build-installer] All done in ${elapsed()}.`);
