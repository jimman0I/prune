import { expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';

/** A Deep Clean Preview that measured something.
 *
 * Clean is disabled until a Preview has completed and measured at least
 * one ticked item, so every test that wants to press Clean has to get
 * through one first. This is the scan stream those tests hand to the
 * mocked streamDeepCleanScan: one 'rule' event per listed rule, each
 * carrying its category (mergeScannedRule groups by it) and a real size.
 */
export function measuredScan(tree, sizeBytes = 1024) {
  return async (onEvent) => {
    const items = tree.flatMap((group) => group.items.map((item) => ({ group, item })));
    onEvent('start', { total: items.length });
    for (const { group, item } of items) {
      onEvent('rule', {
        id: item.id, category: group.category, name: item.name,
        sizeBytes, fileCount: 1, present: true, accessible: true
      });
    }
  };
}

/** Press Preview (or Rescan) and wait until the scan has completed.
 *
 * Deep Clean now scans automatically the moment its tree loads (see
 * DeepClean.jsx's own autoScanRef effect), so by the time a test can
 * observe anything the button in this spot has usually already flipped
 * from Preview to Rescan -- and, for as long as that automatic scan is
 * still in flight, neither label is on screen at all (Stop takes its
 * place). `previewName` accepts either a single label or both, defaulting
 * to the English pair; callers in another language pass their own pair
 * (e.g. `['Προεπισκόπηση', 'Επανασάρωση']`).
 *
 * "Completed" is the scan stream having been called, the spinner gone and
 * the "Preview first" hint gone (it only shows before a scan has finished),
 * all language-independent, unlike the Preview/Rescan button's own label.
 */
export async function runMeasuredPreview(user, scanMock, previewName = ['Preview', 'Rescan']) {
  const names = Array.isArray(previewName) ? previewName : [previewName];
  const pattern = new RegExp(`^(${names.join('|')})$`);
  // Wait for whichever automatic scan is already running to settle -- Stop
  // is in this same spot until it does, so there is nothing to click yet.
  // The query is re-run inside waitFor itself (not just the assertion
  // before it) so a slow machine re-rendering between the check and the
  // click can't hand this a now-stale, no-longer-attached element.
  let clicked = false;
  await waitFor(async () => {
    if (clicked) return;
    const [button] = screen.getAllByRole('button', { name: pattern });
    expect(button).toBeTruthy();
    try {
      await user.click(button);
      clicked = true;
    } catch (err) {
      clicked = false;
      throw err;
    }
  });
  await waitFor(() => expect(scanMock).toHaveBeenCalled());
  await waitFor(() => {
    expect(document.querySelector('.animate-spin')).toBeNull();
    expect(document.getElementById('deep-clean-preview-first')).toBeNull();
  });
}
