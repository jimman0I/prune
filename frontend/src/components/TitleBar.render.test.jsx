// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import TitleBar from './TitleBar.jsx';

/** The window's own title bar.
 *
 * A small component with an unusual number of ways to break silently.
 * Everything asserted here is something that renders perfectly in the dev
 * server and fails only in the packaged window, or fails only on a machine
 * whose display scaling or system language is not this one's -- which is
 * to say, exactly the failures no amount of looking at it locally would
 * catch.
 */

afterEach(cleanup);

const styleOf = () => screen.getByRole('banner').getAttribute('style');

describe('the bar', () => {
  it('shows the product mark and name', () => {
    render(<TitleBar />);
    expect(screen.getByText('Prune')).toBeTruthy();
  });

  it('loads the logo by a RELATIVE path', () => {
    /* "./logo.png", not "/logo.png".
     *
     * The packaged app loads over file://, where a root-relative path
     * resolves against the filesystem root -- file:///C:/logo.png -- and
     * Vite's base:'./' rewrites only what it processes itself, not a
     * string literal in JSX. So the leading dot is the whole difference
     * between a logo and a broken-image glyph, and only once packaged.
     * The nav rail learned this the same way. */
    render(<TitleBar />);
    const logo = document.querySelector('img');

    expect(logo.getAttribute('src')).toBe('./logo.png');
  });

  /* Not asserted here: that the strip is a drag region.
   *
   * `WebkitAppRegion: 'drag'` is what lets the window be moved at all
   * once the native title bar is hidden, and it is the single most
   * important thing this component does -- but jsdom does not model
   * `-webkit-app-region`, so React sets it and the style attribute comes
   * back holding only the padding. A test asserting on it would either
   * fail against correct code or pass by reading the source as text.
   * It is verified by dragging the real window instead. */
});

describe('the space kept clear for Windows\' own buttons', () => {
  it('asks the browser for the overlay width by its real name', () => {
    /* An earlier version asked for `titlebar-area-inset-right`, which is
     * not a thing in the Window Controls Overlay spec. env() falls back
     * SILENTLY on an unknown name, so the hard-coded fallback was doing
     * all the work while the comment beside it claimed the browser was
     * being consulted -- close enough to right on this machine to look
     * correct, and wrong on any other scaling or system language.
     *
     * Caught by reading the computed padding back out of the running
     * window and finding 148px where 145px was expected. Asserted on the
     * property name because a typo in it has no symptom. */
    render(<TitleBar />);

    expect(styleOf()).toMatch(/env\(titlebar-area-width/);
    expect(styleOf()).not.toMatch(/titlebar-area-inset/);
  });

  it('still keeps room when there is no overlay at all', () => {
    // The dev server runs in an ordinary browser tab, where env() has
    // nothing to answer with. A fallback of zero would put the app's own
    // content under buttons that are not there, which is harmless -- but
    // the same expression is what runs in the packaged window if the
    // overlay is ever unavailable, and there it would put the name under
    // the close button.
    render(<TitleBar />);
    expect(styleOf()).toMatch(/100%\s*-\s*137px/);
  });
});

describe('the logo, which has to line up with the nav rail underneath it', () => {
  it('centers on the same x as the rail\'s icon column, not just visually close', () => {
    /* jsdom does not lay anything out -- getBoundingClientRect returns
     * zeros for everything, so this can't be caught by measuring the
     * rendered DOM the way a real browser test could. Read out of the
     * two source files instead, the same cross-file-agreement pattern
     * the height test below uses.
     *
     * Regression: pl-4 (16px) put the 20px logo's own center at 26
     * (16 + 20/2), ten pixels left of the nav rail's icon buttons, which
     * sit centered in the rail's fixed 72px column -- center 36. */
    render(<TitleBar />);
    const paddingMatch = screen.getByRole('banner').className.match(/pl-\[(\d+)px\]/);
    expect(paddingMatch, 'expected an arbitrary pl-[Npx] class on the title bar').toBeTruthy();
    const logoLeft = Number(paddingMatch[1]);

    const logo = document.querySelector('img');
    const widthMatch = logo.className.match(/w-(\d+)/);
    // Tailwind's w-5 is 1.25rem = 20px at the default root size.
    const logoWidth = Number(widthMatch[1]) * 4;
    const logoCenter = logoLeft + logoWidth / 2;

    const navPath = resolve(process.cwd(), 'src/components/NavRail.jsx');
    const navSource = readFileSync(navPath, 'utf8');
    const railWidthMatch = navSource.match(/<nav[^>]*\bw-\[(\d+)px\]/);
    expect(railWidthMatch, 'expected an arbitrary w-[Npx] rail width in NavRail.jsx').toBeTruthy();
    const railCenter = Number(railWidthMatch[1]) / 2;

    expect(logoCenter).toBe(railCenter);
  });
});

describe('the height, which two files have to agree on', () => {
  it('matches titleBarOverlay.height in the Electron main process', () => {
    /* Two numbers describing one strip, in two files that are never read
     * together.
     *
     * Windows draws its buttons into a band whose height main.cjs
     * declares; this component draws the app's half of the same band.
     * If the CSS is taller the buttons float in a dead zone, and if it is
     * shorter they overhang the content below. Neither throws, and both
     * look almost right.
     *
     * Read out of the real file rather than duplicated as a constant --
     * a constant copied here would agree with itself forever. */
    render(<TitleBar />);
    expect(screen.getByRole('banner').className).toMatch(/(^|\s)h-10(\s|$)/);

    // From the vitest root (frontend/), not from import.meta.url -- which
    // is not a file: URL under the jsdom environment's transform.
    const mainPath = resolve(process.cwd(), '../electron/main.cjs');
    const declared = readFileSync(mainPath, 'utf8').match(/titleBarOverlay:\s*\{[\s\S]*?height:\s*(\d+)/);

    expect(declared, 'titleBarOverlay.height not found in electron/main.cjs').toBeTruthy();
    // h-10 is Tailwind's 2.5rem, which is 40px at the default root size.
    expect(Number(declared[1])).toBe(40);
  });
});
