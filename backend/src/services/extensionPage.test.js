import { describe, it, expect } from 'vitest';
import { extensionPageAddress, isChromiumId } from './extensionPage.js';

const ID = 'a'.repeat(32);

describe('isChromiumId', () => {
  it('accepts exactly 32 letters a to p, which is what an extension id is', () => {
    expect(isChromiumId(ID)).toBe(true);
    expect(isChromiumId('abcdefghijklmnopabcdefghijklmnop')).toBe(true);
  });

  it('refuses everything else, including anything that could carry a second address or flag', () => {
    for (const bad of [
      '', 'short', 'a'.repeat(31), 'a'.repeat(33), 'z'.repeat(32), 'A'.repeat(32), `${'a'.repeat(31)}&`,
      `${'a'.repeat(32)}&url=evil`, `${'a'.repeat(32)} --flag`, `${'a'.repeat(31)}/`, '../' + 'a'.repeat(29), null, undefined, 5, {}
    ]) expect(isChromiumId(bad), String(bad)).toBe(false);
  });
});

describe('extensionPageAddress', () => {
  it.each([
    ['Chrome', `chrome://extensions/?id=${ID}`],
    ['Edge', `edge://extensions/?id=${ID}`],
    ['Brave', `brave://extensions/?id=${ID}`],
    ['Vivaldi', `vivaldi://extensions/?id=${ID}`],
    ['Opera', `opera://extensions/?id=${ID}`]
  ])('builds the extension page address for %s', (browser, address) => {
    expect(extensionPageAddress({ browser, extensionId: ID })).toEqual({ ok: true, browser, address });
  });

  it('gives about:addons for the Gecko browsers, whatever the add-on id is', () => {
    for (const browser of ['Firefox', 'LibreWolf', 'Waterfox', 'Zen', 'SeaMonkey']) {
      expect(extensionPageAddress({ browser, extensionId: 'addon@example.org' })).toEqual({ ok: true, browser, address: 'about:addons' });
    }
  });

  it('refuses a browser it does not know, and a Chromium id that is not one', () => {
    expect(extensionPageAddress({ browser: 'Netscape', extensionId: ID }).ok).toBe(false);
    expect(extensionPageAddress({ browser: 'Chrome', extensionId: 'nope' }).ok).toBe(false);
    expect(extensionPageAddress({ browser: 'Chrome', extensionId: `${ID}&x` }).ok).toBe(false);
    expect(extensionPageAddress({ browser: 'toString', extensionId: ID }).ok).toBe(false);
    expect(extensionPageAddress({}).ok).toBe(false);
    expect(extensionPageAddress().ok).toBe(false);
  });

  it('is pure: it names an address and has no executable or arguments in it', () => {
    const result = extensionPageAddress({ browser: 'Chrome', extensionId: ID });
    expect(Object.keys(result).sort()).toEqual(['address', 'browser', 'ok']);
  });
});
