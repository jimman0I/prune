// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../testSupport/renderScreen.jsx';

/** Settings -> Cleanup -> Custom locations and Imported cleaners.
 * The API is mocked; what is pinned is what the person is told. */

let state;
const fetchCustomCleaners = vi.fn(async () => state);
const addCustomLocation = vi.fn();
const removeCustomLocation = vi.fn();
const importCleaner = vi.fn();
const removeImportedCleaner = vi.fn();

vi.mock('../lib/api.js', () => ({
  fetchSettings: vi.fn(async () => ({})),
  updateSettings: vi.fn(),
  fetchCustomCleaners: (...a) => fetchCustomCleaners(...a),
  addCustomLocation: (...a) => addCustomLocation(...a),
  removeCustomLocation: (...a) => removeCustomLocation(...a),
  importCleaner: (...a) => importCleaner(...a),
  removeImportedCleaner: (...a) => removeImportedCleaner(...a)
}));

const CustomCleanersSettings = (await import('./CustomCleanersSettings.jsx')).default;

const slack = {
  id: 'slack', label: 'Slack', source: 'slack.xml', importedAt: 1, ruleCount: 3,
  report: { options: { total: 4, imported: 3, skipped: 1 }, actions: { total: 15, imported: 11, skipped: 4 }, skipped: [{ kind: 'command', detail: 'sqlite.vacuum', count: 4 }] }
};

beforeEach(() => {
  vi.clearAllMocks();
  state = { locations: [], imported: [] };
  addCustomLocation.mockImplementation(async (path) => { state = { ...state, locations: [...state.locations, path] }; return { locations: state.locations }; });
  removeCustomLocation.mockImplementation(async (path) => { state = { ...state, locations: state.locations.filter((p) => p !== path) }; return { locations: state.locations }; });
  removeImportedCleaner.mockImplementation(async (id) => { state = { ...state, imported: state.imported.filter((c) => c.id !== id) }; return { removed: true }; });
});

const input = () => screen.getByRole('textbox', { name: 'Location to add' });

describe('custom locations', () => {
  it('starts with a plain statement that there are none, and says what they are', async () => {
    renderScreen(<CustomCleanersSettings />);
    expect(await screen.findByText('No custom locations yet.')).toBeTruthy();
    const description = screen.getByText(/Add files, folders or patterns/);
    expect(description.textContent).toMatch(/never ticked by default/);
    expect(description.textContent).toMatch(/protected places/);
  });

  it('adds a location with the button, and clears the box', async () => {
    const user = userEvent.setup();
    renderScreen(<CustomCleanersSettings />);
    await screen.findByText('No custom locations yet.');
    await user.type(input(), 'D:\\Games\\Cache');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(addCustomLocation).toHaveBeenCalledWith('D:\\Games\\Cache');
    expect(await screen.findByText('D:\\Games\\Cache')).toBeTruthy();
    expect(input().value).toBe('');
  });

  it('adds with Enter too', async () => {
    const user = userEvent.setup();
    renderScreen(<CustomCleanersSettings />);
    await screen.findByText('No custom locations yet.');
    await user.type(input(), 'D:\\Scratch{Enter}');
    expect(addCustomLocation).toHaveBeenCalledWith('D:\\Scratch');
  });

  it.each([
    ['protected', /protected place/],
    ['relative', /Write a full path/],
    ['climb', /\.\. in it is not allowed/],
    ['wildcard', /Put the \* lower down/],
    ['empty', /Type a path first/],
    ['long', /too long/]
  ])('says why a %s location was refused, in words, and keeps what was typed', async (reason, words) => {
    addCustomLocation.mockRejectedValueOnce(Object.assign(new Error('nope'), { reason }));
    const user = userEvent.setup();
    renderScreen(<CustomCleanersSettings />);
    await screen.findByText('No custom locations yet.');
    await user.type(input(), 'C:\\Windows');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(words);
    expect(input().value).toBe('C:\\Windows');
    expect(input().getAttribute('aria-invalid')).toBe('true');
  });

  it('falls back to the server message for a failure with no reason', async () => {
    addCustomLocation.mockRejectedValueOnce(new Error('disk full'));
    const user = userEvent.setup();
    renderScreen(<CustomCleanersSettings />);
    await screen.findByText('No custom locations yet.');
    await user.type(input(), 'D:\\A');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(await screen.findByText("Couldn't save: disk full")).toBeTruthy();
  });

  it('removes one', async () => {
    state = { locations: ['D:\\A', 'D:\\B'], imported: [] };
    const user = userEvent.setup();
    renderScreen(<CustomCleanersSettings />);
    await screen.findByText('D:\\A');
    await user.click(screen.getByRole('button', { name: 'Stop cleaning D:\\A' }));
    expect(removeCustomLocation).toHaveBeenCalledWith('D:\\A');
    await waitFor(() => expect(screen.queryByText('D:\\A')).toBeNull());
    expect(screen.getByText('D:\\B')).toBeTruthy();
  });

  it('does not add a blank box', async () => {
    renderScreen(<CustomCleanersSettings />);
    await screen.findByText('No custom locations yet.');
    expect(screen.getByRole('button', { name: 'Add' }).disabled).toBe(true);
  });
});

describe('imported cleaners', () => {
  const upload = async (user, file) => {
    await screen.findByText('No imported cleaners.');
    await user.upload(screen.getByTestId('import-cleaner-input'), file);
  };

  it('starts empty, with a button to import', async () => {
    renderScreen(<CustomCleanersSettings />);
    expect(await screen.findByText('No imported cleaners.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Import cleaner…' })).toBeTruthy();
  });

  it('only offers .xml files', async () => {
    renderScreen(<CustomCleanersSettings />);
    await screen.findByText('No imported cleaners.');
    expect(screen.getByTestId('import-cleaner-input').getAttribute('accept')).toMatch(/\.xml/);
  });

  it('sends the file\'s name and text, and reports exactly what was imported and skipped', async () => {
    importCleaner.mockImplementation(async () => {
      state = { ...state, imported: [slack] };
      return { imported: true, cleaner: { id: 'slack', label: 'Slack', ruleCount: 3 }, report: slack.report };
    });
    const user = userEvent.setup();
    renderScreen(<CustomCleanersSettings />);
    await upload(user, new File(['<cleaner id="slack"/>'], 'slack.xml', { type: 'text/xml' }));

    expect(importCleaner).toHaveBeenCalledWith('slack.xml', '<cleaner id="slack"/>');
    expect(await screen.findByText('Imported Slack. Options: 3 imported, 1 skipped. Actions: 11 imported, 4 skipped.')).toBeTruthy();
    expect(screen.getByText('Unsupported command sqlite.vacuum: 4')).toBeTruthy();
    // And it is in the list.
    const list = await screen.findByRole('list', { name: 'Imported cleaners' });
    expect(within(list).getByText('Slack')).toBeTruthy();
    expect(within(list).getByText('Options imported: 3')).toBeTruthy();
  });

  it.each([
    [{ kind: 'search', detail: 'walk.top', count: 2 }, 'Unsupported search type walk.top: 2'],
    [{ kind: 'filter', detail: 'regex', count: 5 }, 'Actions with a regular-expression filter: 5'],
    [{ kind: 'os', detail: 'linux', count: 7 }, 'Meant for another system (linux): 7'],
    [{ kind: 'variable', detail: '$$x$$', count: 1 }, 'Unknown variable $$x$$: 1'],
    [{ kind: 'path', detail: '', count: 3 }, 'Unusable or unsafe paths: 3']
  ])('says each kind of skip in words: %j', async (skip, text) => {
    importCleaner.mockResolvedValue({
      imported: true, cleaner: { id: 'x', label: 'X', ruleCount: 1 },
      report: { options: { total: 1, imported: 1, skipped: 0 }, actions: { total: 1, imported: 1, skipped: 0 }, skipped: [skip] }
    });
    const user = userEvent.setup();
    renderScreen(<CustomCleanersSettings />);
    await upload(user, new File(['<cleaner id="x"/>'], 'x.xml'));
    expect(await screen.findByText(text)).toBeTruthy();
  });

  it('says plainly when nothing could be imported', async () => {
    importCleaner.mockResolvedValue({
      imported: false, cleaner: { id: 'w', label: 'Winreg only', ruleCount: 0 },
      report: { options: { total: 2, imported: 0, skipped: 2 }, actions: { total: 5, imported: 0, skipped: 5 }, skipped: [{ kind: 'command', detail: 'winreg', count: 5 }] }
    });
    const user = userEvent.setup();
    renderScreen(<CustomCleanersSettings />);
    await upload(user, new File(['<cleaner id="w"/>'], 'w.xml'));
    expect(await screen.findByText('Nothing was imported from Winreg only. Options skipped: 2. Actions skipped: 5.')).toBeTruthy();
    expect(screen.getByText('Unsupported command winreg: 5')).toBeTruthy();
  });

  it.each([
    ['tooLarge', 'That file is too large to be a cleaner.'],
    ['notXml', 'That is not valid XML.'],
    ['notCleaner', 'That is not a BleachBit cleaner file.'],
    ['noId', 'That cleaner has no id.']
  ])('explains a refused file (%s)', async (code, words) => {
    importCleaner.mockRejectedValue(Object.assign(new Error('x'), { code }));
    const user = userEvent.setup();
    renderScreen(<CustomCleanersSettings />);
    await upload(user, new File(['junk'], 'junk.xml'));
    expect(await screen.findByText(words)).toBeTruthy();
  });

  it('does not even send a file that is obviously too large', async () => {
    const user = userEvent.setup();
    renderScreen(<CustomCleanersSettings />);
    await upload(user, new File(['x'.repeat(600 * 1024)], 'huge.xml'));
    expect(importCleaner).not.toHaveBeenCalled();
    expect(await screen.findByText('That file is too large to be a cleaner.')).toBeTruthy();
  });

  it('removes an imported cleaner', async () => {
    state = { locations: [], imported: [slack] };
    const user = userEvent.setup();
    renderScreen(<CustomCleanersSettings />);
    await user.click(await screen.findByRole('button', { name: 'Remove Slack' }));
    expect(removeImportedCleaner).toHaveBeenCalledWith('slack');
    expect(await screen.findByText('No imported cleaners.')).toBeTruthy();
  });
});
