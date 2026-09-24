// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderScreen } from '../testSupport/renderScreen.jsx';

/** The live gauges' colour and layout rules.
 *
 * jsdom evaluates no CSS, so the light-mode visibility of the track ring is
 * asserted as what it depends on -- the stroke is the theme token, not a
 * white alpha that vanishes on a pale ground -- and the rest as the class
 * and stroke values the components emit. */

const fetchResources = vi.fn();
vi.mock('../lib/api.js', () => ({
  fetchResources: (...a) => fetchResources(...a),
  fetchSettings: vi.fn(async () => ({})),
  updateSettings: vi.fn()
}));

const ResourceMonitor = (await import('./ResourceMonitor.jsx')).default;

const MB = 1024 * 1024;

beforeEach(() => {
  vi.clearAllMocks();
  fetchResources.mockResolvedValue({
    cpuPercent: 30, cores: 8,
    ram: { percent: 40, usedBytes: 4 * 1024 ** 3, totalBytes: 16 * 1024 ** 3 },
    diskBytesPerSec: 10 * MB
  });
});

const rings = (container) => [...container.querySelectorAll('svg')];
const trackOf = (svg) => svg.querySelector('circle');
const arcOf = (svg) => svg.querySelectorAll('circle')[1];

describe('the gauge tracks', () => {
  it('use the theme token, so the empty ring is visible in light mode too', async () => {
    const { container } = renderScreen(<ResourceMonitor />);
    await screen.findByText('8 cores');
    const svgs = rings(container);
    expect(svgs).toHaveLength(3);
    for (const svg of svgs) {
      expect(trackOf(svg).getAttribute('stroke')).toBe('var(--surface-strong)');
    }
  });
});

describe('the disk gauge colour', () => {
  it('is not the primary accent, which is reserved for actions', async () => {
    const { container } = renderScreen(<ResourceMonitor />);
    await screen.findByText('8 cores');
    const disk = rings(container)[2];
    expect(arcOf(disk).getAttribute('stroke')).toBe('var(--text-secondary)');
  });

  it('turns amber when the disk is nearly saturated', async () => {
    fetchResources.mockResolvedValue({ cpuPercent: 10, cores: 8, ram: { percent: 10 }, diskBytesPerSec: 480 * MB });
    const { container } = renderScreen(<ResourceMonitor />);
    await screen.findByText('8 cores');
    expect(arcOf(rings(container)[2]).getAttribute('stroke')).toBe('var(--warning)');
  });
});

describe('CPU and memory', () => {
  it('keep their own hues below 85% and go amber from there', async () => {
    fetchResources.mockResolvedValue({ cpuPercent: 90, cores: 8, ram: { percent: 40 }, diskBytesPerSec: 0 });
    const { container } = renderScreen(<ResourceMonitor />);
    await screen.findByText('8 cores');
    const [cpu, memory] = rings(container);
    expect(arcOf(cpu).getAttribute('stroke')).toBe('var(--warning)');
    expect(arcOf(memory).getAttribute('stroke')).toBe('var(--accent-purple)');
  });
});

describe('the panel width', () => {
  it('is not fixed, so the Dashboard can stack it and it can fill a narrow window', async () => {
    const { container } = renderScreen(<ResourceMonitor />);
    await screen.findByText('8 cores');
    const panel = container.querySelector('.glass-panel');
    expect(panel.className).not.toMatch(/w-\[\d+px\]/);
    expect(panel.className).not.toContain('shrink-0');
  });
});
