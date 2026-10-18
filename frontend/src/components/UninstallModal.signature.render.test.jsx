// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderScreen } from '../testSupport/renderScreen.jsx';

/** Who signed the program, said where the decision to run its uninstaller
 * is made -- and nothing at all when Windows was never asked. */

vi.mock('../lib/api.js', () => ({
  streamUninstall: vi.fn(),
  scanForLeftovers: vi.fn(),
  removeQuarantined: vi.fn(),
  fetchSettings: vi.fn(async () => ({})),
  updateSettings: vi.fn(),
  scanForcedUninstall: vi.fn(),
  appendHistoryEntry: vi.fn(async () => {})
}));

const UninstallModal = (await import('./UninstallModal.jsx')).default;
const base = { id: 'thing', name: 'Thing', publisher: 'Acme', uninstallString: '"C:\\Program Files\\Thing\\uninst.exe"' };
const line = () => document.querySelector('[data-signature]');

describe('the signature line', () => {
  it('names the signer when the signature is valid', async () => {
    renderScreen(<UninstallModal program={{ ...base, signature: { status: 'valid', signer: 'Acme Software Ltd' } }} onClose={() => {}} />);
    await screen.findByText(/uninst\.exe/);
    expect(line().textContent).toBe('Digitally signed by Acme Software Ltd.');
  });

  it('says plainly when the files are unsigned', async () => {
    renderScreen(<UninstallModal program={{ ...base, signature: { status: 'unsigned' } }} onClose={() => {}} />);
    await screen.findByText(/uninst\.exe/);
    expect(line().textContent).toBe("Its files aren't digitally signed.");
  });

  it('warns when the signature no longer matches the file', async () => {
    renderScreen(<UninstallModal program={{ ...base, signature: { status: 'broken', signer: 'Acme' } }} onClose={() => {}} />);
    await screen.findByText(/uninst\.exe/);
    expect(line().dataset.signature).toBe('broken');
    expect(line().textContent).toMatch(/changed after it was signed/);
  });

  it('says nothing when Windows was not asked', async () => {
    renderScreen(<UninstallModal program={base} onClose={() => {}} />);
    await screen.findByText(/uninst\.exe/);
    expect(line()).toBeNull();
  });
});
