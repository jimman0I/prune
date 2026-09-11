import { useMemo, useState, memo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchDuplicates, quarantineDiskPath } from '../lib/api.js';
import { selectForRemoval, KEEP } from '../lib/duplicateSelection.js';
import { useToasts } from '../hooks/useToasts.jsx';
import ModalOverlay from './ModalOverlay.jsx';

/** Files that are byte-identical, and which copy to keep.
 *
 * Scoped to a folder the user names rather than the whole drive. Hashing
 * is the expensive part and the honest scope for it is somewhere they
 * chose -- Downloads, a projects folder, a photo library. Pointing it at
 * a whole drive is their decision to make, not the default.
 *
 * Nothing is deleted. Selected copies go to quarantine through the same
 * guarded path the Disk Map's removal uses, so a wrong answer here costs
 * a restore rather than a file.
 */
function formatBytes(bytes) {
  if (bytes === null || bytes === undefined) return '—';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

const DEFAULT_FOLDER = 'C:\\Users';

function Duplicates() {
  const [folder, setFolder] = useState('');
  const [armed, setArmed] = useState(null);
  const [selected, setSelected] = useState(() => new Set());
  const [confirming, setConfirming] = useState(false);
  const [removing, setRemoving] = useState(false);
  const toasts = useToasts();
  const queryClient = useQueryClient();

  const scan = useQuery({
    queryKey: ['duplicates', armed],
    enabled: Boolean(armed),
    // Two minutes of hashing is never repeated on its own.
    retry: false,
    staleTime: Infinity,
    gcTime: 0,
    refetchOnMount: false,
    queryFn: ({ signal }) => fetchDuplicates(armed, signal)
  });

  const groups = scan.data?.groups ?? [];

  const toggle = (path) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path); else next.add(path);
      return next;
    });
  };

  /** Auto-selection is named for what SURVIVES.
   *
   * "Auto-select oldest" is ambiguous about which end lives, and the
   * surviving copy is the consequential half of the choice on a screen
   * whose job is removing the others. */
  const autoSelect = (strategy) => setSelected(new Set(selectForRemoval(groups, strategy)));

  const selectedBytes = useMemo(() => {
    let total = 0;
    for (const group of groups) {
      for (const file of group.files) if (selected.has(file.path)) total += group.size;
    }
    return total;
  }, [groups, selected]);

  /** Refuses to leave a group with nothing left.
   *
   * The backend guard cannot catch this -- every path here is an ordinary
   * user file and each removal is individually legitimate. Only this
   * screen knows they are copies of one another, so only this screen can
   * notice that all of them were ticked. */
  const emptiedGroups = useMemo(
    () => groups.filter((g) => g.files.every((f) => selected.has(f.path))),
    [groups, selected]
  );

  const runRemoval = async () => {
    setConfirming(false);
    setRemoving(true);
    let moved = 0;
    let failed = 0;

    for (const path of selected) {
      const result = await quarantineDiskPath(path, null);
      if (result.ok) moved++; else failed++;
    }

    setRemoving(false);
    setSelected(new Set());
    queryClient.invalidateQueries({ queryKey: ['duplicates', armed] });
    queryClient.invalidateQueries({ queryKey: ['quarantine'] });

    if (moved > 0) {
      toasts.success(`Moved ${moved} ${moved === 1 ? 'copy' : 'copies'} to quarantine.`, {
        detail: 'Restore them from the Quarantine screen.'
      });
    }
    if (failed > 0) {
      toasts.error(`${failed} could not be moved.`, { detail: 'They may be open or on another drive.', ttl: 0 });
    }
  };

  return (
    <div className="px-12 py-10 max-w-[1400px]">
      <h1 className="display-heading text-[30px] leading-none mb-2">Duplicate files</h1>
      <p className="text-[13px] text-[color:var(--text-secondary)] mb-6 max-w-[64ch]">
        Files that are byte-identical, not merely the same size. Point it at a folder you
        actually keep things in — reading a whole drive to compare it against itself takes far
        longer than it is worth, and finds mostly the machine's own copies of its own files.
      </p>

      <div className="flex items-center gap-2 mb-2 max-w-[640px]">
        <input
          type="text"
          value={folder}
          onChange={(e) => setFolder(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && folder.trim()) setArmed(folder.trim()); }}
          placeholder={DEFAULT_FOLDER}
          data-app-search="duplicates"
          aria-label="Folder to search for duplicates"
          className="flex-1 min-w-0 font-mono text-[12.5px] px-3 py-2 rounded-lg bg-[color:var(--surface-hover)] border border-[color:var(--border-subtle)] text-[color:var(--text-primary)] placeholder:text-[color:var(--text-muted)] focus:outline-none focus:border-[color:var(--accent-primary)]/50"
        />
        {scan.isFetching ? (
          <button
            className="btn-ghost px-3.5 py-2 rounded-lg text-[12.5px] font-medium shrink-0"
            onClick={() => { setArmed(null); queryClient.cancelQueries({ queryKey: ['duplicates', armed] }); }}
          >
            Stop
          </button>
        ) : (
          <button
            className="btn-primary px-4 py-2 rounded-lg text-[12.5px] font-medium shrink-0 disabled:opacity-50"
            disabled={!folder.trim()}
            onClick={() => { setSelected(new Set()); setArmed(folder.trim()); }}
          >
            Find duplicates
          </button>
        )}
      </div>
      <p className="text-[11.5px] text-[color:var(--text-muted)] mb-6">
        Compares sizes first, then a sample, then the whole file — so most files are never read.
      </p>

      {scan.error && (
        <div className="glass-panel p-6 text-[13px] text-[color:var(--danger)] select-text">
          {scan.error.message}
        </div>
      )}

      {scan.isFetching && (
        <div className="glass-panel p-8 text-center">
          <div className="w-6 h-6 border-2 border-[color:var(--accent-primary)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[13px] text-[color:var(--text-primary)]">Reading {armed}</p>
          <p className="text-[12.5px] text-[color:var(--text-secondary)] mt-1.5 max-w-[52ch] mx-auto">
            Sizes first, then a 64 KB sample of anything that shares one, then the full contents
            of whatever still matches.
          </p>
        </div>
      )}

      {!scan.isFetching && scan.data && groups.length === 0 && (
        <div className="glass-panel p-8 text-center">
          <p className="text-[13.5px] text-[color:var(--text-secondary)]">No duplicate files here.</p>
          <p className="text-[12.5px] text-[color:var(--text-muted)] mt-1.5">
            {scan.data.scannedFiles.toLocaleString()} files compared.
            {scan.data.truncated && ' The scan was cut short, so this is not the whole folder.'}
          </p>
        </div>
      )}

      {!scan.isFetching && groups.length > 0 && (
        <>
          <div className="flex items-center flex-wrap gap-3 mb-4">
            <span className="text-[12.5px] text-[color:var(--text-secondary)]">
              <span className="text-[color:var(--text-primary)] font-medium">{groups.length}</span> sets ·{' '}
              <span className="text-[color:var(--accent-primary)] font-medium">{formatBytes(scan.data.wastedBytes)}</span> recoverable
            </span>
            <span className="flex-1" />
            <button className="btn-ghost px-3 py-1.5 rounded-lg text-[12px]" onClick={() => autoSelect(KEEP.OLDEST)}>
              Keep oldest
            </button>
            <button className="btn-ghost px-3 py-1.5 rounded-lg text-[12px]" onClick={() => autoSelect(KEEP.NEWEST)}>
              Keep newest
            </button>
            <button className="btn-ghost px-3 py-1.5 rounded-lg text-[12px]" onClick={() => setSelected(new Set())}>
              Clear
            </button>
          </div>

          {scan.data.truncated && (
            <p className="text-[12px] text-[color:var(--warning)] mb-4">
              The scan was cut short, so there may be more sets than these.
            </p>
          )}

          <div className="flex flex-col gap-3">
            {groups.map((group) => {
              const allTicked = group.files.every((f) => selected.has(f.path));
              return (
                <div key={group.digest} className={`glass-panel p-4 ${allTicked ? 'border-[color:var(--danger)]/40' : ''}`}>
                  <div className="flex items-baseline justify-between mb-2.5">
                    <span className="text-[12.5px] text-[color:var(--text-primary)]">
                      {group.count} identical copies · {formatBytes(group.size)} each
                    </span>
                    <span className="text-[12px] text-[color:var(--accent-primary)]">
                      {formatBytes(group.wastedBytes)} recoverable
                    </span>
                  </div>

                  {allTicked && (
                    <p className="text-[11.5px] text-[color:var(--danger)] mb-2">
                      Every copy in this set is ticked — untick one to keep it.
                    </p>
                  )}

                  <div className="flex flex-col gap-1">
                    {group.files.map((file) => (
                      <label key={file.path} className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-[color:var(--surface-subtle)] cursor-pointer">
                        <input
                          type="checkbox"
                          className="prune-check"
                          checked={selected.has(file.path)}
                          onChange={() => toggle(file.path)}
                        />
                        <span className="font-mono text-[11.5px] text-[color:var(--text-secondary)] truncate min-w-0 flex-1 select-text">
                          {file.path}
                        </span>
                        <span className="text-[11px] font-mono text-[color:var(--text-muted)] shrink-0">
                          {new Date(file.mtimeMs).toLocaleDateString()}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="sticky bottom-0 mt-4 glass-panel px-5 py-3 flex items-center justify-between gap-4">
            <span className="text-[12.5px] text-[color:var(--text-secondary)]">
              <span className="text-[color:var(--text-primary)] font-medium">{selected.size}</span> selected ·{' '}
              {formatBytes(selectedBytes)}
            </span>
            <button
              className="btn-danger px-4 py-2 rounded-lg text-[12.5px] font-medium disabled:opacity-50"
              disabled={selected.size === 0 || emptiedGroups.length > 0 || removing}
              onClick={() => setConfirming(true)}
            >
              {removing ? 'Moving…' : emptiedGroups.length > 0
                ? `${emptiedGroups.length} set${emptiedGroups.length === 1 ? '' : 's'} would lose every copy`
                : 'Move selected to quarantine'}
            </button>
          </div>
        </>
      )}

      {confirming && (
        <ModalOverlay label="Move duplicates to quarantine" onClose={() => setConfirming(false)}>
          <div className="glass-panel w-full max-w-[480px] p-6">
            <h2 className="display-heading text-[20px] mb-2">Move {selected.size} copies to quarantine?</h2>
            <p className="text-[12.5px] text-[color:var(--text-secondary)] mb-5">
              {formatBytes(selectedBytes)} recovered. Every set keeps at least one copy, and
              nothing is deleted — restore any of it from the Quarantine screen.
            </p>
            <div className="flex items-center justify-end gap-2.5">
              <button className="btn-ghost px-4 py-2 rounded-lg text-[12.5px]" onClick={() => setConfirming(false)}>
                Cancel
              </button>
              <button className="btn-danger px-4 py-2 rounded-lg text-[12.5px] font-medium" onClick={runRemoval}>
                Move to quarantine
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}

/** Memoised because App owns the active-screen state.
 *
 * Screens stay mounted once visited (see Screen.jsx), so every setScreen
 * re-renders App and React then reconciles every screen that has ever
 * been opened -- hidden ones skip layout and paint, not render. Measured
 * before this was added: a hidden Disk Map rendered twice across two tab
 * switches, once per switch, and that cost grows with every tab the user
 * has visited.
 *
 * Safe here specifically because this component takes no props at all, so
 * the comparison is between two empty objects and can never produce a
 * stale screen. A component with unstable props would gain nothing from
 * this and is deliberately left alone. */
export default memo(Duplicates);
