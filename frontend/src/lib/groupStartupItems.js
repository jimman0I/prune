/** The order Revo lists startup locations in, and the names it gives them.
 *
 * Revo groups its Autorun Manager by location -- "Location : All Users
 * Startup", "Location : Registry: HKCU Run" -- and the grouping is the
 * useful part: where an entry lives is what decides who it affects, how it
 * is switched off, and whether removing it needs administrator rights. A
 * flat list makes the reader reconstruct that from a column.
 *
 * The order is fixed rather than alphabetical: Startup folders first
 * because they are the ones a person put there by hand, then the Run keys
 * that programs write themselves, and RunOnce last because those delete
 * themselves after they fire and are rarely what anyone came here for. */
const GROUP_ORDER = [
  'Startup folder|machine',
  'Startup folder|user',
  'Run|user',
  'Run|machine',
  'Run (32-bit)|machine',
  'RunOnce|user',
  'RunOnce|machine'
];

const GROUP_LABELS = {
  'Startup folder|machine': 'All users Startup folder',
  'Startup folder|user': 'Current user Startup folder',
  'Run|user': 'Registry: HKCU Run',
  'Run|machine': 'Registry: HKLM Run',
  'Run (32-bit)|machine': 'Registry: HKLM Run (32-bit)',
  'RunOnce|user': 'Registry: HKCU RunOnce',
  'RunOnce|machine': 'Registry: HKLM RunOnce'
};

function groupKeyFor(item) {
  return `${item?.location ?? ''}|${item?.rawScope === 'machine' ? 'machine' : 'user'}`;
}

/** Splits the flat list into Revo's location groups.
 *
 * A group with nothing in it is left out entirely: a heading over an empty
 * list is a claim that the location exists and is empty, which is true but
 * is not worth a row of screen. Anything in a location this does not know
 * about still appears, under its own raw name -- dropping an entry because
 * its location was unexpected would hide exactly the surprising ones. */
export function groupStartupItems(items) {
  const buckets = new Map();

  for (const item of items || []) {
    const key = groupKeyFor(item);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(item);
  }

  const known = GROUP_ORDER.filter((key) => buckets.has(key));
  const unknown = [...buckets.keys()].filter((key) => !GROUP_ORDER.includes(key)).sort();

  return [...known, ...unknown].map((key) => ({
    key,
    label: GROUP_LABELS[key] ?? key.split('|')[0],
    items: buckets.get(key),
    // Per group, because "3 of 11" is the number that tells you whether
    // this location is where your sign-in time is going.
    enabledCount: buckets.get(key).filter((item) => item.enabled !== false).length
  }));
}

/** The two numbers Revo puts in its status bar.
 *
 * Enabled counts entries Windows will actually launch, which is not the
 * same as the number of entries: on this machine four of fifteen are
 * switched off and still sitting in the Run keys. */
export function startupCounts(items) {
  const list = items || [];
  return {
    total: list.length,
    enabled: list.filter((item) => item.enabled !== false).length,
    running: list.filter((item) => item.running === true).length,
    broken: list.filter((item) => item.exists === false).length
  };
}
