import { useQuery } from '@tanstack/react-query';
import { fetchDrives } from '../lib/api.js';
import { keys } from '../lib/queryClient.js';

/** The local drives the Disk Map can offer, and which one holds Windows.
 *
 * Its own hook rather than part of useSystemQueries: only the Disk Map reads
 * it, and a failure here must never block the screen. `drives` stays null
 * when the list could not be read, and the Disk Map then behaves exactly as
 * it did before it knew about other drives -- C: only. */
export function useDrives() {
  const query = useQuery({
    queryKey: keys.drives,
    // Called inside a function rather than handed over by reference, so the
    // list failing for ANY reason -- including its endpoint being absent --
    // lands in the query's error state instead of throwing during render.
    queryFn: () => fetchDrives(),
    retry: 1,
    // A USB stick can be plugged in while the app is open.
    staleTime: 30_000
  });
  return {
    drives: query.data?.drives ?? null,
    systemDrive: query.data?.systemDrive ?? null,
    loading: query.isPending
  };
}
