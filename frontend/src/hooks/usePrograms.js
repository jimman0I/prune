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

export function useProgramData() {
  const queryClient = useQueryClient();

  const programsQuery = useQuery({ queryKey: keys.programs, queryFn: fetchPrograms });
  const storeQuery = useQuery({ queryKey: keys.storeApps, queryFn: fetchStoreApps, ...DECORATION });
  const sizesQuery = useQuery({ queryKey: keys.programSizes, queryFn: fetchProgramSizes, ...DECORATION });
  const versionsQuery = useQuery({ queryKey: keys.programVersions, queryFn: fetchProgramVersions, ...DECORATION });
  const datesQuery = useQuery({ queryKey: keys.installDates, queryFn: fetchProgramInstallDates, ...DECORATION });
  const extensionsQuery = useQuery({ queryKey: keys.extensions, queryFn: fetchBrowserExtensions, ...DECORATION });

  // Two icon sources, one map. They come from genuinely different places
  // -- extracted from binaries, versus files sitting inside a package or
  // extension folder -- and the old code merged them into shared state
  // with a note that whichever landed second must not drop the first.
  // As two caches merged at render, that hazard does not exist.
  const programIconsQuery = useQuery({ queryKey: keys.programIcons, queryFn: fetchProgramIcons, ...DECORATION });
  const packageIconsQuery = useQuery({ queryKey: keys.packageIcons, queryFn: fetchPackageIcons, ...DECORATION });

  // The one thing that changes while the app is open. Everything else
  // here is stable for the session, so this is the only query that polls.
  // staleTime 0 because an interval on cached-as-fresh data never fires.
  const runningQuery = useQuery({
    queryKey: keys.running,
    queryFn: fetchRunningPrograms,
    refetchInterval: 15000,
    staleTime: 0,
    ...DECORATION
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
    // Only the list can fail the screen.
    error: programsQuery.error ? programsQuery.error.message : null,
    /** Re-reads the list after something is removed. The batch uninstall
     * calls it: the rows on screen would otherwise still show programs
     * that are no longer installed. Invalidating rather than refetching
     * so anything else observing the same key updates with it. */
    refresh: () => queryClient.invalidateQueries({ queryKey: keys.programs })
  };
}
