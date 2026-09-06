import { describe, it, expect } from 'vitest';
import { needsWarning, warningFor, rememberedWith } from './cleanWarning.js';

/** When ticking a Deep Clean rule has to stop and ask.
 *
 * Sixteen of the seventy-four rules are marked risky -- browsing history,
 * cookies, open tabs, autofill, per-site storage across three browsers,
 * and the Recycle Bin. None of them is unrecoverable (Clean moves
 * everything to Quarantine first), but "signs you out of every site that
 * remembered you" is not a surprise a cleaning tool should spring on
 * anyone who ticked a box.
 */

const item = (over = {}) => ({
  id: 'brave_cookies',
  category: 'Brave',
  name: 'Cookies',
  description: 'Signs you out of every site that remembered you.',
  risky: true,
  ...over
});

describe('needsWarning', () => {
  it('asks before a risky rule is turned ON', () => {
    expect(needsWarning(item(), { checking: true, acknowledged: [] })).toBe(true);
  });

  it('never asks when a rule is being turned OFF', () => {
    // Unticking cannot lose anything. A dialog there would be a dialog
    // in front of the safe direction, which teaches people to click
    // through the one in front of the unsafe direction.
    expect(needsWarning(item(), { checking: false, acknowledged: [] })).toBe(false);
  });

  it('does not ask about an ordinary rule', () => {
    expect(needsWarning(item({ risky: false, id: 'brave_cache' }), { checking: true, acknowledged: [] })).toBe(false);
    expect(needsWarning(item({ risky: undefined }), { checking: true, acknowledged: [] })).toBe(false);
  });

  it('stops asking once this rule has been remembered', () => {
    expect(needsWarning(item(), { checking: true, acknowledged: ['brave_cookies'] })).toBe(false);
  });

  it('remembers one rule, not the whole category', () => {
    // "Remember my choice for Brave - Cookies" says Cookies. Agreeing to
    // lose cookies is not agreeing to lose browsing history, and a
    // category-wide memory would make it so.
    expect(needsWarning(item({ id: 'brave_history', name: 'Browsing history' }), {
      checking: true, acknowledged: ['brave_cookies']
    })).toBe(true);
  });

  it('asks again when the remembered list is missing or malformed', () => {
    // Erring toward asking. A settings file that lost the list, or has
    // something that is not an array in it, must not read as blanket
    // consent to every warning in the app.
    for (const acknowledged of [undefined, null, 'brave_cookies', 42, {}]) {
      expect(needsWarning(item(), { checking: true, acknowledged }), JSON.stringify(acknowledged)).toBe(true);
    }
  });

  it('survives being handed no rule at all', () => {
    expect(needsWarning(undefined, { checking: true, acknowledged: [] })).toBe(false);
  });
});

describe('warningFor', () => {
  it('names the category and the rule, the way the row does', () => {
    // The row says "Cookies" under a "Brave" heading. A dialog that said
    // only "Cookies" would not say whose.
    expect(warningFor(item())).toEqual({
      id: 'brave_cookies',
      title: 'Enable Brave — Cookies',
      remember: 'Remember my choice for Brave — Cookies',
      body: 'Signs you out of every site that remembered you.'
    });
  });

  it('falls back to a general sentence when a rule carries no description', () => {
    // Every rule in the shipped set has one, but a dialog whose body is
    // empty would be a dialog that warns about nothing.
    expect(warningFor(item({ description: undefined })).body)
      .toBe('This option removes data you may want to keep.');
  });

  it('copes with a rule that has no category', () => {
    expect(warningFor(item({ category: undefined })).title).toBe('Enable Cookies');
  });
});

describe('rememberedWith', () => {
  it('adds the rule when the box was ticked', () => {
    expect(rememberedWith(['a'], 'brave_cookies', true)).toEqual(['a', 'brave_cookies']);
  });

  it('changes nothing when it was not', () => {
    expect(rememberedWith(['a'], 'brave_cookies', false)).toBeNull();
  });

  it('does not add the same rule twice', () => {
    // The list is written straight to settings, and a duplicate would
    // grow it every time somebody re-ticked the same box.
    expect(rememberedWith(['brave_cookies'], 'brave_cookies', true)).toBeNull();
  });

  it('starts a list when there is not one yet', () => {
    expect(rememberedWith(undefined, 'brave_cookies', true)).toEqual(['brave_cookies']);
    expect(rememberedWith('nonsense', 'brave_cookies', true)).toEqual(['brave_cookies']);
  });
});
