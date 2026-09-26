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

/** Press Preview and wait until the scan has completed.
 *
 * "Completed" is the scan stream having been called, the spinner gone and
 * the "Preview first" hint gone (it only shows before a scan has finished),
 * all language-independent, unlike the Preview/Rescan button's own label.
 */
export async function runMeasuredPreview(user, scanMock, previewName = 'Preview') {
  await user.click(screen.getAllByRole('button', { name: previewName })[0]);
  await waitFor(() => expect(scanMock).toHaveBeenCalled());
  await waitFor(() => {
    expect(document.querySelector('.animate-spin')).toBeNull();
    expect(document.getElementById('deep-clean-preview-first')).toBeNull();
  });
}
