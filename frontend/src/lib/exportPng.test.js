// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { resolveCssVars, serializeMapSvg } from './exportPng.js';
import { saveBlob } from './download.js';

describe('resolveCssVars', () => {
  const vars = { '--bg-base': '#09090b', '--accent-primary': '#22d3ee' };
  const get = (name) => vars[name];

  it('replaces var(--name) with the live value', () => {
    expect(resolveCssVars('<rect stroke="var(--bg-base)"/>', get)).toBe('<rect stroke="#09090b"/>');
  });

  it('replaces every occurrence, including inside a style attribute', () => {
    const out = resolveCssVars('<g style="fill:var(--accent-primary);stroke:var(--bg-base)"/>', get);
    expect(out).toBe('<g style="fill:#22d3ee;stroke:#09090b"/>');
  });

  it('uses the fallback when the variable is not defined', () => {
    expect(resolveCssVars('fill="var(--nope, #fff)"', get)).toBe('fill="#fff"');
  });

  it('falls back to currentColor rather than leaving an unresolvable var in the image', () => {
    expect(resolveCssVars('fill="var(--nope)"', get)).toBe('fill="currentColor"');
  });

  it('leaves text without variables untouched', () => {
    expect(resolveCssVars('<rect fill="#123456"/>', get)).toBe('<rect fill="#123456"/>');
  });
});

describe('serializeMapSvg', () => {
  const make = () => {
    document.body.innerHTML = '<svg viewBox="0 0 400 200" width="400" height="200"><g><rect fill="red" stroke="var(--bg-base)"/><text x="1" y="2">name</text></g></svg>';
    return document.querySelector('svg');
  };

  it('returns standalone SVG: namespaced, sized, with a solid background and resolved colours', () => {
    const { markup, width, height } = serializeMapSvg(make(), { width: 400, height: 200, background: '#09090b', getVar: () => '#abcdef' });
    expect(width).toBe(400);
    expect(height).toBe(200);
    expect(markup).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(markup).toContain('stroke="#abcdef"');
    expect(markup).not.toContain('var(--');
    expect(markup).toMatch(/<rect[^>]*width="100%"[^>]*fill="#09090b"/);
  });

  it('does not alter the live drawing', () => {
    const svg = make();
    serializeMapSvg(svg, { width: 400, height: 200, background: '#000', getVar: () => '#fff' });
    expect(svg.innerHTML).toContain('var(--bg-base)');
    expect(svg.getAttribute('xmlns')).toBeNull();
  });

  it('gives text a concrete font, since the page stylesheet is not in the image', () => {
    const { markup } = serializeMapSvg(make(), { width: 400, height: 200, background: '#000', getVar: () => '#fff' });
    expect(markup).toMatch(/<text[^>]*font-family=/);
  });
});

describe('saveBlob', () => {
  it('clicks a temporary download link carrying the file name, then cleans up', () => {
    const clicks = [];
    const revoked = [];
    const created = [];
    const doc = {
      createElement: () => {
        const a = { style: {}, click() { clicks.push({ href: a.href, download: a.download }); }, remove() { created.push('removed'); } };
        return a;
      },
      body: { appendChild: () => {} }
    };
    const urlApi = { createObjectURL: () => 'blob:abc', revokeObjectURL: (u) => revoked.push(u) };
    saveBlob(new Blob(['x']), 'prune-C-2026-01-02.csv', { doc, urlApi, defer: (fn) => fn() });
    expect(clicks).toEqual([{ href: 'blob:abc', download: 'prune-C-2026-01-02.csv' }]);
    expect(revoked).toEqual(['blob:abc']);
    expect(created).toEqual(['removed']);
  });
});
