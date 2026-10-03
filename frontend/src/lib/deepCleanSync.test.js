// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { announceScanChange, onScanChange } from './deepCleanSync.js';

describe('deepCleanSync', () => {
  it('tells every listener except the one that announced', () => {
    const mine = vi.fn();
    const other = vi.fn();
    const stopMine = onScanChange('me', mine);
    const stopOther = onScanChange('them', other);
    announceScanChange('me');
    expect(mine).not.toHaveBeenCalled();
    expect(other).toHaveBeenCalledTimes(1);
    stopMine();
    stopOther();
  });

  it('stops telling a listener once it has unsubscribed', () => {
    const other = vi.fn();
    const stop = onScanChange('them', other);
    stop();
    announceScanChange('me');
    expect(other).not.toHaveBeenCalled();
  });

  it('does nothing, quietly, where there is no window', () => {
    vi.stubGlobal('window', undefined);
    try {
      expect(() => announceScanChange('x')).not.toThrow();
      expect(onScanChange('x', () => {})()).toBeUndefined();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
