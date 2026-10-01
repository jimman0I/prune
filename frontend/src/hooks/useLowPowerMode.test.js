// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { useLowPowerMode, LOW_POWER_ATTRIBUTE } from './useLowPowerMode.js';

const root = document.documentElement;
const stamped = () => root.hasAttribute(LOW_POWER_ATTRIBUTE);

afterEach(() => {
  cleanup();
  root.removeAttribute(LOW_POWER_ATTRIBUTE);
});

describe('useLowPowerMode', () => {
  it('stamps the attribute when enabled', () => {
    renderHook(() => useLowPowerMode(true));
    expect(stamped()).toBe(true);
  });

  it('does not stamp it when disabled', () => {
    renderHook(() => useLowPowerMode(false));
    expect(stamped()).toBe(false);
  });

  it('follows a later change from false to true and back', () => {
    const { rerender } = renderHook(({ enabled }) => useLowPowerMode(enabled), {
      initialProps: { enabled: false }
    });
    expect(stamped()).toBe(false);

    rerender({ enabled: true });
    expect(stamped()).toBe(true);

    rerender({ enabled: false });
    expect(stamped()).toBe(false);
  });

  it('removes its attribute on unmount, even if it was on', () => {
    const { unmount } = renderHook(() => useLowPowerMode(true));
    expect(stamped()).toBe(true);

    unmount();

    expect(stamped()).toBe(false);
  });
});

describe('the stylesheet side of it', () => {
  const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8');

  it('collapses animation and transition durations the same way reduced motion does', () => {
    expect(css).toContain(':root[data-low-power] *,');
    expect(css).toMatch(/:root\[data-low-power\] \*,\s*\n:root\[data-low-power\] \*::before,\s*\n:root\[data-low-power\] \*::after \{/);
  });

  it('flattens the glass panels and hides the aurora, the same way reduced transparency does', () => {
    expect(css).toMatch(/:root\[data-low-power\] \.glass-panel,\s*\n:root\[data-low-power\] \.diskmap-tooltip \{/);
    expect(css).toMatch(/:root\[data-low-power\] body::before,\s*\n:root\[data-low-power\] body::after \{ display: none; \}/);
  });

  it('stills the Disk Map scan bar shimmer', () => {
    expect(css).toContain(':root[data-low-power] .scan-shimmer { animation: none; background: none; }');
  });

  it('matches the attribute name the hook exports', () => {
    expect(LOW_POWER_ATTRIBUTE).toBe('data-low-power');
  });
});
