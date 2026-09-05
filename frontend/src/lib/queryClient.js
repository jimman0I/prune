import { QueryClient } from '@tanstack/react-query';

/** The app's one QueryClient, and the defaults it needs.
 *
 * The defaults matter more here than in a typical web app, because almost
 * nothing this app fetches is cheap. Reading every installed program takes
 * about a second; extracting their icons opens ninety executables; the
 * measured install sizes walk real folders for thirteen. Refetching any of
 * that on a window focus would make the app feel slower the moment you
 * alt-tabbed back to it.
 *
 * So: nothing refetches on its own. This is a desktop tool inspecting a
 * machine that changes on the scale of minutes, not a dashboard tailing a
 * live feed, and every screen that needs fresher data has an explicit
 * control that invalidates its own key. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Five minutes. Long enough that switching tabs is instant, short
      // enough that a program installed while the app is open shows up
      // without a manual refresh.
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      // One retry, and never for a cancel. An aborted scan is a decision
      // the user just made; retrying it would restart the very thing they
      // stopped.
      retry: (failureCount, error) => {
        if (error?.name === 'AbortError') return false;
        return failureCount < 1;
      }
    },
    mutations: {
      // Removals, restores and toggles are never retried automatically.
      // Repeating a destructive call because the reply was slow is how a
      // retry policy deletes something twice.
      retry: false
    }
  }
});

/** Query keys in one place, so a typo cannot silently create a second
 * cache entry that never invalidates alongside the first. */
export const keys = {
  programs: ['programs'],
  programIcons: ['programs', 'icons'],
  packageIcons: ['programs', 'packageIcons'],
  programSizes: ['programs', 'sizes'],
  programVersions: ['programs', 'versions'],
  installDates: ['programs', 'installDates'],
  storeApps: ['programs', 'store'],
  extensions: ['programs', 'extensions'],
  running: ['programs', 'running'],
  diskHealth: ['disk', 'health'],
  startupItems: ['startup', 'items'],
  startupIcons: ['startup', 'icons'],
  quarantine: ['quarantine'],
  settings: ['settings'],
  diskSpace: ['disk', 'space'],
  deepCleanRules: ['deepClean', 'rules']
};
