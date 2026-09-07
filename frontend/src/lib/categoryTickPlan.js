import { needsWarning } from './cleanWarning.js';

/** What ticking a whole application's checkbox should do.
 *
 * Two lists, because a bulk tick has two kinds of rule under it: the ones
 * that can just be selected, and the ones that owe the user a question
 * first.
 *
 * This used to skip every risky rule outright, on the reasoning that a
 * bulk click is the opposite of the deliberate choice the warning exists
 * to capture, and that five dialogs in a row would train anyone to
 * dismiss them unread. Asked for directly, the behaviour is now what Revo
 * and BleachBit both do -- tick everything, ask about each risky one in
 * turn. The concern was about dialogs being clicked through, not about
 * them being absent, so nothing here selects a risky rule without showing
 * its warning: they are QUEUED rather than skipped.
 *
 * Rules already selected are left out of both lists. That matters for the
 * risky ones especially: a rule already ticked must not raise its warning
 * a second time because the category was ticked.
 *
 * Order is the order the rules are listed, so the dialogs arrive in the
 * same sequence as the rows they name. */
export function categoryTickPlan(items, selected, acknowledged) {
  const selectNow = [];
  const askAbout = [];

  for (const item of items || []) {
    if (!item?.id || selected?.has(item.id)) continue;
    if (needsWarning(item, { checking: true, acknowledged })) askAbout.push(item);
    else selectNow.push(item.id);
  }

  return { selectNow, askAbout };
}
