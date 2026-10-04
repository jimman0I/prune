import { describe, it, expect } from 'vitest';
import { WHATS_NEW, majorMinor, entryFor, shouldShowWhatsNew } from './whatsNew.js';
import { SCREEN_ORDER } from './screenOrder.js';
import { CATALOG } from '../i18n/catalog.js';

const entries = { '3.0': { namespace: 'x', cards: [{ id: 'a', icon: 'rail' }] }, '3.2': { namespace: 'y', cards: [] } };

describe('majorMinor', () => {
  it('files a version under major.minor and rejects what is not one', () => {
    expect(majorMinor('3.0.0')).toBe('3.0');
    expect(majorMinor('3.0.1')).toBe('3.0');
    expect(majorMinor('3.10.0-beta.2')).toBe('3.10');
    for (const junk of ['dev', '', '3', '3.0', 'v3.0.0', null, undefined, 3, {}]) expect(majorMinor(junk), String(junk)).toBeNull();
  });
});

describe('entryFor', () => {
  it('finds the entry for the running major.minor only', () => {
    expect(entryFor('3.0.4', entries)).toBe(entries['3.0']);
    expect(entryFor('3.1.0', entries)).toBeNull();
    expect(entryFor('dev', entries)).toBeNull();
    expect(entryFor('toString', entries)).toBeNull();
  });
});

describe('shouldShowWhatsNew', () => {
  const cases = [
    // [name, current, lastSeen, expected]
    ['fresh install (the backend stamps the running version)', '3.0.0', '3.0.0', false],
    ['update from a build that never recorded a version', '3.0.0', null, true],
    ['update from 2.9', '3.0.0', '2.9.2', true],
    ['update from 2.9 to a patch of 3.0', '3.0.1', '2.9.2', true],
    ['the same version again', '3.0.0', '3.0.0', false],
    ['patch-only bump 3.0.0 -> 3.0.1', '3.0.1', '3.0.0', false],
    ['patch-only bump after a later patch', '3.0.2', '3.0.1', false],
    ['no entry for this version', '3.1.0', '3.0.0', false],
    ['no entry, nothing recorded', '3.1.0', null, false],
    ['a newer feature release that has an entry', '3.2.0', '3.0.4', true],
    ['skipped a release but the newest has an entry', '3.2.0', '2.8.0', true],
    ['a downgrade shows nothing', '3.0.0', '3.2.0', false],
    ['next major', '4.0.0', '3.2.0', false],
    ['an unreadable recorded value counts as never recorded', '3.0.0', 'garbage', true],
    ['an unbuilt (dev) version', 'dev', null, false],
    ['settings did not say (not loaded, or no such field)', '3.0.0', undefined, false]
  ];
  for (const [name, current, lastSeen, expected] of cases) {
    it(`${expected ? 'shows' : 'hides'}: ${name}`, () => {
      expect(shouldShowWhatsNew({ current, lastSeen, entries })).toBe(expected);
    });
  }

  it('uses the real entries by default', () => {
    expect(shouldShowWhatsNew({ current: '3.0.0', lastSeen: '2.9.2' })).toBe(true);
    expect(shouldShowWhatsNew({ current: '3.0.0', lastSeen: '3.0.0' })).toBe(false);
  });
});

describe('the 3.0 entry', () => {
  const entry = WHATS_NEW['3.0'];
  const en = CATALOG.en[entry.namespace];

  it('has six or seven cards with unique ids', () => {
    expect(entry.cards.length).toBeGreaterThanOrEqual(6);
    expect(entry.cards.length).toBeLessThanOrEqual(7);
    expect(new Set(entry.cards.map((c) => c.id)).size).toBe(entry.cards.length);
  });

  it('has a title and a one-sentence description for every card, in every language', () => {
    for (const code of Object.keys(CATALOG)) {
      for (const card of entry.cards) {
        const text = CATALOG[code][entry.namespace]?.cards?.[card.id];
        expect(text?.title, `${code} ${card.id} title`).toBeTruthy();
        expect(text?.description, `${code} ${card.id} description`).toBeTruthy();
      }
    }
    expect(Object.keys(en.cards).sort()).toEqual(entry.cards.map((c) => c.id).sort());
  });

  it('only sends "Show me" to screens and Settings tabs that exist', () => {
    const tabs = ['general', 'uninstall', 'cleanup', 'about'];
    for (const card of entry.cards) {
      if (!card.target) continue;
      expect(SCREEN_ORDER, card.id).toContain(card.target.screen);
      if (card.target.settingsTab) {
        expect(card.target.screen).toBe('settings');
        expect(tabs).toContain(card.target.settingsTab);
      }
    }
  });
});
