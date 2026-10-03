import { useQuery } from '@tanstack/react-query';
import { fetchAutoScans, loadSavedScan } from '../lib/api.js';
import { keys } from '../lib/queryClient.js';
import { expandArchive } from '../lib/compactTree.js';
import { rootOfDrive } from '../lib/driveRoot.js';

/** A drive's automatic scans -- the latest two -- and, when asked for, the
 * latest one expanded into a tree the Disk Map can draw.
 *
 * `enabled` is the Settings switch (and "settings have loaded"). `wantTree` is
 * whether the picture is actually needed: not once a live scan of the drive
 * has replaced it. A failure to read either is no scan, never an error on the
 * screen -- the Disk Map then simply opens on its drive chooser as it always did.
 *
 * The expanded tree is what is cached, not the archive it came from: for a
 * drive with hundreds of thousands of folders holding both would double the
 * memory for nothing. */
export function useLastDiskScan(letter, { enabled, wantTree, aggregateLabel, language }) {
  const active = Boolean(enabled && letter);
  const list = useQuery({
    queryKey: keys.autoScans(letter),
    enabled: active,
    staleTime: Infinity,
    retry: false,
    queryFn: () => fetchAutoScans(letter)
  });
  const scans = active ? list.data?.scans ?? [] : [];
  const latest = scans[0] ?? null;
  const previous = scans[1] ?? null;

  const needTree = active && wantTree && Boolean(latest);
  const tree = useQuery({
    queryKey: keys.autoScanTree(latest?.id, language),
    enabled: needTree,
    staleTime: Infinity,
    gcTime: 2 * 60 * 1000,
    retry: false,
    queryFn: async () => {
      const { archive } = await loadSavedScan(latest.id);
      return expandArchive(archive, { rootPath: rootOfDrive(letter), aggregateLabel });
    }
  });

  return {
    scans,
    latest,
    previous,
    tree: needTree ? tree.data ?? null : null,
    /** Still finding out whether there is a last scan to open. */
    loading: (active && list.isLoading) || (needTree && tree.isLoading)
  };
}
