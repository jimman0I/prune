// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import AnimatedNumber from './AnimatedNumber.jsx';

let now;
let queue;

beforeEach(() => {
  now = 0;
  queue = [];
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  vi.stubGlobal('requestAnimationFrame', (cb) => { queue.push(cb); return queue.length; });
  vi.stubGlobal('cancelAnimationFrame', () => {});
  window.matchMedia = vi.fn(() => ({ matches: false }));
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('AnimatedNumber', () => {
  it('renders the initial value formatted with the default locale format', () => {
    render(<AnimatedNumber value={1234567} />);
    expect(screen.getByText((1234567).toLocaleString())).toBeTruthy();
  });

  it('uses a custom format and settles exactly on the new value', () => {
    const format = (n) => `#${n}`;
    const { rerender } = render(<AnimatedNumber value={10} format={format} duration={100} />);
    expect(screen.getByText('#10')).toBeTruthy();
    rerender(<AnimatedNumber value={99} format={format} duration={100} />);
    now = 1000;
    act(() => { queue.splice(0).forEach((cb) => cb(now)); });
    expect(screen.getByText('#99')).toBeTruthy();
  });

  it('formats a rounded value while in flight', () => {
    const seen = [];
    const format = (n) => { seen.push(n); return String(n); };
    const { rerender } = render(<AnimatedNumber value={0} format={format} duration={100} />);
    rerender(<AnimatedNumber value={1} format={format} duration={100} />);
    now = 40;
    act(() => { queue.splice(0).forEach((cb) => cb(now)); });
    expect(seen.every(Number.isInteger)).toBe(true);
  });

  it.each([[NaN], [undefined], [null], [Infinity]])('renders an em dash for %s without crashing', (value) => {
    const { container } = render(<AnimatedNumber value={value} />);
    expect(container.textContent).toBe('—');
  });
});
