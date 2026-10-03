import { describe, it, expect, vi } from 'vitest';
import { batchDirsOfResults, batchDirOfManifest, isGoneError, restoreBatches } from './undoQuarantine.js';

describe('batchDirsOfResults', () => {
  it('collects the Quarantine batch of each rule that made one, once', () => {
    const results = [
      { id: 'a', quarantineBatch: 'C:\\q\\1-a' },
      { id: 'b', freedBytes: 5 },
      { id: 'c', quarantineBatch: 'C:\\q\\2-c' },
      { id: 'd', quarantineBatch: 'C:\\q\\1-a' },
      { id: 'e', recycled: true }
    ];
    expect(batchDirsOfResults(results)).toEqual(['C:\\q\\1-a', 'C:\\q\\2-c']);
  });

  it('is empty for nothing, or for something that is not a list', () => {
    expect(batchDirsOfResults([])).toEqual([]);
    expect(batchDirsOfResults(null)).toEqual([]);
    expect(batchDirsOfResults({ results: [] })).toEqual([]);
  });

  it('ignores a batch that is not a path', () => {
    expect(batchDirsOfResults([{ quarantineBatch: '' }, { quarantineBatch: 7 }, { quarantineBatch: null }])).toEqual([]);
  });
});

describe('batchDirOfManifest', () => {
  const manifest = (extra) => ({ destination: 'quarantine', batchDir: 'C:\\q\\1-thing', files: [{ originalPath: 'x' }], registryKeys: [], ...extra });

  it('is the batch of a removal that went to Quarantine', () => {
    expect(batchDirOfManifest(manifest())).toEqual(['C:\\q\\1-thing']);
  });

  it('counts a batch that holds only registry keys', () => {
    expect(batchDirOfManifest(manifest({ files: [], registryKeys: ['HKCU\\Software\\Thing'] }))).toEqual(['C:\\q\\1-thing']);
  });

  it('is nothing when the files were recycled or deleted: there is no Quarantine batch to bring back', () => {
    expect(batchDirOfManifest(manifest({ destination: 'recycle' }))).toEqual([]);
    expect(batchDirOfManifest(manifest({ destination: 'permanent' }))).toEqual([]);
  });

  it('is nothing when nothing was actually moved', () => {
    expect(batchDirOfManifest(manifest({ files: [], registryKeys: [] }))).toEqual([]);
  });

  it('is nothing when there is no batch to name, or no manifest', () => {
    expect(batchDirOfManifest(manifest({ batchDir: undefined }))).toEqual([]);
    expect(batchDirOfManifest(null)).toEqual([]);
  });
});

describe('isGoneError', () => {
  it.each([
    "ENOENT: no such file or directory, open 'C:\\q\\1-a\\manifest.json'",
    'No quarantine batch found at "1-a".',
    'no such file or directory'
  ])('recognises %s', (message) => expect(isGoneError(new Error(message))).toBe(true));

  it.each(['EPERM: operation not permitted', 'Request failed: 500', 'The file is in use'])('does not mistake %s', (message) => {
    expect(isGoneError(new Error(message))).toBe(false);
  });
});

describe('restoreBatches', () => {
  it('restores each batch, in order, and counts them', async () => {
    const restore = vi.fn(async () => ({}));
    const out = await restoreBatches(['a', 'b'], restore);
    expect(restore.mock.calls.map((c) => c[0])).toEqual(['a', 'b']);
    expect(out).toEqual({ restored: ['a', 'b'], gone: [], failed: [] });
  });

  it('says which were already gone, and keeps going', async () => {
    const restore = vi.fn(async (dir) => {
      if (dir === 'a') throw new Error("ENOENT: no such file or directory, open 'manifest.json'");
      return {};
    });
    const out = await restoreBatches(['a', 'b'], restore);
    expect(out).toEqual({ restored: ['b'], gone: ['a'], failed: [] });
  });

  it('says which failed for another reason, with the reason, and keeps going', async () => {
    const restore = vi.fn(async (dir) => {
      if (dir === 'a') throw new Error('EPERM: operation not permitted');
      return {};
    });
    const out = await restoreBatches(['a', 'b'], restore);
    expect(out.restored).toEqual(['b']);
    expect(out.failed).toEqual([{ dir: 'a', error: 'EPERM: operation not permitted' }]);
  });

  it('does nothing for nothing', async () => {
    const restore = vi.fn();
    expect(await restoreBatches([], restore)).toEqual({ restored: [], gone: [], failed: [] });
    expect(restore).not.toHaveBeenCalled();
  });
});
