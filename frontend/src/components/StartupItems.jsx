import { useEffect, useMemo, useState } from 'react';
import { fetchStartupItems } from '../lib/api.js';

/** What Windows launches when you sign in.
 *
 * Revo keeps an autorun manager under its Tools menu, and it is the one
 * tool there that belongs beside an uninstaller: these entries outlive the
 * programs that create them. A program removed carelessly leaves its Run
 * key behind, and Windows goes on trying to launch a file that is not
 * there at every sign-in -- the same orphan the Applications tab already
 * looks for, in a different place.
 *
 * Read-only. Disabling an entry means writing to StartupApproved or
 * deleting a registry value, and shipping a write path nobody has tested
 * is worse than showing the list and saying where the switch lives.
 */
function StatusPill({ exists }) {
  if (exists === false) {
    return (
      <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-px rounded bg-[color:var(--danger-soft)] text-[color:var(--danger)] border border-[color:var(--danger)]/25 shrink-0">
        Missing
      </span>
    );
  }
  if (exists === null) {
    // Resolved through PATH at launch, so whether the file is there has no
    // answer from here. Saying nothing is the honest option.
    return (
      <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-px rounded bg-white/[0.05] text-[color:var(--text-muted)] border border-[color:var(--border-subtle)] shrink-0">
        Not checked
      </span>
    );
  }
  return null;
}

export default function StartupItems() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetchStartupItems()
      .then((result) => { if (!cancelled) setItems(result || []); })
      .catch((err) => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; };
  }, []);

  const broken = useMemo(() => (items || []).filter((item) => item.exists === false), [items]);

  return (
    <div className="px-12 py-10 max-w-[1400px]">
      <div className="text-[11px] text-[color:var(--text-muted)] font-mono uppercase tracking-[0.16em] mb-2">
        Startup
      </div>
      <h1 className="display-heading text-[30px] leading-none mb-2">Runs at sign-in</h1>
      <p className="text-[13px] text-[color:var(--text-secondary)] mb-6 max-w-[62ch]">
        The Run keys and Startup folders Windows reads when you sign in. An entry whose file
        is gone is left behind by a program that was removed carelessly — Windows keeps
        trying to launch it every time.
      </p>

      {error && (
        <div className="glass-panel p-6 text-[13px] text-[color:var(--danger)]">
          Couldn't read the startup entries: {error}
        </div>
      )}

      {!error && items === null && (
        <div className="glass-panel p-6 text-[13px] text-[color:var(--text-muted)]">Reading startup entries…</div>
      )}

      {!error && items && items.length === 0 && (
        <div className="glass-panel p-6 text-[13px] text-[color:var(--text-muted)]">
          Nothing is set to run at sign-in.
        </div>
      )}

      {!error && items && items.length > 0 && (
        <>
          <div className="flex items-baseline gap-4 mb-4 text-[12.5px] text-[color:var(--text-secondary)]">
            <span>
              <span className="text-[color:var(--text-primary)] font-medium">{items.length}</span> entries
            </span>
            {broken.length > 0 && (
              <span className="text-[color:var(--danger)]">
                {broken.length} pointing at a file that is gone
              </span>
            )}
          </div>

          <div className="glass-panel overflow-hidden divide-y divide-[color:var(--border-subtle)]">
            {items.map((item) => (
              <div key={item.id} className="flex items-center gap-3.5 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] text-[color:var(--text-primary)]">{item.name}</span>
                    <StatusPill exists={item.exists} />
                  </div>
                  <div className="text-[11px] font-mono text-[color:var(--text-muted)] mt-0.5 truncate">
                    {item.command}
                  </div>
                </div>
                <div className="text-[11px] font-mono text-[color:var(--text-secondary)] w-[104px] text-right shrink-0">
                  {item.location}
                </div>
                <div className="text-[11px] font-mono text-[color:var(--text-muted)] w-[76px] text-right shrink-0">
                  {item.scope}
                </div>
              </div>
            ))}
          </div>

          <p className="text-[11.5px] text-[color:var(--text-muted)] mt-4 max-w-[62ch]">
            Prune does not switch these off. Windows' own Startup Apps settings and Task
            Manager both do, and they record the change where Windows expects it.
          </p>
        </>
      )}
    </div>
  );
}
