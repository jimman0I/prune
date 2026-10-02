import { useEffect, useState } from 'react';

/** `value`, but only after it has stopped changing for `delayMs`.
 *
 * For the search box's heavy half: the folder rows and the map react to every
 * keystroke (they are a handful of items), while the whole-tree search of the
 * File view waits for a pause in typing. */
export function useDebouncedValue(value, delayMs = 250) {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    if (value === settled) return undefined;
    const timer = setTimeout(() => setSettled(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs, settled]);
  return settled;
}
