import { describe, it, expect } from 'vitest';
import {
  DEFAULT_JUNK_PATTERNS, PRESELECTED_PATTERNS, NEVER_EXTENSIONS, MAX_PATTERNS,
  validateJunkPattern, normalizeJunkPatterns, compileJunkPatterns, matchJunkName,
  fileNameRefusal, globToRegExp, isPreselected, defaultJunkPatterns
} from './junkPatterns.js';

const reason = (p) => validateJunkPattern(p).reason;

describe('validateJunkPattern', () => {
  it('accepts ordinary wildcard names, trimmed', () => {
    expect(validateJunkPattern('  *.tmp ')).toEqual({ ok: true, pattern: '*.tmp' });
    for (const p of ['~*.*', '*.~*', 'thumbs.db', 'file????.chk', '*.dmp', 'cache_*', 'a*b?.c']) {
      expect(validateJunkPattern(p).ok, p).toBe(true);
    }
  });

  it('refuses nothing, and over-long input', () => {
    expect(reason('')).toBe('empty');
    expect(reason('   ')).toBe('empty');
    expect(reason(null)).toBe('empty');
    expect(reason(42)).toBe('empty');
    expect(reason(`${'a'.repeat(70)}.tmp`)).toBe('long');
  });

  it('refuses patterns that would match every file', () => {
    for (const p of ['*', '*.*', '**', '?*', '*?*', '*.', '.*', '*.???', '?.?', '* .*']) {
      expect(reason(p), p).toBe('everything');
    }
  });

  it('refuses folders, drives and paths: a pattern is a file name', () => {
    for (const p of ['C:\\*.tmp', 'temp\\*.tmp', 'a/b.tmp', 'C:', '..\\x']) expect(reason(p), p).toBe('separator');
  });

  it('refuses characters no Windows file name can hold', () => {
    for (const p of ['a<b.tmp', 'a>b', 'x"y', 'a|b', 'tab\there']) expect(reason(p), p).toBe('invalid');
  });

  it('refuses programs, libraries, drivers and installers, in any case and spelling', () => {
    for (const p of ['*.exe', '*.DLL', '*.sys', '*.msi', 'setup.exe', '*.ex?', '*.d*', '*.ms*', '*.e?e', 'x.Scr', '*.cat']) {
      expect(reason(p), p).toBe('executable');
    }
  });

  it('does not refuse a "any extension" pattern for what it could reach -- the scan drops those files by name', () => {
    expect(validateJunkPattern('~*.*').ok).toBe(true);
    expect(validateJunkPattern('setup*').ok).toBe(true);
  });

  it('refuses anything that would match desktop.ini, which gives a folder its icon and name', () => {
    for (const p of ['desktop.ini', 'DESKTOP.INI', '*.ini', 'desk*', 'd*.ini', 'desktop.*']) {
      expect(reason(p), p).toBe('desktopIni');
    }
  });
});

describe('glob semantics', () => {
  const matches = (pattern, name) => globToRegExp(pattern).test(name);

  it('* is any run of characters, ? exactly one', () => {
    expect(matches('*.tmp', 'a.tmp')).toBe(true);
    expect(matches('*.tmp', '.tmp')).toBe(true);
    expect(matches('*.tmp', 'a.b.tmp')).toBe(true);
    expect(matches('*.tmp', 'a.tmp.txt')).toBe(false);
    expect(matches('file?.chk', 'file1.chk')).toBe(true);
    expect(matches('file?.chk', 'file.chk')).toBe(false);
    expect(matches('file?.chk', 'file12.chk')).toBe(false);
  });

  it('is case-insensitive, as Windows is', () => {
    expect(matches('*.tmp', 'SETUP.TMP')).toBe(true);
    expect(matches('Thumbs.db', 'thumbs.DB')).toBe(true);
    expect(matches('*.temp', 'ÄRGER.TEMP')).toBe(true);
  });

  it('treats a trailing .* the way dir does: an extension or none', () => {
    expect(matches('~*.*', '~$report.docx')).toBe(true);
    expect(matches('~*.*', '~lock')).toBe(true);
    expect(matches('~*.*', 'report~.docx')).toBe(false);
    expect(matches('notes.*', 'notes')).toBe(true);
    expect(matches('notes.*', 'notes.txt')).toBe(true);
    expect(matches('notes.*', 'notesx')).toBe(false);
  });

  it('gives no special meaning to anything else', () => {
    expect(matches('[a].tmp', '[a].tmp')).toBe(true);
    expect(matches('[a].tmp', 'a.tmp')).toBe(false);
    expect(matches('a+b.tmp', 'a+b.tmp')).toBe(true);
    expect(matches('a+b.tmp', 'aab.tmp')).toBe(false);
    expect(matches('*.~*', 'unit1.~pas')).toBe(true);
    expect(matches('*.~*', 'unit1.pas')).toBe(false);
  });
});

describe('the defaults', () => {
  it('are all valid, distinct patterns', () => {
    expect(normalizeJunkPatterns(DEFAULT_JUNK_PATTERNS)).toEqual(DEFAULT_JUNK_PATTERNS.map((p) => ({ ...p })));
  });

  it('list .bak and .log but leave them off', () => {
    const byName = Object.fromEntries(DEFAULT_JUNK_PATTERNS.map((p) => [p.pattern, p.enabled]));
    expect(byName['*.bak']).toBe(false);
    expect(byName['*.log']).toBe(false);
    for (const on of ['*.tmp', '*.temp', '~*.*', '*.~*', '*.chk', '*.old', '*.gid', '*.dmp', 'thumbs.db']) expect(byName[on], on).toBe(true);
  });

  it('never include desktop.ini, and could never be made to', () => {
    expect(DEFAULT_JUNK_PATTERNS.some((p) => p.pattern.toLowerCase() === 'desktop.ini')).toBe(false);
    expect(normalizeJunkPatterns([{ pattern: 'desktop.ini', enabled: true }])).toEqual([]);
  });

  it('pre-tick only scratch files and caches that rebuild themselves', () => {
    expect([...PRESELECTED_PATTERNS].sort()).toEqual(['*.gid', '*.temp', '*.tmp', 'thumbs.db']);
    for (const p of ['*.old', '*.bak', '*.dmp', '*.chk', '~*.*', '*.~*', '*.log', '*.docx']) expect(isPreselected(p), p).toBe(false);
    expect(isPreselected('*.TMP')).toBe(true);
  });

  it('are handed out as a copy that can be edited without changing them', () => {
    const copy = defaultJunkPatterns();
    copy[0].enabled = false;
    expect(DEFAULT_JUNK_PATTERNS[0].enabled).toBe(true);
  });
});

describe('normalizeJunkPatterns', () => {
  it('reads anything that is not a list as the defaults', () => {
    for (const value of [undefined, null, 'x', 3, { pattern: '*.tmp' }]) {
      expect(normalizeJunkPatterns(value)).toEqual(defaultJunkPatterns());
    }
  });

  it('keeps an empty list empty: removing every pattern is a choice', () => {
    expect(normalizeJunkPatterns([])).toEqual([]);
  });

  it('drops refused and malformed entries, de-duplicates ignoring case, and reads a string as enabled', () => {
    const out = normalizeJunkPatterns([
      '*.tmp', { pattern: '*.TMP', enabled: false }, { pattern: '*.exe' }, { pattern: '*' }, 7, null,
      { pattern: '*.old', enabled: false }, { pattern: ' *.dmp ' }, { nope: 1 }
    ]);
    expect(out).toEqual([
      { pattern: '*.tmp', enabled: true },
      { pattern: '*.old', enabled: false },
      { pattern: '*.dmp', enabled: true }
    ]);
  });

  it('is capped', () => {
    const many = Array.from({ length: MAX_PATTERNS + 20 }, (_, i) => `*.x${i}`);
    expect(normalizeJunkPatterns(many)).toHaveLength(MAX_PATTERNS);
  });
});

describe('matching a file', () => {
  const compiled = compileJunkPatterns(defaultJunkPatterns());
  const match = (name, where) => matchJunkName(name, compiled, where)?.pattern ?? null;

  it('only looks for patterns that are turned on', () => {
    expect(match('old.bak')).toBeNull();
    expect(match('app.log')).toBeNull();
    const withBak = compileJunkPatterns([{ pattern: '*.bak', enabled: true }]);
    expect(matchJunkName('old.bak', withBak)?.pattern).toBe('*.bak');
  });

  it('files a name under the FIRST pattern in the list that matches it', () => {
    // ~WRL0001.tmp is both a tilde file and a .tmp: it is shown as .tmp.
    expect(match('~WRL0001.tmp')).toBe('*.tmp');
    expect(match('~$report.docx')).toBe('~*.*');
    expect(match('Thumbs.db')).toBe('thumbs.db');
    expect(match('readme.txt')).toBeNull();
  });

  it('takes *.chk to mean Check Disk fragments in FOUND.### at a drive root, and nothing else', () => {
    expect(match('FILE0000.CHK', { parentName: 'FOUND.000', parentIsDriveChild: true })).toBe('*.chk');
    expect(match('file0123.chk', { parentName: 'found.012', parentIsDriveChild: true })).toBe('*.chk');
    // Somewhere else, or a name Check Disk does not write: an application's own .chk.
    expect(match('FILE0000.CHK', { parentName: 'FOUND.000', parentIsDriveChild: false })).toBeNull();
    expect(match('FILE0000.CHK', { parentName: 'Saves', parentIsDriveChild: true })).toBeNull();
    expect(match('game.chk', { parentName: 'FOUND.000', parentIsDriveChild: true })).toBeNull();
  });

  it('marks which matches start ticked', () => {
    expect(matchJunkName('a.tmp', compiled).preselected).toBe(true);
    expect(matchJunkName('a.old', compiled).preselected).toBe(false);
  });
});

describe('fileNameRefusal', () => {
  it('never offers a program, library or driver, or desktop.ini, whatever matched it', () => {
    for (const ext of NEVER_EXTENSIONS) expect(fileNameRefusal(`~setup.${ext}`), ext).toBe('executable');
    expect(fileNameRefusal('~SETUP.EXE')).toBe('executable');
    expect(fileNameRefusal('Desktop.ini')).toBe('desktopIni');
    expect(fileNameRefusal('~$report.docx')).toBeNull();
    expect(fileNameRefusal('setup.exe.tmp')).toBeNull();
  });
});
