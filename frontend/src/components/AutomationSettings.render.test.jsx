// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderScreen } from '../testSupport/renderScreen.jsx';
import { isCopyable } from '../testSupport/copyable.js';

/** The Automation panel's report of the last scheduled run.
 *
 * A run that failed did so with nobody watching, so the error it left is
 * the only account there is of what happened -- and the one piece of text
 * on this panel somebody would want to copy. */

const fetchAutomation = vi.fn();

vi.mock('../lib/api.js', async (importOriginal) => ({
  ...(await importOriginal()),
  fetchAutomation: (...a) => fetchAutomation(...a)
}));

const AutomationSettings = (await import('./AutomationSettings.jsx')).default;

const settings = {
  automation: { enabled: true, frequency: 'weekly', weekday: 0, hour: 2, minute: 0, task: 'scan' }
};

describe('the last scheduled run', () => {
  it('leaves the reason it failed copyable', async () => {
    fetchAutomation.mockResolvedValue({
      nextRun: null,
      lastResult: { at: Date.UTC(2026, 8, 10, 2), ok: false, error: 'EBUSY: resource busy or locked' }
    });
    renderScreen(<AutomationSettings settings={settings} save={vi.fn()} />);

    expect(isCopyable(await screen.findByText('EBUSY: resource busy or locked'))).toBe(true);
    expect(isCopyable(screen.getByText('Automation'))).toBe(false);
  });
});
