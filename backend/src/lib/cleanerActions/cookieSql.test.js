import { describe, it, expect } from 'vitest';
import { escapeSqlString, buildKeepPredicate, TABLE_DETECT_SQL } from './cookieSql.js';

describe('escapeSqlString', () => {
  it('doubles a single quote, the standard SQLite string-literal escape', () => {
    expect(escapeSqlString("o'brien.com")).toBe("o''brien.com");
  });

  it('leaves a plain domain untouched', () => {
    expect(escapeSqlString('example.com')).toBe('example.com');
  });
});

describe('buildKeepPredicate', () => {
  it('builds an exact-match-or-subdomain OR chain for one domain', () => {
    const sql = buildKeepPredicate(['example.com'], 'host_key');
    expect(sql).toBe("(host_key = 'example.com' OR host_key LIKE '%.example.com')");
  });

  it('builds one OR chain per domain, for multiple domains', () => {
    const sql = buildKeepPredicate(['a.com', 'b.com'], 'host');
    expect(sql).toBe("(host = 'a.com' OR host LIKE '%.a.com' OR host = 'b.com' OR host LIKE '%.b.com')");
  });

  it('escapes a quote inside a domain rather than producing invalid/unsafe SQL', () => {
    const sql = buildKeepPredicate(["o'brien.com"], 'host_key');
    expect(sql).toBe("(host_key = 'o''brien.com' OR host_key LIKE '%.o''brien.com')");
  });

  it('lowercases and strips a leading dot from each domain before building the predicate, matching BleachBit\'s own normalization', () => {
    const sql = buildKeepPredicate(['.Example.COM'], 'host');
    expect(sql).toBe("(host = 'example.com' OR host LIKE '%.example.com')");
  });

  it('throws a clear error for an empty domain list instead of producing invalid SQL', () => {
    expect(() => buildKeepPredicate([], 'host_key')).toThrow(
      'buildKeepPredicate requires at least one domain'
    );
  });
});

describe('TABLE_DETECT_SQL', () => {
  it('is a query that would find either real cookie table by name', () => {
    expect(TABLE_DETECT_SQL).toMatch(/moz_cookies/);
    expect(TABLE_DETECT_SQL).toMatch(/'cookies'/);
  });
});
