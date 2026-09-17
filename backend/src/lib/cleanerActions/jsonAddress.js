/** Resolves a BleachBit-style `/`-separated `address` (e.g.
 * `dns_prefetching/host_referral_list`) against a parsed JSON object.
 *
 * Returns `{ parent, key }` -- the object that directly holds the target
 * key, and the key's own name -- so the caller can `delete parent[key]`
 * without walking the path a second time. Returns `null` when the key
 * doesn't genuinely exist: any intermediate segment missing or not an
 * object, or the final segment simply absent (checked against
 * `undefined`, not a truthy check -- a key explicitly set to `null`
 * still counts as present; a key set to `undefined`, or never set at
 * all, does not -- `parent[key] === undefined` distinguishes these
 * correctly where `key in parent` would not, since `in` only tests
 * property existence and is true even for a key explicitly assigned
 * `undefined`).
 *
 * Purpose-built for this one shape, not a general "get/set/delete a
 * deep object path" utility -- BleachBit's own `address` values are
 * always a plain `/`-joined list of plain keys, never an array index or
 * a key containing a literal `/`, so nothing more general is needed. */
export function resolveAddress(obj, address) {
  const segments = address.split('/');
  let parent = obj;
  for (let i = 0; i < segments.length - 1; i++) {
    if (parent === null || typeof parent !== 'object') return null;
    parent = parent[segments[i]];
  }
  if (parent === null || typeof parent !== 'object') return null;
  const key = segments[segments.length - 1];
  if (parent[key] === undefined) return null;
  return { parent, key };
}
