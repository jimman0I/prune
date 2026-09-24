import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** The stylesheet foundations the Apple design pass added: the control
 * border token, the forced-colors block, reduced transparency and the
 * scrollbar. Like motionRestraint.test.js this reads the source, because
 * media queries and pseudo-elements are not resolved by jsdom. */

const read = (file) => readFileSync(resolve(process.cwd(), file), 'utf8').split('\r\n').join('\n');
// Comments carry braces and selector-like prose; strip them so the rule
// scanner below only sees real rules.
const css = read('src/index.css').replace(/\/\*[\s\S]*?\*\//g, '');

/** The body of an `@media (query) { ... }` block, brace-balanced. Returns
 * all blocks with that query joined, since a query may appear twice. */
function media(query) {
  const out = [];
  let from = 0;
  for (;;) {
    const at = css.indexOf(`@media (${query}) {`, from);
    if (at < 0) break;
    let depth = 0;
    let i = css.indexOf('{', at);
    const start = i + 1;
    for (; i < css.length; i++) {
      if (css[i] === '{') depth++;
      else if (css[i] === '}' && --depth === 0) break;
    }
    out.push(css.slice(start, i));
    from = i;
  }
  if (!out.length) throw new Error(`no @media (${query}) block`);
  return out.join('\n');
}

/** Declarations of the first rule in `scope` whose selector list contains
 * `selector` (exact, as one entry of a comma list). */
function ruleIn(scope, selector) {
  for (const m of scope.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const sels = m[1].split(',').map((s) => s.trim());
    if (sels.includes(selector)) return m[2];
  }
  throw new Error(`no rule for ${selector}`);
}

const src = (f) => read(f);

describe('--control-border', () => {
  it('is defined for dark and light at the contrast the spec names', () => {
    expect(css).toMatch(/--control-border:\s*rgba\(255,\s*255,\s*255,\s*0\.36\)/);
    expect(css).toMatch(/--control-border:\s*rgba\(28,\s*25,\s*23,\s*0\.5\)/);
    // The light value must live inside the light theme block.
    const light = css.slice(css.indexOf(":root[data-theme='light'] {"));
    expect(light.slice(0, light.indexOf('\n}'))).toMatch(/--control-border/);
  });

  it('draws the unticked Deep Clean box, the Startup tick and the off switch with it', () => {
    expect(src('src/components/DeepCleanTree.jsx')).toMatch(/border-\[color:var\(--control-border\)\]/);
    expect(src('src/components/StartupItems.jsx')).toMatch(/border-\[color:var\(--control-border\)\]/);
    expect(src('src/components/Toggle.jsx')).toMatch(/ring-\[color:var\(--control-border\)\]/);
  });

  it('also draws the shared native checkbox with it', () => {
    expect(ruleIn(css, 'input[type="checkbox"].prune-check')).toMatch(/border:\s*1px solid var\(--control-border\)/);
  });
});

describe('forced colors', () => {
  const fc = () => media('forced-colors: active');

  it('gives the switch a border, a Highlight fill when on, and a ButtonText thumb', () => {
    const scope = fc();
    expect(ruleIn(scope, '[role="switch"]')).toMatch(/border:\s*1px solid ButtonText/);
    const on = ruleIn(scope, '[role="switch"][aria-checked="true"]');
    expect(on).toMatch(/background:\s*Highlight/);
    expect(on).toMatch(/forced-color-adjust:\s*none/);
    expect(ruleIn(scope, '[role="switch"] > span')).toMatch(/background:\s*ButtonText/);
  });

  it('keeps the rail active item, selected tabs and chips visible with an outline', () => {
    const scope = fc();
    expect(ruleIn(scope, 'nav [aria-current="page"]')).toMatch(/outline:\s*2px solid Highlight/);
    expect(ruleIn(scope, '.pill-selected')).toMatch(/outline:\s*2px solid Highlight/);
    expect(ruleIn(scope, '[role="tab"][aria-selected="true"]')).toMatch(/outline:\s*2px solid Highlight/);
    expect(ruleIn(scope, 'button[aria-pressed="true"]')).toMatch(/outline:\s*2px solid Highlight/);
  });

  it('opts the storage bar out of forced colours so the fill survives', () => {
    const scope = fc();
    expect(ruleIn(scope, '.storage-bar')).toMatch(/forced-color-adjust:\s*none/);
    expect(ruleIn(scope, '.storage-bar')).toMatch(/border:\s*1px solid ButtonText/);
    expect(ruleIn(scope, '.storage-bar-fill')).toMatch(/background:\s*Highlight/);
  });

  it('marks the real markup the selectors depend on', () => {
    expect(src('src/components/Dashboard.jsx')).toMatch(/className="[^"]*\bstorage-bar\b/);
    expect(src('src/components/Dashboard.jsx')).toMatch(/className="[^"]*\bstorage-bar-fill\b/);
    expect(src('src/components/SettingsPage.jsx')).toMatch(/pill-selected/);
    expect(src('src/components/ProgramList.jsx')).toMatch(/pill-selected/);
  });
});

describe('keyboard focus', () => {
  it('leaves the global :focus-visible ring on Settings fields instead of switching it off', () => {
    for (const f of ['SettingsPage', 'AutomationSettings', 'CookieKeepListSettings']) {
      expect(src(`src/components/${f}.jsx`), f).not.toMatch(/focus:outline-none/);
    }
  });
});

describe('reduced transparency', () => {
  const rt = () => media('prefers-reduced-transparency: reduce');

  it('drops the blur and uses the solid panel on glass surfaces', () => {
    for (const sel of ['.glass-panel', '.diskmap-tooltip']) {
      const r = ruleIn(rt(), sel);
      expect(r).toMatch(/backdrop-filter:\s*none/);
      expect(r).toMatch(/-webkit-backdrop-filter:\s*none/);
      expect(r).toMatch(/background:\s*var\(--bg-panel\)/);
    }
  });

  it('hides the aurora layers', () => {
    expect(ruleIn(rt(), 'body::before')).toMatch(/display:\s*none/);
    expect(ruleIn(rt(), 'body::after')).toMatch(/display:\s*none/);
  });
});

describe('scrollbar', () => {
  it('has a transparent corner', () => {
    expect(ruleIn(css, '::-webkit-scrollbar-corner')).toMatch(/background:\s*transparent/);
  });

  it('takes the hover thumb from a themed token, with no hard-coded zinc or coral', () => {
    expect(ruleIn(css, '::-webkit-scrollbar-thumb:hover')).toMatch(/var\(--scrollbar-thumb-hover\)/);
    expect(css).toMatch(/--scrollbar-thumb-hover:/);
    expect(css.match(/--scrollbar-thumb-hover:/g).length).toBe(2);
    expect(ruleIn(css, '::-webkit-scrollbar-thumb:hover')).not.toMatch(/#[0-9a-f]{3,8}/i);
    expect(css).not.toMatch(/#e8624f/i);
  });
});
