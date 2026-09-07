import { describe, it, expect } from 'vitest';
import { appxDisplayName } from './appxName.js';

/** Turning a Store package identity into the name on the row.
 *
 * The registry gives the package family name, which carries the publisher
 * as a prefix: "40459File-New-Project.EarTrumpet",
 * "RivetNetworks.KillerControlCenter", "Microsoft.GamingApp". Shown raw,
 * a list of ten of these is unreadable, and the publisher is already the
 * least useful part -- the same argument iconTileLetter.js makes about
 * dropping a vendor prefix from a program name.
 *
 * The real display name lives in the package manifest, often behind an
 * ms-resource: indirection that needs resolving per language. This does
 * not go there: it takes the identity Windows itself uses and makes it
 * readable, and does not invent a name it has not been told.
 */

describe('appxDisplayName', () => {
  it('drops a publisher prefix', () => {
    expect(appxDisplayName('RivetNetworks.KillerControlCenter')).toBe('KillerControlCenter');
    expect(appxDisplayName('Microsoft.GamingApp')).toBe('GamingApp');
  });

  it('drops a numeric publisher id too', () => {
    // Store-assigned publisher ids look like "40459File-New-Project".
    expect(appxDisplayName('40459File-New-Project.EarTrumpet')).toBe('EarTrumpet');
    expect(appxDisplayName('47492CenterpointGaming.ProSight')).toBe('ProSight');
  });

  it('leaves a name that has no prefix alone', () => {
    expect(appxDisplayName('Claude')).toBe('Claude');
    expect(appxDisplayName('MSTeams')).toBe('MSTeams');
  });

  it('takes only the last segment when there are several', () => {
    expect(appxDisplayName('A.B.C')).toBe('C');
  });

  it('keeps the whole thing rather than returning nothing', () => {
    // A trailing dot would otherwise leave an empty name, and a row with
    // no name at all is worse than an ugly one.
    expect(appxDisplayName('Microsoft.')).toBe('Microsoft.');
    expect(appxDisplayName('')).toBe('');
    expect(appxDisplayName(null)).toBe('');
  });
});
