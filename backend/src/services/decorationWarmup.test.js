import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { warmDecorations } from './decorationWarmup.js';

describe('warmDecorations', () => {
  it('runs the lookups one after another, never together', async () => {
    const order = [];
    const slow = (name) => vi.fn(async () => {
      order.push(`${name}:start`);
      await new Promise((resolve) => setTimeout(resolve, 5));
      order.push(`${name}:end`);
    });
    await warmDecorations({ lookups: [slow('a'), slow('b'), slow('c')] });
    expect(order).toEqual(['a:start', 'a:end', 'b:start', 'b:end', 'c:start', 'c:end']);
  });

  it('carries on after one fails, and never throws', async () => {
    const after = vi.fn(async () => {});
    await expect(warmDecorations({ lookups: [async () => { throw new Error('boom'); }, after] })).resolves.toBeUndefined();
    expect(after).toHaveBeenCalledTimes(1);
  });
});

describe('where it is started', () => {
  const index = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'index.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  it('only from the delayed housekeeping, not when the server starts listening', () => {
    expect(index).toMatch(/name: 'icons and Store apps', run: \(\) => warmDecorations\(\)/);
    // the one call site is inside the housekeeping list
    expect(index.match(/warmDecorations\(/g)).toHaveLength(1);
  });
});
