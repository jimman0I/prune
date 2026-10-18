// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../testSupport/renderScreen.jsx';

/** Signatures in Applications: a quiet badge for unsigned, a red one for a
 * signature that no longer matches its file, a filter for both, and the two
 * filter groups that keep the row of filters short. */

vi.mock('../lib/api.js', () => ({
  fetchInstallTraces: vi.fn(async () => []),
  fetchSettings: vi.fn(async () => ({})),
  updateSettings: vi.fn(async (p) => p),
  fetchPrograms: vi.fn(async () => []),
  revealInExplorer: vi.fn(),
  openInstalledAppsSettings: vi.fn(),
  deleteInstallTrace: vi.fn()
}));

const ProgramList = (await import('./ProgramList.jsx')).default;
const { withSignatures } = await import('../hooks/usePrograms.js');

const signed = { id: 'a', name: 'Signed App', publisher: 'Vendor', uninstallString: 'u.exe', sizeBytes: 3, signature: { status: 'valid', signer: 'Vendor' } };
const unsigned = { id: 'b', name: 'Free Tool', publisher: 'Someone', uninstallString: 'u.exe', sizeBytes: 2, signature: { status: 'unsigned' } };
const tampered = { id: 'c', name: 'Changed App', publisher: 'Vendor', uninstallString: 'u.exe', sizeBytes: 1, signature: { status: 'broken', signer: 'Vendor' } };
const unknown = { id: 'd', name: 'Not Checked', publisher: 'X', uninstallString: 'u.exe', sizeBytes: 1 };

describe('signatures in the list', () => {
  it('marks unsigned and broken rows, and nothing on a signed or unchecked one', async () => {
    renderScreen(<ProgramList programs={[signed, unsigned, tampered, unknown]} />);
    expect(within(await screen.findByRole('row', { name: /Free Tool/ })).getByText('Unsigned')).toBeTruthy();
    expect(within(screen.getByRole('row', { name: /Changed App/ })).getByText('Signature broken')).toBeTruthy();
    expect(within(screen.getByRole('row', { name: /Signed App/ })).queryByText(/Unsigned|Signature broken/)).toBeNull();
    expect(within(screen.getByRole('row', { name: /Not Checked/ })).queryByText(/Unsigned|Signature broken/)).toBeNull();
  });

  it('filters to both kinds, says what the filter means, and sits in its own group', async () => {
    const user = userEvent.setup();
    renderScreen(<ProgramList programs={[signed, unsigned, tampered, unknown]} />);
    const checks = await screen.findByRole('group', { name: 'What needs a look' });
    await user.click(within(checks).getByRole('button', { name: 'Unsigned (2)' }));
    expect(screen.getByText(/isn't proof of harm/)).toBeTruthy();
    expect(screen.queryByRole('row', { name: /Signed App/ })).toBeNull();
    expect(screen.getByRole('row', { name: /Free Tool/ })).toBeTruthy();
    expect(screen.getByRole('row', { name: /Changed App/ })).toBeTruthy();
    expect(within(screen.getByRole('group', { name: 'Where programs come from' })).getByRole('button', { name: 'All' })).toBeTruthy();
  });

  it('withSignatures puts each answer on its program and returns the same array when there are none', () => {
    const list = [{ id: 'a' }, { id: 'b' }];
    expect(withSignatures(list, { b: { status: 'unsigned' } })[1]).toEqual({ id: 'b', signature: { status: 'unsigned' } });
    expect(withSignatures(list, {})).toBe(list);
  });
});
