import { useEffect, useMemo, useState } from 'react';
import { fetchStartupItems } from '../lib/api.js';
import { groupStartupItems, startupCounts } from '../lib/groupStartupItems.js';

/** What Windows launches when you sign in.
 *
 * Revo keeps an autorun manager under its Tools menu, and it is the one
 * tool there that belongs beside an uninstaller: these entries outlive the
 * programs that create them. A program removed carelessly leaves its Run
 * key behind, and Windows goes on trying to launch a file that is not
 * there at every sign-in -- the same orphan the Applications tab already
 * looks for, in a different place.
 *
 * Read-only. Disabling an entry means writing to StartupApproved, and
 * shipping a write path nobody has tested is worse than showing the state
 * accurately and saying where the switch lives.
 */

/** The columns, defined once so the header and the rows cannot drift.
 * Revo's own: name, what it launches, what the file says it is, who signed
 * it, and whether it is running right now. */
const COLUMNS = [
  { key: 'state', label: '', width: '26px' },
  { key: 'name', label: 'Startup name', width: 'minmax(150px,0.9fr)' },
  { key: 'command', label: 'Launch path', width: 'minmax(180px,1.3fr)' },
  { key: 'description', label: 'Description', width: 'minmax(130px,0.9fr)' },
  { key: 'publisher', label: 'Publisher', width: 'minmax(120px,0.8fr)' },
  { key: 'status', label: 'Status', width: '104px' }
];

const GRID = COLUMNS.map((c) => c.width).join(' ');

/** Whether Windows will run it: the state Task Manager's Startup tab shows
 * and the one this reads, not a control. Rendered as a filled or hollow
 * mark rather than a checkbox, because a checkbox that does not toggle is
 * a broken control rather than an indicator. */
function EnabledMark({ enabled }) {
  return (
    <div
      aria-label={enabled ? 'Enabled' : 'Disabled'}
      className={`w-[13px] h-[13px] rounded-[3px] border flex items-center justify-center shrink-0 ${
        enabled
          ? 'bg-[color:var(--accent-cyan)] border-[color:var(--accent-cyan)]'
          : 'bg-transparent border-[color:var(--border-subtle)]'
      }`}
    >
      {/* The tick, not just a fill. A tinted square on a dark ground reads
          as an empty box at a glance, which inverts the one fact this
          column carries. */}
      {enabled && (
        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="var(--bg-navy)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
    </div>
  );
}

/** Three different facts, deliberately not merged into one column.
 *
 * A startup entry that is switched on may not be running (it crashed, it
 * was closed) and one that is switched OFF may be running because
 * something else started it. And an entry whose file is gone is neither:
 * it is a leftover, which is the reason to be on this screen at all, so it
 * wins over the other two. */
function StatusPill({ item }) {
  const base = 'text-[9px] font-mono uppercase tracking-wider px-1.5 py-px rounded border shrink-0';

  if (item.exists === false) {
    return (
      <span className={`${base} bg-[color:var(--danger-soft)] text-[color:var(--danger)] border-[color:var(--danger)]/25`}>
        Invalid
      </span>
    );
  }
  if (item.running) {
    return (
      <span className={`${base} bg-[color:var(--accent-cyan)]/15 text-[color:var(--accent-cyan)] border-[color:var(--accent-cyan)]/25`}>
        Running
      </span>
    );
  }
  if (item.exists === null) {
    // Resolved through PATH at launch, so whether the file is there has no
    // answer from here. Saying nothing is the honest option.
    return (
      <span className={`${base} bg-white/[0.05] text-[color:var(--text-muted)] border-[color:var(--border-subtle)]`}>
        Not checked
      </span>
    );
  }
  return <span className="text-[10.5px] font-mono text-[color:var(--text-muted)]">Not running</span>;
}

function StartupRow({ item }) {
  return (
    <div
      className={`grid gap-3 px-5 py-2 items-center hover:bg-white/[0.03] transition-colors ${
        item.enabled ? '' : 'opacity-55'
      }`}
      style={{ gridTemplateColumns: GRID }}
    >
      <EnabledMark enabled={item.enabled} />

      <div className="text-[12.5px] text-[color:var(--text-primary)] truncate">{item.name}</div>

      <div className="text-[11px] font-mono text-[color:var(--text-muted)] truncate" >
        {item.command}
      </div>

      <div className="text-[11.5px] text-[color:var(--text-secondary)] truncate">
        {item.description || '—'}
      </div>

      <div className="text-[11.5px] text-[color:var(--text-secondary)] truncate">
        {item.publisher || '—'}
      </div>

      <div><StatusPill item={item} /></div>
    </div>
  );
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

  const groups = useMemo(() => groupStartupItems(items), [items]);
  const counts = useMemo(() => startupCounts(items), [items]);

  return (
    <div className="px-12 py-10 max-w-[1400px]">
      <div className="text-[11px] text-[color:var(--text-muted)] font-mono uppercase tracking-[0.16em] mb-2">
        Startup
      </div>
      <h1 className="display-heading text-[30px] leading-none mb-2">Runs at sign-in</h1>
      <p className="text-[13px] text-[color:var(--text-secondary)] mb-6 max-w-[62ch]">
        The Run keys and Startup folders Windows reads when you sign in, grouped by where they
        live — which is what decides who an entry affects and what it takes to remove it. An
        entry whose file is gone was left behind by a program that was removed carelessly, and
        Windows keeps trying to launch it every time.
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
          <div className="flex items-baseline flex-wrap gap-4 mb-4 text-[12.5px] text-[color:var(--text-secondary)]">
            <span>
              <span className="text-[color:var(--text-primary)] font-medium">{counts.total}</span> entries
            </span>
            <span>
              <span className="text-[color:var(--text-primary)] font-medium">{counts.enabled}</span> enabled
            </span>
            <span>
              <span className="text-[color:var(--text-primary)] font-medium">{counts.running}</span> running now
            </span>
            {counts.broken > 0 && (
              <span className="text-[color:var(--danger)]">
                {counts.broken} pointing at a file that is gone
              </span>
            )}
          </div>

          <div className="glass-panel overflow-hidden">
            <div
              className="grid gap-3 px-5 py-2 border-b border-[color:var(--border-subtle)] bg-white/[0.02]"
              style={{ gridTemplateColumns: GRID }}
            >
              {COLUMNS.map((col) => (
                <span
                  key={col.key}
                  className="text-[10.5px] font-mono uppercase tracking-[0.13em] text-[color:var(--text-muted)]"
                >
                  {col.label}
                </span>
              ))}
            </div>

            {groups.map((group) => (
              <div key={group.key}>
                {/* Revo puts the count in the heading and it is the useful
                    part: "3 of 11 enabled" answers a question no row can. */}
                <div className="flex items-baseline gap-2 px-5 py-1.5 bg-white/[0.03] border-y border-[color:var(--border-subtle)]">
                  <span className="text-[11px] font-mono uppercase tracking-[0.14em] text-[color:var(--text-secondary)]">
                    {group.label}
                  </span>
                  <span className="text-[11px] font-mono text-[color:var(--text-muted)]">
                    {group.enabledCount} of {group.items.length} enabled
                  </span>
                </div>
                <div className="divide-y divide-[color:var(--border-subtle)]">
                  {group.items.map((item) => <StartupRow key={item.id} item={item} />)}
                </div>
              </div>
            ))}
          </div>

          <p className="text-[11.5px] text-[color:var(--text-muted)] mt-4 max-w-[68ch]">
            Prune reads these from StartupApproved, the same place Windows' own Startup Apps
            settings and Task Manager record them, so what you see here is what those show.
            Prune does not switch them off yet — those two do, and they write the change where
            Windows expects it.
          </p>
        </>
      )}
    </div>
  );
}
