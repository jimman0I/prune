import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveActionFiles, collectFiles, scan, execute } from './delete.js';

let scratchDir;
beforeEach(async () => {
  scratchDir = await mkdtemp(join(tmpdir(), 'prune-delete-test-'));
});
afterEach(async () => {
  await rm(scratchDir, { recursive: true, force: true });
});

// Regression coverage for the AutomaticDestinations bug: a bare-folder
// `delete` rule must be able to name a specific file it should never
// touch, even though the folder itself has no wildcard in its path.
describe('excludeNames', () => {
  it('collectFiles skips a file whose basename is in excludeBasenames', async () => {
    await writeFile(join(scratchDir, 'keep.txt'), 'pinned folders live here');
    await writeFile(join(scratchDir, 'other.txt'), 'ordinary jump list');

    const out = [];
    const denied = [];
    collectFiles(scratchDir, out, denied, new Set(['keep.txt']));

    const names = out.map((f) => f.path.split(/[\\/]/).pop());
    expect(names).toEqual(['other.txt']);
  });

  it('is case-insensitive, matching how Windows names files', async () => {
    await writeFile(join(scratchDir, 'Keep.TXT'), 'pinned folders live here');

    const out = [];
    collectFiles(scratchDir, out, [], new Set(['keep.txt']));

    expect(out).toHaveLength(0);
  });

  it('excludes the file from both resolveActionFiles and scan()', async () => {
    await writeFile(join(scratchDir, 'explorer.automaticDestinations-ms'), 'x'.repeat(100));
    await writeFile(join(scratchDir, 'word.automaticDestinations-ms'), 'y'.repeat(50));

    const { files } = resolveActionFiles([scratchDir], {}, ['explorer.automaticDestinations-ms']);
    expect(files.map((f) => f.path.split(/[\\/]/).pop())).toEqual(['word.automaticDestinations-ms']);

    const result = scan({ expandedPaths: [scratchDir], excludeNames: ['explorer.automaticDestinations-ms'] });
    expect(result.fileCount).toBe(1);
    expect(result.sizeBytes).toBe(50);
  });

  it('a rule with no excludeNames still matches everything (unaffected default)', async () => {
    await writeFile(join(scratchDir, 'a.txt'), 'a');
    await writeFile(join(scratchDir, 'b.txt'), 'bb');

    const { files } = resolveActionFiles([scratchDir]);
    expect(files).toHaveLength(2);
  });

  it('execute() never quarantines the excluded file', async () => {
    await mkdir(join(scratchDir, 'AutomaticDestinations'));
    const protectedFile = join(scratchDir, 'AutomaticDestinations', 'explorer.automaticDestinations-ms');
    const otherFile = join(scratchDir, 'AutomaticDestinations', 'word.automaticDestinations-ms');
    await writeFile(protectedFile, 'pins');
    await writeFile(otherFile, 'recent word docs');

    const result = await execute(
      {
        expandedPaths: [join(scratchDir, 'AutomaticDestinations')],
        excludeNames: ['explorer.automaticDestinations-ms']
      },
      'Recent Items & Jump Lists',
      { removal: 'delete' } // hard-delete mode keeps this test filesystem-only, no quarantine dir involved
    );

    expect(result.skipped.some((s) => s.path === protectedFile)).toBe(false);
    const { existsSync } = await import('node:fs');
    expect(existsSync(protectedFile)).toBe(true);
    expect(existsSync(otherFile)).toBe(false);
  });
});
