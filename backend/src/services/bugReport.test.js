import { describe, it, expect, vi } from 'vitest';
import os from 'node:os';
import { appVersion } from './updateCheck.js';
import { bugReportInfo, buildIssueUrl, openBugReport, ISSUE_BASE, MAX_URL } from './bugReport.js';

/** The "Report a bug" link is built here and nowhere else: a prefilled
 * GitHub issue on Prune's own repository, opened in the user's browser.
 * Nothing is sent by Prune itself. */

const parse = (url) => new URL(url).searchParams;

describe('bugReportInfo', () => {
  it('is the version, Windows version and architecture, and nothing else', () => {
    expect(bugReportInfo()).toEqual({
      version: appVersion(),
      windows: `${os.type()} ${os.release()}`,
      arch: os.arch()
    });
  });
});

describe('buildIssueUrl', () => {
  it("always points at the new-issue page of Prune's own repository", () => {
    const url = buildIssueUrl({ title: 'x', description: 'y' });
    expect(url.startsWith('https://github.com/jimman0I/prune/issues/new?')).toBe(true);
    expect(ISSUE_BASE).toBe('https://github.com/jimman0I/prune/issues/new?');
  });

  it('carries the title and the description, with the system footer after it', () => {
    const { version, windows, arch } = bugReportInfo();
    const params = parse(buildIssueUrl({ title: ' Crash on scan ', description: '  It closed.  ' }));
    expect(params.get('title')).toBe('Crash on scan');
    expect(params.get('body')).toBe(`It closed.\n\n---\nPrune ${version} · ${windows} · ${arch}`);
  });

  it('round-trips & # newlines and unicode without them leaking into the URL structure', () => {
    const description = 'a & b # c\nline two\r\nΔοκιμή 日本語 100% ?x=1';
    const url = buildIssueUrl({ title: 'A & B #1', description });
    const params = parse(url);
    expect(params.get('title')).toBe('A & B #1');
    expect(params.get('body').startsWith(description)).toBe(true);
    expect([...params.keys()].sort()).toEqual(['body', 'title']);
    expect(new URL(url).hash).toBe('');
  });

  it('cuts the title to 120 characters', () => {
    const params = parse(buildIssueUrl({ title: 't'.repeat(500), description: 'd' }));
    expect(params.get('title')).toHaveLength(120);
  });

  it('accepts a missing title', () => {
    expect(parse(buildIssueUrl({ description: 'd' })).get('title')).toBe('');
  });

  it('cuts the description to 4000 characters before the footer', () => {
    const body = parse(buildIssueUrl({ title: 't', description: 'd'.repeat(9000) })).get('body');
    const text = body.split('\n\n---\n')[0];
    expect(text.length).toBeLessThanOrEqual(4000);
    expect(text.length).toBeGreaterThan(3000);
  });

  it('keeps the whole URL within 7000 characters even when every character expands', () => {
    // Each "&" becomes %26, three characters: the worst case for a limit
    // that counts the encoded address.
    const url = buildIssueUrl({ title: '&'.repeat(120), description: '&'.repeat(4000) });
    expect(url.length).toBeLessThanOrEqual(MAX_URL);
    const body = parse(url).get('body');
    expect(body).toContain('…');
    expect(body).toMatch(/---\nPrune /); // the footer survives the clamp
  });

  it('rejects an empty or whitespace-only description', () => {
    for (const description of ['', '   \n\t ', undefined, null, 5, {}]) {
      expect(() => buildIssueUrl({ title: 't', description })).toThrow(/describe/i);
    }
  });

  it('rejects input that is not an object with string fields', () => {
    expect(() => buildIssueUrl()).toThrow();
    expect(() => buildIssueUrl(null)).toThrow();
    expect(() => buildIssueUrl({ title: 5, description: 'd' })).toThrow(/title/i);
  });
});

describe('openBugReport', () => {
  it('hands the built URL to the opener and reports it', async () => {
    const opener = vi.fn((file, args, cb) => cb(null));
    const result = await openBugReport({ title: 't', description: 'd' }, opener);

    expect(opener).toHaveBeenCalledTimes(1);
    const [file, args] = opener.mock.calls[0];
    expect(file).toBe('explorer.exe');
    expect(args[0]).toBe(buildIssueUrl({ title: 't', description: 'd' }));
    expect(result).toMatchObject({ ok: true, opened: args[0] });
  });

  it("counts explorer.exe's non-zero exit as success, like the release page does", async () => {
    const opener = (file, args, cb) => cb(Object.assign(new Error('exit 1'), { code: 1 }));
    expect(await openBugReport({ description: 'd' }, opener)).toMatchObject({ ok: true });
  });

  it('never opens anything for invalid input', async () => {
    const opener = vi.fn();
    await expect(openBugReport({ title: 't', description: '  ' }, opener)).rejects.toThrow();
    expect(opener).not.toHaveBeenCalled();
  });
});
