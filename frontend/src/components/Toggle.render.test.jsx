// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { useState } from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MotionConfig } from 'framer-motion';
import Toggle from './Toggle.jsx';

/** The shared pill switch. The spring is visual; what must never change is
 * the accessible contract the Settings tests and screen readers rely on. */
function Harness(props) {
  return (
    <MotionConfig reducedMotion="always">
      <Toggle {...props} />
    </MotionConfig>
  );
}

function Stateful({ initial = false, ...rest }) {
  const [on, setOn] = useState(initial);
  return <Harness checked={on} onChange={() => setOn((v) => !v)} {...rest} />;
}

describe('Toggle', () => {
  afterEach(cleanup);

  it('is a named switch reflecting checked', () => {
    const { rerender } = render(<Harness checked={false} onChange={() => {}} label="Tray" />);
    const sw = screen.getByRole('switch', { name: 'Tray' });
    expect(sw.getAttribute('aria-checked')).toBe('false');
    rerender(<Harness checked onChange={() => {}} label="Tray" />);
    expect(screen.getByRole('switch', { name: 'Tray' }).getAttribute('aria-checked')).toBe('true');
  });

  it('calls onChange when clicked', async () => {
    const onChange = vi.fn();
    render(<Harness checked={false} onChange={onChange} label="Tray" />);
    await userEvent.setup().click(screen.getByRole('switch', { name: 'Tray' }));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('still toggles under reduced motion', async () => {
    render(<Stateful label="Tray" />);
    const user = userEvent.setup();
    const sw = screen.getByRole('switch', { name: 'Tray' });
    await user.click(sw);
    expect(sw.getAttribute('aria-checked')).toBe('true');
    await user.click(sw);
    expect(sw.getAttribute('aria-checked')).toBe('false');
  });

  it('disabled means disabled: no click, no onChange', async () => {
    const onChange = vi.fn();
    render(<Harness checked={false} onChange={onChange} label="Tray" disabled />);
    const sw = screen.getByRole('switch', { name: 'Tray' });
    expect(sw.disabled).toBe(true);
    await userEvent.setup().click(sw);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('emits no accessible name when no label is given', () => {
    render(<Harness checked={false} onChange={() => {}} size="sm" />);
    expect(screen.getByRole('switch').hasAttribute('aria-label')).toBe(false);
  });

  it('keeps the two pill sizes', () => {
    const { rerender } = render(<Harness checked={false} onChange={() => {}} />);
    expect(screen.getByRole('switch').className).toContain('w-10 h-6');
    rerender(<Harness checked={false} onChange={() => {}} size="sm" />);
    expect(screen.getByRole('switch').className).toContain('w-[38px] h-[21px]');
  });
});
