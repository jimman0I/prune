import { afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../hooks/useToasts.jsx';

/** Rendering a screen the way the app mounts it.
 *
 * Every screen in this app reads through TanStack Query, so rendering one
 * bare throws "No QueryClient set" before a single assertion runs. This
 * wraps it in a provider, and a FRESH client per test -- the app's own
 * singleton in lib/queryClient.js caches for five minutes, which across
 * tests means one test's fixture answering another test's render.
 *
 * The client's own retry policy is off here. The app retries once, which
 * is right for a real machine and wrong for a test: a case that asserts
 * an error state would sit through a retry first, and a failing fetch
 * would report as a timeout rather than as the failure it is.
 *
 * Cleanup is explicit because this project runs vitest without globals
 * (every test imports describe/it/expect by name), and React Testing
 * Library only auto-registers its afterEach hook when they are on. Left
 * out, each test's DOM would still be mounted for the next one, and
 * getByText would start finding two of everything.
 */
afterEach(cleanup);

export function makeTestClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false }
    }
  });
}

/** Both providers App.jsx mounts, in the same order.
 *
 * ToastProvider is here rather than opt-in because useToasts throws
 * outside it, so a screen that raises a toast anywhere in its tree cannot
 * be rendered without one -- and which screens those are is not something
 * a test author should have to know before the failure tells them. */
export function renderScreen(ui, { client = makeTestClient() } = {}) {
  const result = render(
    <QueryClientProvider client={client}>
      <ToastProvider>{ui}</ToastProvider>
    </QueryClientProvider>
  );
  return { ...result, client };
}
