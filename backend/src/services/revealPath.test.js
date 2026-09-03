import { describe, it, expect } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveReveal } from './revealPath.js';

// resolveReveal, not revealPath: the decision is what is worth testing,
// and calling the real thing would open an Explorer window on whoever
// runs the suite.

describe('resolveReveal', () => {
  it('refuses a path that is not there', async () => {
    // Explorer given a missing path opens Documents instead, which looks
    // like the button did something random rather than that the folder is
    // gone.
    const result = resolveReveal('C:\\definitely\\not\\here\\at\\all');
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/no longer on disk/i);
  });

  it('refuses nothing at all', async () => {
    expect(resolveReveal('').ok).toBe(false);
    expect(resolveReveal('   ').ok).toBe(false);
    expect(resolveReveal(null).ok).toBe(false);
  });

  it('opens a real directory', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'prune-reveal-'));
    try {
      const result = resolveReveal(dir);
      expect(result.ok).toBe(true);
      expect(result.selected).toBe(false);
      expect(result.args).toEqual([dir]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('selects a file rather than opening it', async () => {
    // "Show me this" for a file means its folder with the file picked
    // out, not launching whatever it is.
    const dir = await mkdtemp(join(tmpdir(), 'prune-reveal-'));
    const file = join(dir, 'thing.txt');
    await writeFile(file, 'x');
    try {
      const result = resolveReveal(file);
      expect(result.ok).toBe(true);
      expect(result.selected).toBe(true);
      expect(result.args).toEqual(['/select,', file]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('strips the quotes a registry value tends to carry', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'prune-reveal-'));
    try {
      expect(resolveReveal(`"${dir}"`).ok).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
