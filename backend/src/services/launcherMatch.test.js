import { describe, it, expect } from 'vitest';
import { matchLauncherApp } from './launcherMatch.js';

const apps = [
  { displayName: 'Fortnite', installLocation: 'C:\\Program Files\\Epic Games\\Fortnite', sizeBytes: 32212254720 },
  { name: 'The Witcher 3: Wild Hunt', installLocation: 'D:\\GOG Games\\The Witcher 3 Wild Hunt' }
];

describe('matchLauncherApp', () => {
  // The strongest signal: two records naming the same folder are the same
  // installation, whatever they call it.
  it('matches on install location', () => {
    const match = matchLauncherApp(
      { name: 'Anything At All', installLocation: 'C:\\Program Files\\Epic Games\\Fortnite' },
      apps
    );
    expect(match.sizeBytes).toBe(32212254720);
  });

  it('matches a location recorded with the other separator style', () => {
    const match = matchLauncherApp(
      { name: 'x', installLocation: 'C:/Program Files/Epic Games/Fortnite/' },
      apps
    );
    expect(match).toBeTruthy();
  });

  it('matches on name when there is no location', () => {
    expect(matchLauncherApp({ name: 'Fortnite' }, apps).sizeBytes).toBe(32212254720);
  });

  it('ignores case and punctuation differences in the name', () => {
    // Registry display names and launcher names disagree on punctuation
    // constantly -- "The Witcher 3: Wild Hunt" against "The Witcher 3
    // Wild Hunt" is the normal case, not an edge one.
    expect(matchLauncherApp({ name: 'the witcher 3 wild hunt' }, apps)).toBeTruthy();
  });

  // A wrong match puts one game's size on another game's row, which is
  // worse than a blank -- so anything short of a real correspondence
  // must not match.
  it('does not match on a partial or coincidental name', () => {
    expect(matchLauncherApp({ name: 'Fort' }, apps)).toBeNull();
    expect(matchLauncherApp({ name: 'Fortnite Festival Companion' }, apps)).toBeNull();
    expect(matchLauncherApp({ name: 'Unrelated Program' }, apps)).toBeNull();
  });

  it('returns null when there is nothing to match against', () => {
    expect(matchLauncherApp({ name: 'Fortnite' }, [])).toBeNull();
    expect(matchLauncherApp({}, apps)).toBeNull();
    expect(matchLauncherApp(null, apps)).toBeNull();
  });
});
