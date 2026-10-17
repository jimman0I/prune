import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { measureDirectory } from './leftoverWalk.js';
import { canonicalKeyPath } from './registryLeftovers.js';
import { runElevatedPowerShellJson } from '../lib/elevated.js';

/** Chocolatey packages, read straight from Chocolatey's own folder.
 *
 * A package that ran a real installer (python314, vcredist140, Build Tools)
 * leaves a normal Add/Remove entry -- the list already shows it -- and
 * Chocolatey records which one in .chocolatey\<id>.<version>\.registry.
 * Those entries are only tagged as Chocolatey's. Every other package
 * (metapackages, extensions, update shims, portable tools that only copy
 * files and add to PATH) has no entry at all and was invisible here; those
 * become rows of their own, removed with `choco uninstall` so Chocolatey's
 * own record stays true.
 *
 * Plain file reads, no `choco` process: listing must work without starting
 * Chocolatey, and the files are its source of truth anyway. */

export function chocolateyRoot(env = process.env) {
  if (env?.ChocolateyInstall) return env.ChocolateyInstall;
  return join(env?.ProgramData || 'C:\\ProgramData', 'chocolatey');
}

const decode = (text) => String(text)
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')
  .trim();

const tag = (xml, name) => {
  const match = new RegExp(`<${name}>([\\s\\S]*?)</${name}>`, 'i').exec(xml);
  return match ? decode(match[1]) : '';
};

/** The fields of a .nuspec the list uses, or null when it is not one. */
export function parseNuspec(xml) {
  if (typeof xml !== 'string' || !/<metadata>/i.test(xml)) return null;
  const id = tag(xml, 'id');
  if (!id) return null;
  return { id, version: tag(xml, 'version'), title: tag(xml, 'title'), authors: tag(xml, 'authors'), summary: tag(xml, 'summary') };
}

/** The uninstall-key paths in a .registry snapshot. */
export function parseRegistrySnapshot(xml) {
  return [...String(xml || '').matchAll(/<KeyPath>([\s\S]*?)<\/KeyPath>/gi)].map((m) => decode(m[1])).filter(Boolean);
}

/** Every installed package: { id, version, title, authors, summary, folder,
 * sizeBytes, registryKeys }. An empty list when Chocolatey is not there. */
export async function readChocolateyPackages(root = chocolateyRoot()) {
  let ids;
  try {
    ids = (await readdir(join(root, 'lib'), { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name);
  } catch {
    return [];
  }
  const packages = [];
  for (const dir of ids) {
    const folder = join(root, 'lib', dir);
    let meta = null;
    try {
      const nuspecFile = (await readdir(folder)).find((name) => name.toLowerCase().endsWith('.nuspec'));
      if (nuspecFile) meta = parseNuspec(await readFile(join(folder, nuspecFile), 'utf8'));
    } catch {
      meta = null;
    }
    if (!meta) continue;
    const registryKeys = await readFile(join(root, '.chocolatey', `${meta.id}.${meta.version}`, '.registry'), 'utf8')
      .then(parseRegistrySnapshot)
      .catch(() => []);
    packages.push({ ...meta, folder, sizeBytes: await measureDirectory(folder), registryKeys });
  }
  return packages;
}

/** The packages with no Add/Remove entry of their own, as program-list rows. */
export function chocolateyRows(packages) {
  return (packages || [])
    .filter((pkg) => pkg.registryKeys.length === 0)
    .map((pkg) => ({
      // Prefixed like the Store rows, so an id never collides with a registry key name.
      id: `chocolatey:${pkg.id}`,
      name: pkg.title || pkg.id,
      publisher: pkg.authors || '',
      version: pkg.version || '',
      installLocation: pkg.folder,
      sizeBytes: pkg.sizeBytes,
      chocolateyId: pkg.id,
      description: pkg.summary || '',
      source: 'chocolatey'
    }));
}

/** { programId: packageId } for every listed program a package installed,
 * matched on the Add/Remove key Chocolatey recorded for it. */
export function managedPrograms(packages, programs) {
  const byKey = new Map();
  for (const pkg of packages || []) {
    for (const key of pkg.registryKeys) byKey.set(canonicalKeyPath(key), pkg.id);
  }
  const managed = {};
  for (const program of programs || []) {
    const id = byKey.get(canonicalKeyPath(program.registryKey));
    if (id) managed[program.id] = id;
  }
  return managed;
}

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const psLiteral = (value) => `'${String(value).replace(/'/g, "''")}'`;

export function buildChocoUninstallScript(id, root = chocolateyRoot()) {
  const exe = join(root, 'bin', 'choco.exe');
  return `$ErrorActionPreference = 'Stop'
& ${psLiteral(exe)} @('uninstall', ${psLiteral(id)}, '-y', '--no-progress') | Out-Null
ConvertTo-Json -Compress -InputObject ([PSCustomObject]@{ exitCode = $LASTEXITCODE })`;
}

/** Removes one package with Chocolatey itself, elevated (a machine-wide
 * install). Only an id that is installed right now is accepted -- read
 * again here, never taken on the client's word. Result contract as
 * elsewhere: { ok: true } | { ok: false, cancelled: true } | { ok: false, error }. */
export async function uninstallChocolateyPackage(id, { runElevated = runElevatedPowerShellJson, read = readChocolateyPackages } = {}) {
  if (typeof id !== 'string' || !SAFE_ID.test(id)) return { ok: false, error: 'That is not a Chocolatey package name.' };
  const installed = await read();
  if (!installed.some((pkg) => pkg.id.toLowerCase() === id.toLowerCase())) {
    return { ok: false, error: 'That package is no longer installed.' };
  }
  const result = await runElevated(buildChocoUninstallScript(id), { timeoutMs: 10 * 60 * 1000 });
  if (!result.ok) return result;
  const code = Number(result.data?.exitCode);
  // Chocolatey's success codes: 0, and the MSI "reboot needed" ones.
  if (code === 0 || code === 1641 || code === 3010) return { ok: true, ...(code !== 0 ? { restartNeeded: true } : {}) };
  return { ok: false, error: `Chocolatey could not remove it (exit code ${Number.isFinite(code) ? code : 'unknown'}).` };
}
