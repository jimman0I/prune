// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { isCopyable } from '../testSupport/copyable.js';
import { LargestFilesView } from './DiskMap.jsx';

/** The Disk Map's largest-files list.
 *
 * Text selection is off across the app. A file's full path stays on,
 * because a list of the biggest files on the drive is mostly read in
 * order to go and find them. The name above it is a label and stays off
 * like every other label. */

afterEach(cleanup);

describe('the largest-files list', () => {
  it('leaves each full path copyable, but not the name above it', () => {
    render(
      <LargestFilesView
        files={[{ name: 'game.pak', size: 5 * 1024 ** 3, fullPath: 'D:\\Games\\Big\\game.pak' }]}
        icons={{}}
      />
    );

    expect(isCopyable(screen.getByText('D:\\Games\\Big\\game.pak'))).toBe(true);
    expect(isCopyable(screen.getByText('game.pak'))).toBe(false);
  });
});
