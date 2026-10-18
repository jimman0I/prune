// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderScreen } from '../testSupport/renderScreen.jsx';

/** The line under an uninstall's progress while Prune answers its wizard,
 * and the alert when it hands the wizard back. */

vi.mock('../lib/api.js', () => ({
  fetchSettings: vi.fn(async () => ({})),
  updateSettings: vi.fn()
}));

const WizardNote = (await import('./WizardNote.jsx')).default;

describe('WizardNote', () => {
  it('says which control it used, in the window\'s own words', async () => {
    renderScreen(<WizardNote event={{ state: 'answered', act: 'invoke', label: 'Next', window: 'Foo' }} />);
    expect((await screen.findByRole('status')).textContent).toBe('Answering the uninstaller: pressed “Next”');
  });

  it('says unticked and chose for boxes and options', async () => {
    renderScreen(<><WizardNote event={{ state: 'answered', act: 'toggle', label: 'Visit our website' }} /><WizardNote event={{ state: 'answered', act: 'select', label: 'Restart later' }} /></>);
    const lines = (await screen.findAllByRole('status')).map((el) => el.textContent);
    expect(lines[0]).toMatch(/unticked “Visit our website”/);
    expect(lines[1]).toMatch(/chose “Restart later”/);
  });

  it('alerts with the reason when it hands the wizard back', async () => {
    renderScreen(<WizardNote event={{ state: 'handover', reason: 'elevated', window: 'Foo' }} />);
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/runs as administrator/);
    expect(alert.textContent).toMatch(/in front now/);
  });

  it('falls back to a general reason for one it does not know, and shows nothing without an event', async () => {
    renderScreen(<><WizardNote event={{ state: 'handover', reason: 'something-new' }} /><WizardNote event={null} /><WizardNote event={{ state: 'answered' }} /></>);
    expect((await screen.findAllByRole('alert')).map((el) => el.textContent)).toEqual([expect.stringMatching(/won't guess/)]);
    expect(screen.queryByRole('status')).toBeNull();
  });
});
