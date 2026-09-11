// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderScreen } from '../testSupport/renderScreen.jsx';
import NavRail from './NavRail.jsx';

/** NavRail's labels follow the chosen language, buttons and flyouts
 * alike -- the property NavRail.render.test.jsx's English assertions
 * cannot show, since English is also the fallback they render under. */

const fetchSettings = vi.fn();
vi.mock('../lib/api.js', () => ({ fetchSettings: (...a) => fetchSettings(...a), updateSettings: vi.fn() }));

describe('the rail in another language', () => {
  it('renders every destination\'s name in Greek, aria-label included', async () => {
    fetchSettings.mockResolvedValue({ language: 'el' });
    renderScreen(<NavRail screen="dashboard" onNavigate={() => {}} />);

    const dashboard = await screen.findByRole('button', { name: 'Πίνακας ελέγχου' });
    expect(dashboard).toBeTruthy();
    for (const name of ['Χάρτης δίσκου', 'Εφαρμογές', 'Καραντίνα', 'Ρυθμίσεις', 'Εκκίνηση', 'Διπλότυπα', 'Βαθύς καθαρισμός']) {
      expect(screen.getByRole('button', { name })).toBeTruthy();
    }
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Dashboard' })).toBeNull());
  });
});
