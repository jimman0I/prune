// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { screen, cleanup, fireEvent } from '@testing-library/react';
import { renderScreen } from '../testSupport/renderScreen.jsx';
import { DrivePicker } from './DrivePicker.jsx';

vi.mock('../lib/api.js', () => ({
  fetchSettings: vi.fn(async () => ({})),
  updateSettings: vi.fn()
}));

afterEach(cleanup);

const GB = 1024 ** 3;
const drives = [
  { letter: 'C', label: 'Windows', fileSystem: 'NTFS', totalBytes: 1000 * GB, freeBytes: 250 * GB, removable: false, system: true, ntfs: true },
  { letter: 'E', label: 'USB STICK', fileSystem: 'exFAT', totalBytes: 64 * GB, freeBytes: 60 * GB, removable: true, system: false, ntfs: false }
];

const mount = (props = {}) =>
  renderScreen(<DrivePicker drives={drives} current="C" scanned={new Set()} onSelect={() => {}} {...props} />);

describe('the drive picker', () => {
  it('lists every drive as a button naming its letter, label and usage', async () => {
    mount();
    const c = await screen.findByRole('button', { name: /C:.*Windows/ });
    expect(c.textContent).toMatch(/750 GB of 1000 GB used/);
    expect(screen.getByRole('button', { name: /E:.*USB STICK/ })).toBeTruthy();
  });

  it('marks the drive being viewed as pressed and the others not', async () => {
    mount({ current: 'E' });
    expect((await screen.findByRole('button', { name: /E:/ })).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: /C:/ }).getAttribute('aria-pressed')).toBe('false');
  });

  it('badges the system drive and a removable one', async () => {
    mount();
    expect((await screen.findByRole('button', { name: /C:/ })).textContent).toMatch(/System/);
    expect(screen.getByRole('button', { name: /E:/ }).textContent).toMatch(/Removable/);
  });

  it('says which drives already have a scan in memory', async () => {
    mount({ scanned: new Set(['C']) });
    expect((await screen.findByRole('button', { name: /C:/ })).textContent).toMatch(/Scanned/);
    expect(screen.getByRole('button', { name: /E:/ }).textContent).not.toMatch(/Scanned/);
  });

  it('reports the letter when a drive is chosen', async () => {
    const onSelect = vi.fn();
    mount({ onSelect });
    fireEvent.click(await screen.findByRole('button', { name: /E:/ }));
    expect(onSelect).toHaveBeenCalledWith('E');
  });

  it('is a labelled group, so a screen reader announces what the buttons choose between', async () => {
    mount();
    expect(await screen.findByRole('group', { name: 'Drives' })).toBeTruthy();
  });

  it('draws nothing when there is only the one drive to choose', async () => {
    const { container } = mount({ drives: [drives[0]] });
    await Promise.resolve();
    expect(container.querySelector('[role="group"]')).toBeNull();
  });

  it('draws nothing when the drive list could not be read', async () => {
    const { container } = mount({ drives: null });
    await Promise.resolve();
    expect(container.querySelector('[role="group"]')).toBeNull();
  });

  it('uses no native title attribute for hover text', async () => {
    const { container } = mount();
    await screen.findByRole('group', { name: 'Drives' });
    expect(container.querySelector('[title]')).toBeNull();
  });
});
