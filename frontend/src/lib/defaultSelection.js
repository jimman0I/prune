import { needsWarning } from './cleanWarning.js';

/** Whether a scanned rule is something the user could actually clean.
 *
 * `present: false` means the software isn't on this machine, and
 * `accessible: false` means the folder exists but couldn't be read (the
 * needs-admin case). Selecting either puts a rule in the batch that would
 * free nothing -- and in the second case, one whose real size we don't
 * even know. */
function isSelectable(item) {
  return item.present !== false && item.accessible !== false;
}

/** What to tick after a Preview.
 *
 * The problem this exists for: a scan found 54.46 GB across 40 rules and
 * pre-selected none of them. The footer read "Total space to free: 0 B",
 * Clean sat disabled, and the only way forward was ticking forty
 * checkboxes. After a nineteen-second scan that is indistinguishable from
 * a broken feature -- which is exactly what it was reported as.
 *
 * Selecting by default is safe here in a way it wouldn't be in a tool
 * that deletes: Clean moves everything to Quarantine first, and there's a
 * confirmation step before it does. What still matters is WHICH rules,
 * and that judgement lives in cleaners.json (`recommended`) rather than
 * here -- caches that regenerate on their own, nothing that costs a large
 * re-download, nothing that loses state the user can see. */
export function defaultSelection(categories) {
  const selected = new Set();
  for (const group of categories || []) {
    for (const item of group.items || []) {
      if (item.recommended && isSelectable(item)) selected.add(item.id);
    }
  }
  return selected;
}

/** Every rule a finished scan proved is still worth cleaning.
 *
 * Deliberately NOT the same question as selectableIds, and keeping them
 * apart is the whole point of this function existing. Select All asks
 * "what should one click reach", and the answer excludes rules that lose
 * data. This asks "what is still valid after a scan", and the answer
 * includes them: the user may have ticked one on purpose, through a
 * dialog that made them confirm it.
 *
 * Collapsing the two is a real bug that shipped. DeepClean narrows the
 * selection through this after every Preview, and while it went through
 * selectableIds a rule the user had just enabled -- including one they
 * had permanently acknowledged -- was silently unticked the moment a scan
 * finished. */
export function cleanableIds(categories) {
  const ids = new Set();
  for (const group of categories || []) {
    for (const item of group.items || []) {
      if (isSelectable(item)) ids.add(item.id);
    }
  }
  return ids;
}

/** Everything a "select all" could reach. Deliberately wider than the
 * defaults -- an explicit click may take the non-recommended rules too --
 * but still never the ones that would clean nothing.
 *
 * And never the ones that lose something, unless the user has already
 * said to stop asking about that rule. A single click on Select All is
 * the opposite of the deliberate choice the warning dialog exists to
 * capture; sweeping "signs you out of every site that remembered you"
 * into a batch without a word would make the dialog pointless in the one
 * case it matters most. */
export function selectableIds(categories, acknowledged) {
  const ids = new Set();
  for (const group of categories || []) {
    for (const item of group.items || []) {
      if (!isSelectable(item)) continue;
      if (needsWarning(item, { checking: true, acknowledged })) continue;
      ids.add(item.id);
    }
  }
  return ids;
}
