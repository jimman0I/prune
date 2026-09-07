/** Whether a category heading's checkbox reads full, empty or partial.
 *
 * 'none' | 'all' | 'some'. An empty category is 'none', not 'all': "every
 * child is ticked" is vacuously true of no children, and a heading drawn
 * full above nothing would be a lie. That case is reachable -- hiding
 * software that is not installed can empty a category. */
export function categorySelectionState(items, selected) {
  const list = items || [];
  if (list.length === 0) return 'none';

  let ticked = 0;
  for (const item of list) if (selected?.has(item.id)) ticked += 1;

  if (ticked === 0) return 'none';
  return ticked === list.length ? 'all' : 'some';
}

/** What a click on the heading's checkbox should do next.
 *
 * A partial category clears rather than fills. Filling it would silently
 * tick rules the user had deliberately left alone -- including risky ones
 * they may have already been warned about and declined -- so clearing is
 * the reversible reading of an otherwise ambiguous click. */
export function nextCategoryChecked(state) {
  return state === 'none';
}
