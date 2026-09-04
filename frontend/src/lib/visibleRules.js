/** Hides the cleaners that don't apply to this machine.
 *
 * BleachBit's "hide irrelevant cleaners", and on a list this long it earns
 * its place: of Prune's 74 rules, most are for software the user does not
 * have. Scrolling past forty greyed-out browsers to find the two installed
 * ones is the whole reason someone would want this off.
 *
 * `present` is the field that decides it, and it already means exactly the
 * right thing: the rule's paths exist on disk. That is a different question
 * from whether the rule found anything -- "Discord isn't installed" and
 * "Discord's cache is already empty" both measure 0 bytes, and only the
 * first one is worth hiding. A rule whose `present` was never computed
 * (a command rule, or a scan that hasn't reached it yet) is kept: hiding
 * something because it has not been measured would make the list shrink
 * while it loads. */
export function visibleCategories(categories, hideUnavailable) {
  if (!hideUnavailable) return categories || [];

  const kept = [];
  for (const group of categories || []) {
    const items = (group.items || []).filter((item) => item.present !== false);
    // A category with nothing left goes entirely. An empty heading is a
    // claim that the group exists and is empty, which is true and is not
    // worth a row of screen.
    if (items.length > 0) kept.push({ ...group, items });
  }
  return kept;
}

/** How many rules the filter is currently holding back, for the line that
 * tells the user the list is not everything.
 *
 * Without it the setting is invisible from the screen it affects: someone
 * who turned it on last week and forgot has no way to tell the difference
 * between "Prune has no cleaner for this" and "Prune is hiding it". */
export function hiddenRuleCount(categories, hideUnavailable) {
  if (!hideUnavailable) return 0;
  let hidden = 0;
  for (const group of categories || []) {
    for (const item of group.items || []) {
      if (item.present === false) hidden++;
    }
  }
  return hidden;
}
