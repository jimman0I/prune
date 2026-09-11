import { useCallback, useMemo, useState, memo } from 'react';
import { groupStartupItems, startupCounts } from '../lib/groupStartupItems.js';
import { useStartupItems, useStartupToggle } from '../hooks/useSystemQueries.js';
import TableSkeleton from './TableSkeleton.jsx';
import { tileLetter } from '../lib/iconTileLetter.js';
import { tileColor, TILE_INK } from '../lib/programTileColor.js';

/** What Windows launches when you sign in.
 *
 * Revo keeps an autorun manager under its Tools menu, and it is the one
 * tool there that belongs beside an uninstaller: these entries outlive the
 * programs that create them. A program removed carelessly leaves its Run
 * key behind, and Windows goes on trying to launch a file that is not
 * there at every sign-in -- the same orphan the Applications tab already
 * looks for, in a different place.
 *
 * The first column switches entries on and off, which is what Revo's own
 * checkbox does and what this screen was missing. Disabling writes to
 * StartupApproved rather than deleting anything: the Run value and the
 * shortcut stay exactly where they are, which is what "disable" means to
 * Windows and is why the change is reversible from here, from Task
 * Manager, or from Settings.
 */

/** The columns, defined once so the header and the rows cannot drift.
 * Revo's own: name, what it launches, what the file says it is, who signed
 * it, and whether it is running right now. */
const COLUMNS = [
  { key: 'state', label: '', width: '30px' },
  { key: 'icon', label: '', width: '20px' },
  { key: 'name', label: 'Startup name', width: 'minmax(150px,0.9fr)' },
  { key: 'command', label: 'Launch path', width: 'minmax(180px,1.3fr)' },
  { key: 'description', label: 'Description', width: 'minmax(130px,0.9fr)' },
  { key: 'publisher', label: 'Publisher', width: 'minmax(120px,0.8fr)' },
  { key: 'status', label: 'Status', width: '104px' }
];

const GRID = COLUMNS.map((c) => c.width).join(' ');

/** The tick itself, shared by the switch and the fixed indicator so the
 * two cannot drift apart visually. */
function Tick({ on }) {
  return (
    <span
      className={`w-[13px] h-[13px] rounded-[3px] border flex items-center justify-center shrink-0 transition-colors ${
        on
          ? 'bg-[color:var(--success)] border-[color:var(--success)]'
          : 'bg-transparent border-[color:var(--border-subtle)]'
      }`}
    >
      {/* The tick, not just a fill. A tinted square on a dark ground reads
          as an empty box at a glance, which inverts the one fact this
          column carries. */}
      {on && (
        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="var(--bg-base)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
    </span>
  );
}

/** Whether Windows will run this entry, and the control that changes it.
 *
 * Green rather than the primary accent every other tickable control in
 * this app uses, deliberately -- and the reasoning survived the palette
 * change intact even though the colours in it all moved.
 *
 * The primary accent is what the program list and Deep Clean mark things
 * with, and there it means "selected for removal". Wearing it here would
 * attach the removal colour to the entries that are working normally.
 * This switch wants the app's "on" colour instead, which is the same
 * green as the Running pill two columns over.
 *
 * It used to be cyan on exactly that argument. Cyan is the primary accent
 * now, so keeping it would have inverted the point.
 *
 * Not `disabled` while the change is in flight: a machine-wide entry waits
 * on a UAC prompt, and disabling the control the user's focus is sitting
 * on drops that focus to the page body. It stays focusable, says it is
 * busy, and ignores a second click. */
function EnabledSwitch({ item, pending, onToggle }) {
  if (item.toggleNote) {
    // Not a switch at all. An inert checkbox is a broken control; the row
    // says why in words instead, next to the name.
    return <Tick on={item.enabled} />;
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={item.enabled}
      aria-busy={pending || undefined}
      aria-label={`${item.enabled ? 'Disable' : 'Enable'} ${item.name} at sign-in`}
      onClick={() => !pending && onToggle(item)}
      // 24px, not the 13px the tick occupies: that is the floor WCAG 2.2
      // sets for a target, and the mark itself is half of it.
      className={`flex items-center justify-center w-6 h-6 -ml-[5px] rounded-md transition-colors hover:bg-[color:var(--surface-hover)] ${
        pending ? 'opacity-50' : ''
      }`}
    >
      <Tick on={item.enabled} />
    </button>
  );
}

/** The entry's own icon, falling back to a lettered tile.
 *
 * It carries more weight on this screen than on the Applications tab.
 * These entries are named by whatever string a program chose to write
 * into a registry value, so the names really are "RtkAudUService",
 * "SunJavaUpdateSched" and "vgtray", and the icon is frequently the only
 * thing in the row that says what the program actually is.
 *
 * Two fallbacks, both needed and both borrowed from ProgramIcon, which
 * hit each of them in practice: `src` is absent for an entry whose icon
 * could not be read at all, and `onError` covers a data URI that arrived
 * but will not decode, which would otherwise render a broken-image glyph
 * -- worse than the letter it replaced. */
function StartupIcon({ item, src }) {
  const [failed, setFailed] = useState(false);

  if (src && !failed) {
    return (
      <img
        src={src}
        alt=""
        width={20}
        height={20}
        className="w-5 h-5 object-contain shrink-0"
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <div
      className="w-5 h-5 rounded-[4px] flex items-center justify-center text-[9px] font-bold shrink-0"
      style={{ background: tileColor(item.name), color: TILE_INK }}
    >
      {tileLetter(item.name, item.publisher)}
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
      <span className={`${base} bg-[color:var(--success-soft)] text-[color:var(--success)] border-[color:var(--success)]/25`}>
        Running
      </span>
    );
  }
  if (item.exists === null) {
    // Resolved through PATH at launch, so whether the file is there has no
    // answer from here. Saying nothing is the honest option.
    return (
      <span className={`${base} bg-[color:var(--surface-hover)] text-[color:var(--text-muted)] border-[color:var(--border-subtle)]`}>
        Not checked
      </span>
    );
  }
  return <span className="text-[10.5px] font-mono text-[color:var(--text-muted)]">Not running</span>;
}

function StartupRow({ item, iconSrc, pending, error, onToggle }) {
  return (
    <div
      className={`grid gap-3 px-5 py-2 items-center transition-colors ${
        item.enabled ? '' : 'opacity-55'
      } ${error ? 'bg-[color:var(--danger-soft)]' : 'hover:bg-[color:var(--surface-subtle)]'}`}
      style={{ gridTemplateColumns: GRID }}
    >
      <EnabledSwitch item={item} pending={pending} onToggle={onToggle} />

      <StartupIcon item={item} src={iconSrc} />

      <div className="min-w-0">
        <div className="text-[12.5px] text-[color:var(--text-primary)] truncate">{item.name}</div>
        {/* Both of these say something the row cannot show any other way,
            so they are written out rather than hidden behind a hover --
            a reason nobody can find is the same as no reason. */}
        {item.toggleNote && (
          <div className="text-[10.5px] text-[color:var(--text-muted)] leading-snug mt-0.5">
            {item.toggleNote}
          </div>
        )}
        {error && (
          <div className="text-[10.5px] text-[color:var(--danger)] leading-snug mt-0.5 select-text">{error}</div>
        )}
      </div>

      <div className="text-[11px] font-mono text-[color:var(--text-muted)] truncate select-text">
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

function StartupItems() {
  // An error belongs to the row that produced it rather than to the
  // screen: several rows can be mid-change at once.
  const [rowErrors, setRowErrors] = useState({});

  const { items, icons, error } = useStartupItems();

  const { mutation: toggle, pendingIds } = useStartupToggle({
    onProblem: (id, message) => setRowErrors((e) => ({ ...e, [id]: message }))
  });

  /** The row moves first and the mutation decides whether that held.
   *
   * The optimism is not cosmetic: the write spawns PowerShell, and a
   * machine-wide entry waits on a UAC prompt the user has to read, so a
   * switch that only moved on success would sit still for seconds after
   * every click. The rollback, the "did the machine agree" check and the
   * silent handling of a declined prompt all live in useStartupToggle now
   * -- this only has to clear the row's stale error and ask. */
  const onToggle = useCallback((item) => {
    setRowErrors((e) => {
      if (!(item.id in e)) return e;
      const next = { ...e };
      delete next[item.id];
      return next;
    });
    toggle.mutate({ id: item.id, enabled: !item.enabled });
  }, [toggle]);

  // Which rows are mid-flight, from the hook's own set.
  //
  // This used to read mutation.variables, which holds only the LATEST
  // call -- so toggling a second row cleared the first row's busy state
  // while its write was still running, and the switch (which ignores
  // clicks while busy) became clickable again mid-write.
  const pending = useMemo(() => {
    const map = {};
    for (const id of pendingIds) map[id] = true;
    return map;
  }, [pendingIds]);

  const groups = useMemo(() => groupStartupItems(items), [items]);
  const counts = useMemo(() => startupCounts(items), [items]);

  return (
    <div className="px-12 py-10 max-w-[1400px]">
      <h1 className="display-heading text-[30px] leading-none mb-2">Runs at sign-in</h1>
      <p className="text-[13px] text-[color:var(--text-secondary)] mb-6 max-w-[62ch]">
        The Run keys and Startup folders Windows reads when you sign in, grouped by where they
        live — which is what decides who an entry affects and what it takes to remove it. An
        entry whose file is gone was left behind by a program that was removed carelessly, and
        Windows keeps trying to launch it every time.
      </p>

      {error && (
        <div className="glass-panel p-6 text-[13px] text-[color:var(--danger)] select-text">
          Couldn't read the startup entries: {error}
        </div>
      )}

      {!error && items === null && (
        <TableSkeleton columns={COLUMNS.filter((c) => c.label)} rows={7} label="Reading startup entries…" />
      )}

      {!error && items && items.length === 0 && (
        // Genuinely empty is a real and good outcome here, so this says so
        // plainly AND says what was looked at -- otherwise "nothing" is
        // indistinguishable from "this screen is broken", which is the
        // more common reason a list comes back empty.
        <div className="glass-panel p-8 text-center">
          <p className="text-[13.5px] text-[color:var(--text-secondary)]">
            Nothing runs at sign-in.
          </p>
          <p className="text-[12.5px] text-[color:var(--text-muted)] mt-1.5 max-w-[52ch] mx-auto">
            Prune checked the Run and RunOnce keys in both registry hives and both Startup
            folders. A program that adds itself later will appear here.
          </p>
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
              className="grid gap-3 px-5 py-2 border-b border-[color:var(--border-subtle)] bg-[color:var(--surface-subtle)]"
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
                <div className="flex items-baseline gap-2 px-5 py-1.5 bg-[color:var(--surface-subtle)] border-y border-[color:var(--border-subtle)]">
                  <span className="text-[11px] font-mono uppercase tracking-[0.14em] text-[color:var(--text-secondary)]">
                    {group.label}
                  </span>
                  <span className="text-[11px] font-mono text-[color:var(--text-muted)]">
                    {group.enabledCount} of {group.items.length} enabled
                  </span>
                  {/* Said once per group rather than on every row. These
                      entries live in HKLM, which nobody can write to
                      unelevated, so the switch raises a consent prompt --
                      worth knowing before it appears, not after. */}
                  {group.key.endsWith('|machine') && (
                    <span className="text-[11px] text-[color:var(--text-muted)] ml-auto">
                      Changing these asks for administrator
                    </span>
                  )}
                </div>
                <div className="divide-y divide-[color:var(--border-subtle)]">
                  {group.items.map((item) => (
                    <StartupRow
                      key={item.id}
                      item={item}
                      iconSrc={icons[item.id]}
                      pending={Boolean(pending[item.id])}
                      error={rowErrors[item.id]}
                      onToggle={onToggle}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>

          <p className="text-[11.5px] text-[color:var(--text-muted)] mt-4 max-w-[68ch]">
            Switching an entry off records the decision in StartupApproved, the same place
            Windows' own Startup Apps settings and Task Manager read and write. Nothing is
            deleted: the Run value or the shortcut stays where it is, so the change is
            reversible from here or from either of those.
          </p>
        </>
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
export default memo(StartupItems);
