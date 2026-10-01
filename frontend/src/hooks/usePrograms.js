import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchPrograms, fetchProgramIcons, fetchProgramSizes, fetchProgramVersions,
  fetchProgramInstallDates, fetchStoreApps, fetchBrowserExtensions,
  fetchPackageIcons, fetchRunningPrograms
} from '../lib/api.js';
import { mergeMeasuredSizes } from '../lib/mergeSizes.js';
import { mergeBinaryVersions } from '../lib/mergeVersions.js';
import { mergeInstallDates } from '../lib/mergeInstallDates.js';
import { keys } from '../lib/queryClient.js';

/** Everything the program list is made of, from eight separate endpoints.
 *
 * It is eight requests because the backend deliberately splits them: the
 * list itself takes about a second, icons open ninety executables, and
 * the measured sizes walk real install folders for thirteen. Making the
 * list wait on any of that would trade a fast list for a complete one.
 *
 * The pieces are kept as separate queries and merged at render, which is
 * not a stylistic choice -- it fixes a real bug the previous version had
 * to work around by hand. Every one of these endpoints caches on the
 * backend, so a warmed one replies in under two milliseconds while the
 * program list is still a second away. Folded into a single piece of
 * state, the fast reply merged into an empty array and the list that
 * arrived afterwards wiped it out; versions the backend had correctly
 * found never reached the screen. Separate caches cannot express that
 * failure: the merge is derived from whatever has arrived so far, so the
 * order they land in cannot matter.
 *
 * Only the list itself is fatal. A failed icon, size or version fetch
 * leaves its rows with the honest blank they had before -- decoration
 * must never be able to empty the screen.
 */

/** The decorating queries share this: a failure is not worth a retry
 * storm, and their absence is a supported state rather than an error. */
const DECORATION = { retry: 1 };

/** `loadDecorations`: false defers every query below that only Applications
 * itself can show -- icons, versions, install dates, extensions, and the
 * running-process poll -- until that screen has actually been opened once
 * (App.jsx passes `visited.has('applications')`, the same tracking it
 * already keeps for which screens to mount).
 *
 * The list, the measured sizes and the Store apps stay eager regardless:
 * Dashboard's own space breakdown and largest-programs list need them
 * immediately, and `sizesSettled` below already gates Dashboard's drawing
 * on the two that matter to it. Nothing downstream of those three changes.
 *
 * The running-process query is the one worth deferring most: unlike the
 * others, it is not a one-time read but a poll every 15 seconds, for as
 * long as the app is open -- paid forever, in a session that may never
 * open Applications at all, for a badge only that screen shows. */
export function useProgramData({ loadDecorations = true } = {}) {
  const queryClient = useQueryClient();
  const DEFERRED = { ...DECORATION, enabled: loadDecorations };

  const programsQuery = useQuery({ queryKey: keys.programs, queryFn: fetchPrograms });
  const storeQuery = useQuery({ queryKey: keys.storeApps, queryFn: fetchStoreApps, ...DECORATION });
  const sizesQuery = useQuery({ queryKey: keys.programSizes, queryFn: fetchProgramSizes, ...DECORATION });
  const versionsQuery = useQuery({ queryKey: keys.programVersions, queryFn: fetchProgramVersions, ...DEFERRED });
  const datesQuery = useQuery({ queryKey: keys.installDates, queryFn: fetchProgramInstallDates, ...DEFERRED });
  const extensionsQuery = useQuery({ queryKey: keys.extensions, queryFn: fetchBrowserExtensions, ...DEFERRED });

  // Two icon sources, one map. They come from genuinely different places
  // -- extracted from binaries, versus files sitting inside a package or
  // extension folder -- and the old code merged them into shared state
  // with a note that whichever landed second must not drop the first.
  // As two caches merged at render, that hazard does not exist.
  const programIconsQuery = useQuery({ queryKey: keys.programIcons, queryFn: fetchProgramIcons, ...DEFERRED });
  const packageIconsQuery = useQuery({ queryKey: keys.packageIcons, queryFn: fetchPackageIcons, ...DEFERRED });

  // The one thing that changes while the app is open. Everything else
  // here is stable for the session, so this is the only query that polls.
  // staleTime 0 because an interval on cached-as-fresh data never fires.
  const runningQuery = useQuery({
    queryKey: keys.running,
    queryFn: fetchRunningPrograms,
    refetchInterval: 15000,
    staleTime: 0,
    ...DEFERRED
  });

  const programs = useMemo(() => [
    ...mergeInstallDates(
      mergeBinaryVersions(
        mergeMeasuredSizes(programsQuery.data ?? [], sizesQuery.data ?? {}),
        versionsQuery.data ?? {}
      ),
      datesQuery.data ?? {}
    ),
    // Appended rather than merged: a Store app is not a registry entry
    // and none of the three fallbacks above apply to it -- it already
    // carries its own name, version and measured size.
    ...(storeQuery.data ?? [])
  ], [programsQuery.data, sizesQuery.data, versionsQuery.data, datesQuery.data, storeQuery.data]);

  const icons = useMemo(
    () => ({ ...(packageIconsQuery.data ?? {}), ...(programIconsQuery.data ?? {}) }),
    [packageIconsQuery.data, programIconsQuery.data]
  );

  const totalSize = useMemo(
    () => programs.reduce((sum, program) => sum + (program.sizeBytes || 0), 0),
    [programs]
  );

  return {
    programs,
    icons,
    totalSize,
    extensions: extensionsQuery.data ?? [],
    running: runningQuery.data ?? {},
    loading: programsQuery.isPending,
    /** True once the list, the measured sizes and the Store apps have each
     * answered (or failed). The sizes come from a slower walk than the list,
     * so a total taken before this is a number that changes later. */
    sizesSettled: !programsQuery.isPending && !sizesQuery.isPending && !storeQuery.isPending,
    // Only the list can fail the screen.
    error: programsQuery.error ? programsQuery.error.message : null,
    /** Re-reads the list after something is removed. The batch uninstall
     * calls it: the rows on screen would otherwise still show programs
     * that are no longer installed. Invalidating rather than refetching
     * so anything else observing the same key updates with it. */
    refresh: () => queryClient.invalidateQueries({ queryKey: keys.programs })
  };
}
