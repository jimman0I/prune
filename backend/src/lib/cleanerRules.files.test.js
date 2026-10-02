import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scanRule, scanRuleAsync } from './cleanerRules.js';

/** A scanned rule carries the biggest files it would take -- the per-file
 * preview -- and says whether it lists files at all, so the screen can offer
 * an expander only where there is something to expand. */

let dir;
beforeEach(async () => { dir = await mkdtemp(join(tmpdir(), 'prune-rulefiles-')); });
afterEach(async () => { await rm(dir, { recursive: true, force: true }); });

describe('scanRule', () => {
  it('lists the files of a delete rule, with the totals', async () => {
    await writeFile(join(dir, 'a.tmp'), 'x'.repeat(5));
    await writeFile(join(dir, 'b.tmp'), 'x'.repeat(50));
    const result = scanRule({ id: 'r', paths: [dir] }, {});
    expect(result.fileCount).toBe(2);
    expect(result.filesListed).toBe(true);
    expect(result.files).toEqual([
      { path: join(dir, 'b.tmp'), sizeBytes: 50 },
      { path: join(dir, 'a.tmp'), sizeBytes: 5 }
    ]);
  });

  it('merges the lists of several delete actions, capped and biggest first', async () => {
    await mkdir(join(dir, 'one'));
    await mkdir(join(dir, 'two'));
    await writeFile(join(dir, 'one', 'a'), 'x'.repeat(10));
    await writeFile(join(dir, 'two', 'b'), 'x'.repeat(30));
    const result = scanRule({
      id: 'r', actions: [{ type: 'delete', paths: [join(dir, 'one')] }, { type: 'delete', paths: [join(dir, 'two')] }]
    }, {});
    expect(result.files.map((f) => f.sizeBytes)).toEqual([30, 10]);
    expect(result.fileCount).toBe(2);
  });

  it('does not list files for a rule that has none to list (a command)', () => {
    const result = scanRule({ id: 'r', command: 'ipconfig /flushdns' }, {});
    expect(result.filesListed).toBeUndefined();
    expect(result.files).toBeUndefined();
  });

  it('a delete rule with nothing present lists an empty set', () => {
    const result = scanRule({ id: 'r', paths: [join(dir, 'missing')] }, {});
    expect(result.filesListed).toBe(true);
    expect(result.files).toEqual([]);
  });

  it('lists only what the guards let through', async () => {
    await mkdir(join(dir, 'keep'));
    await writeFile(join(dir, 'keep', 'k'), 'x'.repeat(99));
    await writeFile(join(dir, 'g'), 'x'.repeat(3));
    const result = scanRule({ id: 'r', paths: [dir] }, { excludeFolders: [join(dir, 'keep')] });
    expect(result.files.map((f) => f.path)).toEqual([join(dir, 'g')]);
  });
});

describe('scanRuleAsync with a profile-wide search', () => {
  it('lists the matches too', async () => {
    await mkdir(join(dir, 'deep'));
    await writeFile(join(dir, 'deep', 'notes.bak'), 'x'.repeat(20));
    await writeFile(join(dir, 'notes.txt'), 'x');
    const result = await scanRuleAsync({
      id: 'r', actions: [{ type: 'deepscan', root: dir, patterns: ['\\.bak$'] }]
    }, {});
    expect(result.fileCount).toBe(1);
    expect(result.filesListed).toBe(true);
    expect(result.files).toEqual([{ path: join(dir, 'deep', 'notes.bak'), sizeBytes: 20 }]);
  });
});
