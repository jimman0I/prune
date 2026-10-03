// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, act } from '@testing-library/react';
import { renderScreen } from '../testSupport/renderScreen.jsx';

/** Dropping a program (.exe) or a shortcut (.lnk) onto the Applications screen.
 *
 * Showing the drop target is feedback for a drag that carries files; the drop
 * itself only hands the file's real path (read through the desktop bridge) to
 * the same "find it" flow the right-click menu uses. Anything that is not a
 * program or shortcut is declined with a reason, and nothing here changes
 * anything: finding a program starts no removal. */

const ProgramDropZone = (await import('./ProgramDropZone.jsx')).default;

const fileList = (...names) => names.map((name) => ({ name }));
const dragData = (files = [], types = ['Files']) => ({ dataTransfer: { types, files, dropEffect: 'none' } });
const bridge = (map) => { window.pruneWindow = { pathForFile: (f) => map[f.name] ?? '' }; };

function mount() {
  const onProgramFile = vi.fn();
  const view = renderScreen(
    <ProgramDropZone onProgramFile={onProgramFile}>
      <p>the applications list</p>
    </ProgramDropZone>
  );
  return { onProgramFile, zone: screen.getByTestId('program-drop-zone'), ...view };
}

beforeEach(() => { vi.useRealTimers(); });
afterEach(() => { delete window.pruneWindow; });

describe('the drop target', () => {
  it('shows nothing until a drag that carries files is over the screen', () => {
    const { zone } = mount();
    expect(screen.getByText('the applications list')).toBeTruthy();
    expect(screen.queryByText('Drop a program or shortcut to find it')).toBeNull();
    fireEvent.dragEnter(zone, dragData([], ['text/plain']));
    expect(screen.queryByText('Drop a program or shortcut to find it')).toBeNull();
  });

  it('says what dropping does while a file is dragged over it, and is announced as a status', () => {
    const { zone } = mount();
    fireEvent.dragEnter(zone, dragData([]));
    const overlay = screen.getByText('Drop a program or shortcut to find it').closest('[role="status"]');
    expect(overlay).toBeTruthy();
    expect(screen.getByText('Prune looks for the installed program it belongs to.')).toBeTruthy();
  });

  it('is only a visual: the overlay takes no pointer events, so the drag keeps reaching the screen', () => {
    const { zone } = mount();
    fireEvent.dragEnter(zone, dragData([]));
    const overlay = screen.getByText('Drop a program or shortcut to find it').closest('[role="status"]');
    expect(overlay.className).toMatch(/pointer-events-none/);
  });

  it('goes away when the drag leaves, even after crossing the screen\'s inner elements', () => {
    const { zone } = mount();
    const inner = screen.getByText('the applications list');
    fireEvent.dragEnter(zone, dragData([]));
    fireEvent.dragEnter(inner, dragData([]));
    fireEvent.dragLeave(zone, dragData([]));
    expect(screen.queryByText('Drop a program or shortcut to find it')).not.toBeNull();
    fireEvent.dragLeave(inner, dragData([]));
    expect(screen.queryByText('Drop a program or shortcut to find it')).toBeNull();
  });

  it('allows the drop only for files (a copy-style cursor), and cancels the browser\'s own handling', () => {
    const { zone } = mount();
    const event = dragData([]);
    const over = fireEvent.dragOver(zone, event);
    expect(over).toBe(false); // preventDefault was called
    const text = fireEvent.dragOver(zone, dragData([], ['text/plain']));
    expect(text).toBe(true);
  });
});

describe('dropping', () => {
  it('hands the real path of a dropped program to the find flow, and the overlay goes away', () => {
    bridge({ 'coolapp.exe': 'D:\\Portable\\coolapp.exe' });
    const { zone, onProgramFile } = mount();
    fireEvent.dragEnter(zone, dragData([]));
    fireEvent.drop(zone, dragData(fileList('coolapp.exe')));
    expect(onProgramFile).toHaveBeenCalledTimes(1);
    expect(onProgramFile).toHaveBeenCalledWith('D:\\Portable\\coolapp.exe');
    expect(screen.queryByText('Drop a program or shortcut to find it')).toBeNull();
  });

  it('accepts a shortcut', () => {
    bridge({ 'Acme.lnk': 'C:\\Users\\me\\Desktop\\Acme.lnk' });
    const { zone, onProgramFile } = mount();
    fireEvent.drop(zone, dragData(fileList('Acme.lnk')));
    expect(onProgramFile).toHaveBeenCalledWith('C:\\Users\\me\\Desktop\\Acme.lnk');
  });

  it('declines a file that is not a program or shortcut, with the reason, and finds nothing', () => {
    bridge({ 'notes.txt': 'C:\\notes.txt' });
    const { zone, onProgramFile } = mount();
    fireEvent.drop(zone, dragData(fileList('notes.txt')));
    expect(onProgramFile).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toBe('Only a program (.exe) or a shortcut (.lnk) can be dropped here.');
  });

  it('declines, with a reason, a file whose real path cannot be read (no desktop bridge)', () => {
    const { zone, onProgramFile } = mount();
    fireEvent.drop(zone, dragData(fileList('coolapp.exe')));
    expect(onProgramFile).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toBe("Prune couldn't read where that file is.");
  });

  it('clears an earlier refusal when the next drop works', () => {
    bridge({ 'coolapp.exe': 'D:\\coolapp.exe' });
    const { zone, onProgramFile } = mount();
    fireEvent.drop(zone, dragData(fileList('notes.txt')));
    expect(screen.queryByRole('alert')).not.toBeNull();
    fireEvent.drop(zone, dragData(fileList('coolapp.exe')));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(onProgramFile).toHaveBeenCalledWith('D:\\coolapp.exe');
  });

  it('ignores a drop that carries no files (text, a link)', () => {
    const { zone, onProgramFile } = mount();
    const proceeded = fireEvent.drop(zone, dragData([], ['text/plain']));
    expect(proceeded).toBe(true);
    expect(onProgramFile).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('a refusal goes away by itself', () => {
    vi.useFakeTimers();
    const { zone } = mount();
    fireEvent.drop(zone, dragData(fileList('notes.txt')));
    expect(screen.queryByRole('alert')).not.toBeNull();
    act(() => { vi.advanceTimersByTime(9000); });
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('the markup', () => {
  it('has no native hover text', () => {
    const { zone, container } = mount();
    fireEvent.dragEnter(zone, dragData([]));
    expect(container.querySelectorAll('[title]')).toHaveLength(0);
  });
});
