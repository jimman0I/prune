// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderScreen } from '../testSupport/renderScreen.jsx';

/** Clean recommended sits on the Dashboard, beside the quiet row. Its own
 * behaviour is pinned in CleanRecommendedCard.render.test.jsx; this only checks
 * that the front page carries it. */

vi.mock('../lib/api.js', () => ({
  fetchDiskSpace: vi.fn(async () => ({ freeBytes: 100, totalBytes: 500 })),
  fetchDiskHealth: vi.fn(async () => ({ disks: [] })),
  unlockDiskWear: vi.fn(),
  fetchUninstallHistory: vi.fn(async () => []),
  fetchAutomation: vi.fn(async () => ({ enabled: false, nextRun: null, missed: 0 })),
  streamDeepCleanScan: vi.fn(() => new Promise(() => {})),
  fetchDeepCleanRules: vi.fn(async () => []),
  fetchSettings: vi.fn(async () => ({})),
  updateSettings: vi.fn()
}));

const Dashboard = (await import('./Dashboard.jsx')).default;

beforeEach(() => vi.clearAllMocks());

describe('the Dashboard', () => {
  it('carries Clean recommended, and does not start a measurement by itself', async () => {
    const { streamDeepCleanScan } = await import('../lib/api.js');
    renderScreen(<Dashboard programs={[]} programsMeasured onNavigate={() => {}} />);
    expect(await screen.findByRole('heading', { level: 2, name: 'Clean recommended' })).toBeTruthy();
    expect(streamDeepCleanScan).not.toHaveBeenCalled();
  });
});
