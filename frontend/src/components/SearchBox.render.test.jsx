// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { screen, cleanup, fireEvent } from '@testing-library/react';
import { renderScreen } from '../testSupport/renderScreen.jsx';
import { SearchBox } from './SearchBox.jsx';

vi.mock('../lib/api.js', () => ({ fetchSettings: vi.fn(async () => ({})), updateSettings: vi.fn() }));

afterEach(cleanup);

describe('the search box', () => {
  it('is a labelled text field with a hint about its forms', async () => {
    renderScreen(<SearchBox value="" onChange={() => {}} />);
    const input = await screen.findByRole('textbox', { name: 'Search names' });
    expect(input.getAttribute('placeholder')).toBe('Text, * ? or /regex/');
    expect(input.hasAttribute('aria-invalid')).toBe(false);
  });

  it('reports typing', async () => {
    const onChange = vi.fn();
    renderScreen(<SearchBox value="" onChange={onChange} />);
    fireEvent.change(await screen.findByRole('textbox'), { target: { value: '*.pak' } });
    expect(onChange).toHaveBeenCalledWith('*.pak');
  });

  it('offers a clear button only when there is something to clear, and it clears', async () => {
    const onChange = vi.fn();
    renderScreen(<SearchBox value="" onChange={onChange} />);
    await screen.findByRole('textbox');
    expect(screen.queryByRole('button', { name: 'Clear search' })).toBeNull();
    cleanup();

    renderScreen(<SearchBox value="abc" onChange={onChange} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Clear search' }));
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('clears on Escape', async () => {
    const onChange = vi.fn();
    renderScreen(<SearchBox value="abc" onChange={onChange} />);
    fireEvent.keyDown(await screen.findByRole('textbox'), { key: 'Escape' });
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('says so, and marks the field invalid, for a pattern that does not parse', async () => {
    renderScreen(<SearchBox value="/(/" onChange={() => {}} invalid />);
    const input = await screen.findByRole('textbox');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect((await screen.findByRole('alert')).textContent).toBe('That pattern is not valid.');
  });

  it('uses no native title attribute', async () => {
    const { container } = renderScreen(<SearchBox value="abc" onChange={() => {}} invalid />);
    await screen.findByRole('textbox');
    expect(container.querySelector('[title]')).toBeNull();
  });
});
