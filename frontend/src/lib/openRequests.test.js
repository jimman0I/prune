// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { normalizeOpenRequest, onOpenRequest, programFileFromDrop } from './openRequests.js';

/** What File Explorer's right-click entries and a dropped file ask of the page.
 * The main process has already read the command line strictly; the page checks
 * again what reaches it, because the bridge is the one place a request enters
 * the renderer, and a request here only ever SHOWS a dialog. */

afterEach(() => { delete window.pruneWindow; });

describe('normalizeOpenRequest', () => {
  it('accepts the two kinds with an absolute drive path, as a new plain object', () => {
    const shred = normalizeOpenRequest({ kind: 'shred', path: 'C:\\Users\\me\\old.docx', extra: 'x' });
    expect(shred).toEqual({ kind: 'shred', path: 'C:\\Users\\me\\old.docx' });
    expect(normalizeOpenRequest({ kind: 'find-program', path: 'D:\\Games\\a.exe' })).toEqual({ kind: 'find-program', path: 'D:\\Games\\a.exe' });
  });

  it('refuses anything else', () => {
    for (const bad of [
      null, undefined, 'shred', 42, [], {}, { kind: 'shred' }, { path: 'C:\\a' }, { kind: 'delete', path: 'C:\\a' },
      { kind: 'shred', path: 'relative\\a' }, { kind: 'shred', path: '\\\\server\\share\\a' }, { kind: 'shred', path: 'C:\\a\nb' },
      { kind: 'shred', path: 'C:\\a\\..\\b' }, { kind: 'shred', path: `C:\\${'x'.repeat(5000)}` }, { kind: 'shred', path: 42 },
      { kind: 'SHRED', path: 'C:\\a' }, { kind: 'shred ', path: 'C:\\a' }
    ]) {
      expect(normalizeOpenRequest(bad), JSON.stringify(bad)).toBeNull();
    }
  });
});

describe('onOpenRequest', () => {
  it('listens through the bridge, passes only requests that check out, and stops when asked', () => {
    let listener;
    const stop = vi.fn();
    window.pruneWindow = { onOpenRequest: vi.fn((cb) => { listener = cb; return stop; }) };
    const seen = [];
    const unsubscribe = onOpenRequest((request) => seen.push(request));
    listener({ kind: 'shred', path: 'C:\\a.txt', other: 1 });
    listener({ kind: 'shred', path: 'nope' });
    listener(null);
    expect(seen).toEqual([{ kind: 'shred', path: 'C:\\a.txt' }]);
    unsubscribe();
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('is a quiet no-op in a browser or a test without the desktop bridge', () => {
    const unsubscribe = onOpenRequest(() => { throw new Error('should not be called'); });
    expect(typeof unsubscribe).toBe('function');
    expect(() => unsubscribe()).not.toThrow();
    window.pruneWindow = {};
    expect(() => onOpenRequest(() => {})()).not.toThrow();
  });
});

describe('programFileFromDrop', () => {
  const file = (name) => ({ name });
  const bridgeFor = (map) => ({ pathForFile: (f) => map[f.name] ?? '' });

  it('takes the real path of a dropped program or shortcut, in any case', () => {
    window.pruneWindow = bridgeFor({ 'a.exe': 'C:\\p\\a.exe', 'B.LNK': 'C:\\Users\\me\\Desktop\\B.LNK' });
    expect(programFileFromDrop([file('a.exe')])).toEqual({ path: 'C:\\p\\a.exe' });
    expect(programFileFromDrop([file('B.LNK')])).toEqual({ path: 'C:\\Users\\me\\Desktop\\B.LNK' });
  });

  it('uses the first file when several are dropped', () => {
    window.pruneWindow = bridgeFor({ 'a.exe': 'C:\\a.exe', 'b.exe': 'C:\\b.exe' });
    expect(programFileFromDrop([file('a.exe'), file('b.exe')])).toEqual({ path: 'C:\\a.exe' });
  });

  it('says notProgram for anything that is not a program or a shortcut, and reads no path for it', () => {
    const pathForFile = vi.fn(() => 'C:\\x');
    window.pruneWindow = { pathForFile };
    for (const name of ['notes.txt', 'setup.msi', 'folder', 'x.exe.txt', '']) {
      expect(programFileFromDrop([file(name)]), name).toEqual({ error: 'notProgram' });
    }
    expect(pathForFile).not.toHaveBeenCalled();
  });

  it('says unreadable when the real path cannot be read (no bridge, or a path that is not usable)', () => {
    expect(programFileFromDrop([file('a.exe')])).toEqual({ error: 'unreadable' });
    window.pruneWindow = bridgeFor({ 'a.exe': '' });
    expect(programFileFromDrop([file('a.exe')])).toEqual({ error: 'unreadable' });
    window.pruneWindow = bridgeFor({ 'a.exe': 'relative\\a.exe' });
    expect(programFileFromDrop([file('a.exe')])).toEqual({ error: 'unreadable' });
  });

  it('says nothing was dropped when there are no files', () => {
    expect(programFileFromDrop([])).toEqual({ error: 'unreadable' });
    expect(programFileFromDrop(undefined)).toEqual({ error: 'unreadable' });
  });
});
