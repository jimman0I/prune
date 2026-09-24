// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import Page from './Page.jsx';

afterEach(cleanup);

describe('Page', () => {
  it('owns the gutters and the maximum width, and renders its children', () => {
    render(<Page><h1>Title</h1></Page>);
    const page = screen.getByRole('heading', { name: 'Title' }).parentElement;
    expect(page.className.split(' ')).toEqual(expect.arrayContaining(['px-12', 'py-10', 'max-w-[1400px]']));
  });

  it('lets a screen add layout classes on top without losing the shared ones', () => {
    render(<Page className="h-full flex flex-col min-h-0"><h1>Title</h1></Page>);
    const page = screen.getByRole('heading', { name: 'Title' }).parentElement;
    expect(page.className.split(' ')).toEqual(expect.arrayContaining(['px-12', 'max-w-[1400px]', 'h-full', 'flex', 'min-h-0']));
  });
});
