import { useEffect, useMemo, useRef, useState } from 'react';
import ContextMenu from './ContextMenu.jsx';
import { useToasts } from '../hooks/useToasts.jsx';
import { fetchPrograms, revealInExplorer, openInstalledAppsSettings, deleteInstallTrace, fetchExtensionPageAddress } from '../lib/api.js';
import { copyText } from '../lib/copyText.js';
import { useQueryClient } from '@tanstack/react-query';
import { keys } from '../lib/queryClient.js';
import { useInstallTraces, useSettings } from '../hooks/useSystemQueries.js';
import { traceForProgram } from '../lib/installTraces.js';
import { isProgramHidden, withProgramHidden } from '../lib/hiddenPrograms.js';
import { sizeBadgeTone } from '../lib/sizeBadgeTone.js';
import { sortPrograms, nextSortState } from '../lib/sortPrograms.js';
import { canBatchUninstall, batchIneligibleReason, batchSummary } from '../lib/batchSelection.js';
import { isRecentlyInstalled, parseInstallDate, RECENT_DAYS } from '../lib/recentPrograms.js';
import TableSkeleton from './TableSkeleton.jsx';
import { tileLetter } from '../lib/iconTileLetter.js';
import { tileColor, TILE_INK } from '../lib/programTileColor.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';

function formatBytes(bytes) {
  if (bytes === null || bytes === undefined) return '—';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/** The severity bands, painted: quiet, then brighter, then amber, then
 * amber and heavier.
 *
 * A ramp from neutral to amber and never to red. Red on this screen would
 * read as "broken" -- the Broken badge and the failed states own it -- and a
 * 105 GB game is not broken, it is big. The last step is weight rather than
 * a new hue for the same reason. (Before that it went blue, amber, red; the
 * blue was also the Store badge's colour.) */
export const SIZE_TONE_TEXT = {
  low: 'text-[color:var(--text-secondary)]',
  moderate: 'text-[color:var(--text-primary)]',
  high: 'text-[color:var(--warning)]',
  peak: 'text-[color:var(--warning)] font-semibold'
};

/** The grid, defined once so the header and every row cannot drift apart.
 * A column's `sort` key is what makes its header clickable; the ones
 * without a key (the website, the action) aren't meaningfully sortable.
 *
 * Every width here is measured against what the column actually holds on
 * this machine, not estimated. Several were roughly a third wider than
 * their widest value -- Size reserved 92px to render 58px of text -- and
 * the table paid for that with a horizontal scrollbar under the rows at
 * the default window size, before the New column made it worse. The
 * fixed columns now sit just above their real content, and the three
 * flexible ones keep the slack. */
const COLUMNS = [
  { key: 'select', width: '30px' },
  { key: 'name', sort: 'name', width: 'minmax(190px,1fr)' },
  { key: 'size', sort: 'sizeBytes', width: '72px', align: 'right' },
  // Kept wide: "2026.08.19.11.06" is 138px and still truncates here. A
  // version is read left-to-right, so losing the tail costs least.
  { key: 'version', sort: 'version', width: '128px' },
  { key: 'architecture', sort: 'architecture', width: '52px' },
  { key: 'installDate', sort: 'installDate', width: '74px' },
  // Recency used to be a grouping: recent installs sat under their own
  // collapsible heading above everything else. It is a column now because
  // a grouping owns the order of the whole table -- sort by size and the
  // heading is still there, splitting the answer in two -- while a column
  // sits beside the date it comes from and brings the same rows to the top
  // only when you click it. Sorted by it, this is the New Programs list.
  // 46px is the header, not the badge: NEW plus its sort arrow is wider
  // than the badge it sits over.
  { key: 'recent', sort: 'recent', width: '46px' },
  { key: 'publisher', sort: 'publisher', width: 'minmax(112px,0.7fr)' },
  { key: 'website', width: 'minmax(92px,0.6fr)' },
  { key: 'action', width: '164px', align: 'right' }
];

// select/action carry no header word -- both are icon/button columns.
const COLUMN_KEYS = {
  name: 'applications.columns.application',
  size: 'applications.columns.size',
  version: 'applications.columns.version',
  architecture: 'applications.columns.type',
  installDate: 'applications.columns.installed',
  recent: 'applications.columns.new',
  publisher: 'applications.columns.company',
  website: 'applications.columns.website'
};

/** Version and Website are the two columns that can go. Without them the
 * table fits a window down to about 900px; with them it needs about 1380px,
 * because from 1100px the nav rail is 200px wide rather than 72 and the page
 * has 96px of gutters, so the pane is the window minus about 296px. (The spec
 * said "about 1100px", the width the rail changes at; measured against the
 * real column floors, 1100 would have put the wide table into a 804px pane.)
 * What is dropped is what is least needed to pick a row: the website was
 * never sortable and the version is not what you choose an uninstall by.
 * Done in CSS (a `min-[1380px]` variant on the cells and a second grid
 * template) rather than in script, so there is no resize listener and no
 * frame in which the wrong one shows. */
export const WIDE_BREAKPOINT_PX = 1380;
export const NARROW_HIDDEN = ['version', 'website'];
export const WIDE_ONLY = 'hidden min-[1380px]:block';
export const WIDE_ONLY_FLEX = 'hidden min-[1380px]:flex';

const NARROW_COLUMNS = COLUMNS.filter((c) => !NARROW_HIDDEN.includes(c.key));
const tracks = (columns) => columns.map((c) => c.width).join(' ');
// A track's floor: its fixed width, or the first number inside minmax().
const floorOf = (width) => Number(/(\d+)px/.exec(width)[1]);
// Every row gets this as a minimum, so all of them are the same width when
// the window is narrower than the table: header, rows and the sticky action
// cell then line up, and the scroll area scrolls them together.
export const tableFloor = (columns) => `${columns.reduce((sum, c) => sum + floorOf(c.width), 0) + (columns.length - 1) * 10 + 32}px`;
const TABLE_VARS = {
  '--cols-wide': tracks(COLUMNS),
  '--cols-narrow': tracks(NARROW_COLUMNS),
  '--min-wide': tableFloor(COLUMNS),
  '--min-narrow': tableFloor(NARROW_COLUMNS)
};
export const ROW_GRID = 'grid gap-2.5 px-4 items-center min-w-[var(--min-narrow)] min-[1380px]:min-w-[var(--min-wide)] [grid-template-columns:var(--cols-narrow)] min-[1380px]:[grid-template-columns:var(--cols-wide)]';
/** The action column stays in view when the table scrolls sideways, on the
 * panel's own colour so the cells scrolling underneath do not show through. */
/* The action column stays in view when the table scrolls sideways. The CELL
 * has no background, on purpose: it used to paint an opaque panel-coloured
 * box on every row, a visible ghost rectangle at rest that also hid the
 * Company column beneath it. What needs to be legible over the columns under
 * it is only the buttons, and only while they are showing, so the backing
 * belongs to them (ACTION_BACKING) and appears with them. */
export const STICKY_ACTION = 'sticky right-2 z-[1] pl-2';
/** The buttons' group: invisible at rest, shown on hover or when anything in
 * the row has keyboard focus -- the row itself included, which is what the
 * arrow keys land on -- and only then opaque, so it never paints a box of its
 * own colour into the glass. */
export const ACTION_BACKING = 'inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 bg-[color:var(--bg-panel)] [background-image:linear-gradient(var(--surface-hover),var(--surface-hover))] opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity';

/** The program's own icon, falling back to a lettered tile.
 *
 * Two different fallbacks, both needed. `src` is absent for a program
 * whose icon couldn't be extracted at all (mostly MSI redistributables
 * that register no icon anywhere, plus the ones whose only registered
 * icon turned out to be an installer's generic glyph). `onError` covers
 * the rarer case of a data URI that arrived but won't decode; without it
 * the row would show a broken-image glyph, which looks worse than the
 * letter it replaced.
 *
 * The letter skips a leading vendor word -- see iconTileLetter.js. It
 * matters more than one character usually would: the programs that reach
 * this tile are almost all system components named after their vendor,
 * and twenty-six of the forty-six tiles here were the same "M". */
function ProgramIcon({ program, src }) {
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
      className="w-5 h-5 rounded-[4px] flex items-center justify-center text-[11px] font-bold shrink-0"
      style={{ background: tileColor(program.name), color: TILE_INK }}
    >
      {tileLetter(program.name, program.publisher)}
    </div>
  );
}

/** Row checkbox. Not a native input, matching DeepCleanTree's own bespoke
 * control -- and it needs a disabled state a native one styles badly.
 *
 * A disabled box carries the reason as its accessible label rather than a
 * tooltip: a control that refuses to tick and says nothing is a dead end,
 * and this codebase doesn't use native hover text. */
function RowCheckbox({ checked, disabled, label, onChange }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      // The button is the 24px target; the box people see is the span inside
      // it, still 15px. The negative vertical margin gives back the height
      // the bigger target would otherwise add to every row.
      className={`group/box w-6 h-6 -my-0.5 flex items-center justify-center shrink-0 ${disabled ? 'cursor-not-allowed' : ''}`}
    >
      <span
        className={`w-[15px] h-[15px] rounded-[4px] flex items-center justify-center border transition-colors ${
          disabled
            ? 'border-[color:var(--border-subtle)] opacity-30'
            : checked
              ? 'bg-[color:var(--accent-primary)] border-[color:var(--accent-primary)]'
              : 'bg-[color:var(--surface-subtle)] border-[color:var(--control-border)] group-hover/box:border-[color:var(--control-border-hover)]'
        }`}
      >
        {checked && !disabled && (
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="var(--accent-ink)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        )}
      </span>
    </button>
  );
}

function SortArrow({ active, direction }) {
  if (!active) return null;
  return (
    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" className="shrink-0">
      {direction === 'asc' ? <polyline points="18 15 12 9 6 15" /> : <polyline points="6 9 12 15 18 9" />}
    </svg>
  );
}

/** One program's row. Extracted when the list gained group headings: the
 * body renders from a `row` union now, and a component keeps the row's own
 * markup readable instead of reaching through it. */
/** Opens the program's folder in Explorer.
 *
 * It is among the most-used actions:
 * the row says a program is 55 GB and the next question is always
 * where. Shown only when there is a folder to open -- most Store apps and
 * every extension have one, but plenty of registry entries record none,
 * and a button that cannot work is worse than no button. */
/** The bin glyph on the Uninstall buttons: an action reads faster as a
 * shape plus a word than as a coloured pill. Decorative, so hidden from
 * assistive tech -- the word carries the meaning. */
function BinIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
      <path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M6 6l1 14h10l1-14" /><path d="M10 11v5" /><path d="M14 11v5" />
    </svg>
  );
}

function RevealButton({ program }) {
  const { t } = useLanguage();
  const [failed, setFailed] = useState(null);
  const target = program.installLocation;
  if (!target) return null;

  return (
    <button
      onClick={async () => {
        setFailed(null);
        try {
          await revealInExplorer(target);
        } catch (error) {
          // The usual cause is a folder that is gone, which is worth
          // saying: it means the entry is stale.
          setFailed(error.message);
        }
      }}
      aria-label={t('applications.reveal.ariaLabel', program.name)}
      className="btn-ghost px-2 py-1 rounded-md text-[11px] font-medium"
    >
      {failed ? t('applications.reveal.notFound') : t('applications.reveal.button')}
    </button>
  );
}

/** Copies this extension's own page address.
 *
 * Prune cannot silently remove a browser extension: the browser owns its
 * profile files and repairs anything edited from outside. So the button hands
 * the person the address of the page where the browser does it, and says so
 * when it has -- the sentence is shown at the moment it matters, not hidden
 * in a hover.
 *
 * It copies rather than opens on purpose. Prune never starts a browser: an
 * unsigned program launching one with a profile argument is what antivirus
 * calls credential theft (Defender: Behavior:Win32/WebBrowserCredAccess.E2). */
function ManageExtensionButton({ program }) {
  const { t } = useLanguage();
  const toasts = useToasts();
  const [busy, setBusy] = useState(false);
  return (
    <button
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const result = await fetchExtensionPageAddress(program.id);
          if (await copyText(result.address)) {
            toasts.info(t('uninstallerV3.extensions.copied', result.browser || program.browser));
          } else {
            // Nothing could reach the clipboard: show the address so it can be typed.
            toasts.error(t('uninstallerV3.extensions.failed'), { detail: result.address });
          }
        } catch (error) {
          toasts.error(t('uninstallerV3.extensions.failed'), { detail: error.message });
        } finally {
          setBusy(false);
        }
      }}
      aria-label={t('uninstallerV3.extensions.manageAria', program.name)}
      className="btn-ghost px-2 py-1 rounded-md text-[11px] font-medium disabled:opacity-50"
    >
      {t('uninstallerV3.extensions.manage')}
    </button>
  );
}

function ProgramRow({ program, iconSrc, checked, running, isNew, monitored = false, hidden = false, tabStop, onFocusRow, onToggle, onUninstall, onRemoveStoreApp, onRemoveSourceItem, onRemoveUnregistered, onContextMenu }) {
  const { t } = useLanguage();
  return (
    <div
    role="row"
    // One row in the Tab order and the rest one arrow key away (see the
    // rowgroup's handler): the actions are shown for a focused row, so a
    // keyboard user meets them on a row they can see rather than tabbing
    // through buttons that are drawn nowhere. Negative offset so the ring
    // is not clipped by the panel's overflow.
    tabIndex={tabStop ? 0 : -1}
    onFocus={onFocusRow}
    className={`${ROW_GRID} py-1.5 group hover:bg-[color:var(--surface-hover)] focus-visible:bg-[color:var(--surface-hover)] focus-visible:[outline-offset:-2px] transition-colors`}
    onContextMenu={(event) => onContextMenu?.(program, event)}
  >
    <div role="cell">
      <RowCheckbox
        checked={checked}
        disabled={!canBatchUninstall(program)}
        label={batchIneligibleReason(program, t('applications.batchReasons')) || t('applications.selectRow', program.name)}
        onChange={onToggle}
      />
    </div>

    <div role="cell" className="flex items-center gap-2.5 min-w-0 overflow-hidden">
      <ProgramIcon program={program} src={iconSrc} />
      {/* The name keeps at least a few words of room: with two badges
          (Running, Unsigned) it was squeezed to "M...". The badges clip
          instead -- the name is what identifies the row. */}
      <span className="text-[12.5px] truncate min-w-[9ch] shrink">{program.name}</span>
      {/* Only ever seen with "Show hidden" on, which is the one time a
          hidden row is in the list. Quiet like Unsigned: it says something
          about the list, not about the program. */}
      {hidden && (
        <span className="text-[11px] font-mono uppercase tracking-wider px-1 py-px rounded bg-[color:var(--surface-hover)] text-[color:var(--text-muted)] border border-[color:var(--border-subtle)] shrink-0">
          {t('hiddenProgramsV1.badge')}
        </span>
      )}
      {program.health?.orphaned && (
        <span className="text-[11px] font-mono uppercase tracking-wider px-1 py-px rounded bg-[color:var(--danger-soft)] text-[color:var(--danger)] border border-[color:var(--danger)]/25 shrink-0">
          {t('applications.badges.broken')}
        </span>
      )}
      {/* Warn before uninstalling something that is open, and the
          warning earns its place: an uninstaller for a running program
          either fails, or half-succeeds and leaves files behind that the
          next launch recreates. */}
      {running && (
        <span className="text-[11px] font-mono uppercase tracking-wider px-1 py-px rounded bg-[color:var(--success-soft)] text-[color:var(--success)] border border-[color:var(--success)]/25 shrink-0">
          {t('applications.badges.running')}
        </span>
      )}
      {/* Marked, because how you remove one is genuinely different --
          a Store app has no uninstaller to run. Neutral, not blue: which
          kind of install this is doesn't bear on the task of freeing
          space, so it gets the same outline every other identifying
          badge on this row uses, not an ambient accent that means
          nothing here. */}
      {program.source === 'store' && (
        <span className="text-[11px] font-mono uppercase tracking-wider px-1 py-px rounded bg-[color:var(--surface-hover)] text-[color:var(--text-secondary)] border border-[color:var(--border-subtle)] shrink-0">
          {t('applications.badges.store')}
        </span>
      )}
      {/* Which browser it belongs to is the identifying fact here -- the
          same extension is often installed in two of them. Neutral for
          the same reason the Store badge above is. */}
      {program.source === 'extension' && (
        <span className="text-[11px] font-mono uppercase tracking-wider px-1 py-px rounded bg-[color:var(--surface-hover)] text-[color:var(--text-secondary)] border border-[color:var(--border-subtle)] shrink-0">
          {program.browser}
        </span>
      )}
      {/* Only shown when the reader actually knows. Gecko records an
          add-on's enabled state in the same index it lists them from;
          Chromium keeps it somewhere this reader does not look, so those
          rows say nothing rather than guessing "enabled". A disabled
          add-on still occupies disk, which is what this list is about. */}
      {/* Where it came from, when that decides how it is removed. Neutral
          like the Store badge: none of them is a warning. */}
      {(program.source === 'chocolatey' || program.chocolateyId) && (
        <span className="text-[11px] font-mono uppercase tracking-wider px-1 py-px rounded bg-[color:var(--surface-hover)] text-[color:var(--text-secondary)] border border-[color:var(--border-subtle)] shrink-0">{t('sourcesV4.badges.chocolatey')}</span>
      )}
      {program.source === 'otherUser' && (
        <span className="text-[11px] font-mono uppercase tracking-wider px-1 py-px rounded bg-[color:var(--surface-hover)] text-[color:var(--text-secondary)] border border-[color:var(--border-subtle)] shrink-0">{program.owner}</span>
      )}
      {program.source === 'unregistered' && (
        <span className="text-[11px] font-mono uppercase tracking-wider px-1 py-px rounded bg-[color:var(--surface-hover)] text-[color:var(--text-secondary)] border border-[color:var(--border-subtle)] shrink-0">{t('sourcesV4.badges.unregistered')}</span>
      )}
      {(program.source === 'feature' || program.source === 'update') && (
        <span className="text-[11px] font-mono uppercase tracking-wider px-1 py-px rounded bg-[color:var(--surface-hover)] text-[color:var(--text-secondary)] border border-[color:var(--border-subtle)] shrink-0">{t(`sourcesV4.badges.${program.source}`)}</span>
      )}
      {/* Unsigned is a fact, not an accusation -- plenty of good free tools
          are not signed -- so it is neutral. A signature that no longer
          matches its file is different: the file changed after the vendor
          signed it, which is what tampering looks like. */}
      {program.signature?.status === 'unsigned' && (
        <span className="text-[11px] font-mono uppercase tracking-wider px-1 py-px rounded bg-[color:var(--surface-hover)] text-[color:var(--text-muted)] border border-[color:var(--border-subtle)] shrink-0">{t('sigV6.badges.unsigned')}</span>
      )}
      {program.signature?.status === 'broken' && (
        <span className="text-[11px] font-mono uppercase tracking-wider px-1 py-px rounded bg-[color:var(--danger-soft)] text-[color:var(--danger)] border border-[color:var(--danger)]/25 shrink-0">
          {t('sigV6.badges.broken')}
        </span>
      )}
      {program.source === 'extension' && program.enabled === false && (
        <span className="text-[11px] font-mono uppercase tracking-wider px-1 py-px rounded bg-[color:var(--surface-hover)] text-[color:var(--text-muted)] border border-[color:var(--border-subtle)] shrink-0">
          {t('applications.badges.disabled')}
        </span>
      )}
      {/* Installed under the install monitor: Prune holds its installer's own
          record of what it created, so removing it can be exact. */}
      {monitored && (
        <span className="text-[11px] font-mono uppercase tracking-wider px-1 py-px rounded bg-[color:var(--accent-primary)]/10 text-[color:var(--accent-primary)] border border-[color:var(--accent-primary)]/25 shrink-0">
          {t('uninstallerV3.monitor.badge')}
        </span>
      )}
      {program.unused && !program.health?.orphaned && (
        <span className="text-[11px] font-mono uppercase tracking-wider px-1 py-px rounded bg-[color:var(--warning-soft)] text-[color:var(--warning)] border border-[color:var(--warning)]/25 shrink-0">
          {t('applications.badges.unused')}
        </span>
      )}
    </div>

    <div
      role="cell"
      className={`text-[12px] font-mono text-right ${SIZE_TONE_TEXT[sizeBadgeTone(program.sizeBytes)]}`}
      style={{ fontVariantNumeric: 'tabular-nums' }}
    >
      {formatBytes(program.sizeBytes)}
    </div>

    <div role="cell" className={`${WIDE_ONLY} text-[11.5px] font-mono text-[color:var(--text-secondary)] truncate`}>
      {program.version || '—'}
    </div>

    {/* Blank rather than a guess: a per-user registry entry
        carries no architecture, and a wrong "64-bit" is a fact
        stated confidently and incorrectly. */}
    <div role="cell" className="text-[11.5px] font-mono text-[color:var(--text-muted)]">
      {program.architecture || '—'}
    </div>

    {/* An inferred date is shown muted. Two thirds of these come
        from the uninstall key's write time rather than from
        anything the installer declared, and that is a weaker
        claim -- an update rewrites the key too. Showing both
        identically hides it; saying which is which costs nothing. */}
    <div
      role="cell"
      className={`text-[11.5px] font-mono ${
        program.installDateApproximate
          ? 'text-[color:var(--text-muted)]'
          : 'text-[color:var(--text-secondary)]'
      }`}
    >
      {parseInstallDate(program.installDate) !== null ? new Date(program.installDate).toLocaleDateString() : '—'}
    </div>

    {/* Blank, not a dash, for everything else. A dash means "we have no
        value here"; almost nothing is new, and 120 dashes down a column
        would read as 120 unknowns. */}
    <div role="cell" className="flex items-center">
      {isNew && (
        <span
          className="text-[11px] font-mono uppercase tracking-wider px-1 py-px rounded bg-[color:var(--surface-hover)] text-[color:var(--text-secondary)] border border-[color:var(--control-border)]"
        >
          {t('applications.columns.new')}
        </span>
      )}
    </div>

    <div role="cell" className="text-[11.5px] text-[color:var(--text-secondary)] truncate">
      {program.publisher}
    </div>

    <div role="cell" className={`${WIDE_ONLY} text-[11.5px] font-mono text-[color:var(--text-muted)] truncate`}>
      {program.website ? program.website.replace(/^https?:\/\//, '') : '—'}
    </div>

    <div role="cell" className={`${STICKY_ACTION} text-right flex items-center justify-end gap-1.5`}>
      {program.source === 'extension' ? (
        <>
          <div data-action-backing className={ACTION_BACKING}>
            <RevealButton program={program} />
            <ManageExtensionButton program={program} />
          </div>
          {/* Removing one is a browser operation, not an uninstaller. */}
          <span className="text-[11px] font-mono text-[color:var(--text-muted)]">{t('applications.viaBrowser')}</span>
        </>
      ) : (
      <div data-action-backing className={ACTION_BACKING}>
      <RevealButton program={program} />
      {program.source === 'feature' && program.protected ? (
        // Turning it off would break every .NET program or the antivirus, so
        // there is no button -- the backend refuses it too.
        <span className="text-[11px] font-mono text-[color:var(--text-muted)] px-2">
          {t('sourcesV4.actions.required')}
          {/* The reason, for screen readers: an aria-label on a plain span is
              not reliably read out. */}
          <span className="sr-only">{' — '}{t('sourcesV4.actions.requiredAria', program.name)}</span>
        </span>
      ) : program.source === 'feature' || program.source === 'update' || program.source === 'chocolatey' ? (
        <button onClick={() => onRemoveSourceItem?.(program)} className="btn-remove">
          <BinIcon />
          {program.source === 'feature' ? t('sourcesV4.actions.turnOff') : t('applications.uninstall')}
        </button>
      ) : program.source === 'otherUser' ? (
        // Another account's own uninstaller would act on THIS account's
        // registry, so the way to remove one is Forced uninstall, with what
        // its entry says. Nothing to offer when the entry names no folder.
        program.installLocation ? (
          <button onClick={() => onRemoveUnregistered?.(program)} className="btn-remove">
            <BinIcon />
            {t('sourcesV4.actions.remove')}
          </button>
        ) : null
      ) : program.source === 'unregistered' ? (
        // Forced uninstall, prefilled: it finds the rest of the program and
        // has every item reviewed before anything is deleted.
        <button onClick={() => onRemoveUnregistered?.(program)} className="btn-remove">
          <BinIcon />
          {t('sourcesV4.actions.remove')}
        </button>
      ) : program.source === 'store' && program.nonRemovable ? (
        /* Windows marks this package as part of the system and will not
         * let it go -- on the dev machine that is the Security interface
         * and the app installer. Prune could offer a button and let
         * Remove-AppxPackage decline, but a control that always fails is
         * worse than one that is honestly absent, so this keeps the old
         * behaviour and opens Windows' own page instead. */
        <button
          onClick={() => { openInstalledAppsSettings().catch(() => {}); }}
          aria-label={t('applications.inWindows.ariaLabel', program.name)}
          className="btn-ghost px-2 py-1 rounded-md text-[11px] font-medium"
        >
          {t('applications.inWindows.button')}
        </button>
      ) : program.source === 'store' ? (
        // Removable, so it says Uninstall like every other row. What is
        // different about it -- that this one cannot be undone from
        // Quarantine -- is said in the dialog, where the decision is
        // actually made, rather than crammed into a button.
        <button
          onClick={() => onRemoveStoreApp(program)}
          className="btn-remove"
        >
          <BinIcon />
          {t('applications.uninstall')}
        </button>
      ) : (
        <button
          onClick={() => onUninstall(program)}
          className="btn-remove"
        >
          <BinIcon />
          {program.health?.orphaned ? t('applications.forceRemove') : t('applications.uninstall')}
        </button>
      )}
      </div>
      )}
    </div>
  </div>
  );
}

/** No valid signature on the program's own files: none at all, or one that
 * no longer matches. Programs not checked (yet, or ever) are not counted. */
const isUnsigned = (program) => program.signature?.status === 'unsigned' || program.signature?.status === 'broken';

export default function ProgramList({ programs: initialPrograms, extensions = [], unregistered = [], windowsItems = [], otherUsers = [], otherProfiles = [], onOpenOtherAccounts, icons = {}, running = {}, onUninstall, onBatchUninstall, onRemoveStoreApp = () => {}, onRemoveSourceItem, onRemoveUnregistered, onViewChange }) {
  const { t } = useLanguage();
  const toasts = useToasts();
  // Programs the install monitor has a record of, and how to forget one.
  const { traces } = useInstallTraces();
  const queryClient = useQueryClient();
  const deleteTrace = async (trace) => {
    try {
      await deleteInstallTrace(trace.id);
      toasts.info(t('uninstallerV3.monitor.traceDeleted'));
    } catch (error) {
      toasts.error(t('uninstallerV3.monitor.traceDeleteFailed'), { detail: error.message });
    }
    queryClient.invalidateQueries({ queryKey: keys.installTraces });
  };
  // The row a right-click landed on, and where, for the context menu.
  const [menu, setMenu] = useState(null);
  const openMenu = (program, event) => {
    event.preventDefault();
    setMenu({ program, x: event.clientX, y: event.clientY });
  };
  const [programs, setPrograms] = useState(initialPrograms || []);
  const [loading, setLoading] = useState(!initialPrograms);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState({ column: 'sizeBytes', direction: 'desc' });
  const [selected, setSelected] = useState(new Set());
  // The row the arrow keys are on: the one Tab stop in the list.
  const [cursorId, setCursorId] = useState(null);
  const rowsRef = useRef(null);
  // Bumped by the "genuinely nothing came back" retry button below.
  // Past 0 it always re-fetches, even in a test/caller that seeded
  // initialPrograms -- clicking Retry is an explicit ask for a fresh read.
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    if (initialPrograms && retryTick === 0) {
      setPrograms(initialPrograms);
      setLoading(false);
    } else {
      let cancelled = false;
      setLoading(true);
      setError(null);
      fetchPrograms()
        .then((result) => { if (!cancelled) setPrograms(result); })
        .catch((err) => { if (!cancelled) setError(err.message); })
        .finally(() => { if (!cancelled) setLoading(false); });
      return () => { cancelled = true; };
    }
  }, [initialPrograms, retryTick]);

  const brokenCount = useMemo(() => programs.filter(p => p.health?.orphaned).length, [programs]);
  const storeCount = useMemo(() => programs.filter(p => p.source === 'store').length, [programs]);
  const chocolateyCount = useMemo(() => programs.filter(p => p.source === 'chocolatey' || p.chocolateyId).length, [programs]);
  const unsignedCount = useMemo(() => programs.filter(isUnsigned).length, [programs]);
  // Offered only when something carries the flag, like Broken and Store: the
  // backend has no launch history to derive it from, so on a list where
  // nothing is flagged this chip could only ever open an empty table.
  const unusedCount = useMemo(() => programs.filter(p => p.unused).length, [programs]);

  // Extensions, unregistered folders and Windows' own features and updates
  // are lists of their own: none is an installed program in the sense the
  // count and the total mean, and mixing them in would dilute both.
  const listFor = (id) => (id === 'extensions' ? extensions
    : id === 'unregistered' ? unregistered
      : id === 'windows' ? windowsItems
        : id === 'otherUsers' ? otherUsers
          : programs);

  /* Programs the person hid from this list (Hide from list, in the row's
   * menu), kept in settings so they stay hidden across launches. Hiding is a
   * narrowing like the filters, with the same consequences: a hidden row is
   * out of the rows, the footer's total and the heading's count -- which
   * then say "showing N of M", so the number never pretends the program is
   * gone -- and out of every selection, so a batch never reaches something
   * nobody can see. "Show hidden (N)" puts them back, badged. */
  const { settings, save: saveSettings } = useSettings();
  const hiddenKeys = useMemo(() => new Set(settings?.hiddenPrograms ?? []), [settings?.hiddenPrograms]);
  const [showHidden, setShowHidden] = useState(false);
  const isHidden = (program) => isProgramHidden(program, hiddenKeys);

  // The current source list narrowed by the filter chip, before the search.
  const inFilter = useMemo(() => {
    // Extensions are their own list, not part of the program list. That is
    // deliberate, for the same reason: an extension is
    // not an installed program, and mixing 24 of them in would dilute
    // both the count and the total.
    let list = listFor(filter);
    if (filter === 'unused') list = list.filter(p => p.unused);
    if (filter === 'broken') list = list.filter(p => p.health?.orphaned);
    if (filter === 'store') list = list.filter(p => p.source === 'store');
    if (filter === 'chocolatey') list = list.filter(p => p.source === 'chocolatey' || p.chocolateyId);
    if (filter === 'unsigned') list = list.filter(isUnsigned);
    return list;
  }, [programs, extensions, unregistered, windowsItems, otherUsers, filter]);

  // What "Show hidden" would add back to this view: counted before the
  // search, like the filter chips' own counts, so typing does not make the
  // number jump around under the pointer.
  const hiddenCount = useMemo(() => inFilter.filter(isHidden).length, [inFilter, hiddenKeys]);
  // With nothing hidden left in view the toggle disappears, and so does its
  // state: otherwise the next program hidden would stay on screen.
  useEffect(() => { if (hiddenCount === 0) setShowHidden(false); }, [hiddenCount]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = q
      ? inFilter.filter(p => p.name.toLowerCase().includes(q) || (p.publisher || '').toLowerCase().includes(q))
      : inFilter;
    if (!showHidden) list = list.filter((p) => !isHidden(p));
    return sortPrograms(list, sort.column, sort.direction);
  }, [inFilter, query, sort, showHidden, hiddenKeys]);

  const totalBytes = useMemo(
    () => filtered.reduce((sum, p) => sum + (p.sizeBytes || 0), 0),
    [filtered]
  );

  // What the page's heading needs to say about this list. The search and the
  // filter live here, the heading does not, and a count that ignores them
  // stays at "210 installed applications" over a single visible row.
  const isNarrowed = query.trim() !== '' || filter !== 'all' || (!showHidden && hiddenCount > 0);
  const shownTotal = listFor(filter).length;
  useEffect(() => {
    onViewChange?.({ filtered: isNarrowed, shown: filtered.length, total: shownTotal, bytes: filter === 'windows' ? null : totalBytes });
  }, [onViewChange, isNarrowed, filtered.length, shownTotal, totalBytes, filter]);

  // Arrow keys move between rows only while the row itself has focus. From a
  // button or checkbox inside it they are left alone, so a control that uses
  // them keeps them.
  const onRowsKeyDown = (event) => {
    if (event.target.getAttribute('role') !== 'row') return;
    const keys = { ArrowDown: 1, ArrowUp: -1 };
    if (!(event.key in keys) && event.key !== 'Home' && event.key !== 'End') return;
    const rows = [...rowsRef.current.querySelectorAll(':scope > [role="row"]')];
    const at = rows.indexOf(event.target);
    if (at < 0) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0
      : event.key === 'End' ? rows.length - 1
        : Math.min(rows.length - 1, Math.max(0, at + keys[event.key]));
    rows[next].focus();
  };
  const tabStopId = filtered.some((p) => p.id === cursorId) ? cursorId : filtered[0]?.id;

  // Which rows carry the New badge, decided once per render rather than
  // per row: every one of them would otherwise build its own Date to ask
  // the same question about the same clock.
  const newIds = useMemo(() => {
    const ids = new Set();
    for (const program of filtered) if (isRecentlyInstalled(program)) ids.add(program.id);
    return ids;
  }, [filtered]);

  // Decided once per render, like the New badge above.
  const monitoredIds = useMemo(() => {
    const ids = new Set();
    for (const program of programs) if (traceForProgram(program, traces)) ids.add(program.id);
    return ids;
  }, [programs, traces]);

  // Only what's both selected AND still on screen. Selecting rows, then
  // filtering them away, then hitting Uninstall should not remove things
  // the user can no longer see.
  const selectedPrograms = useMemo(
    () => filtered.filter((p) => selected.has(p.id)),
    [filtered, selected]
  );
  // Select all never ticks a hidden row, even with Show hidden on: hiding
  // one is "leave this out", and the header checkbox is the one control
  // that acts on rows without anyone looking at each. Ticked one by one, a
  // shown hidden row is a deliberate choice and counts like any other.
  const selectable = useMemo(() => filtered.filter((p) => canBatchUninstall(p) && !isHidden(p)), [filtered, hiddenKeys]);
  const allSelected = selectable.length > 0 && selectable.every((p) => selected.has(p.id));

  const toggleRow = (program) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(program.id)) next.delete(program.id); else next.add(program.id);
    return next;
  });

  const toggleAll = () => setSelected((prev) => {
    const next = new Set(prev);
    // Acts on the filtered view only, which is the set the header sits
    // above -- "select all" over rows you can't see would be a surprise.
    if (allSelected) for (const p of selectable) next.delete(p.id);
    else for (const p of selectable) next.add(p.id);
    return next;
  });

  const summary = batchSummary(selectedPrograms);

  /** Hides or unhides one program, saved straight away.
   *
   * Read from the query cache at the moment of the click rather than from
   * this render's `settings`: two quick hides would otherwise both start
   * from the same list and the second would put the first back. A hidden
   * row also leaves the selection, so ticking it, hiding it and showing
   * hidden again cannot bring back a tick nobody saw being kept.
   *
   * The toast carries Undo, because the row it talks about has just gone
   * from under the pointer and "where did it go" is the next question. */
  const setHidden = (program, hide) => {
    const current = queryClient.getQueryData(keys.settings)?.hiddenPrograms ?? settings?.hiddenPrograms ?? [];
    const next = withProgramHidden(current, program, hide);
    if (hide) setSelected((prev) => {
      if (!prev.has(program.id)) return prev;
      const without = new Set(prev);
      without.delete(program.id);
      return without;
    });
    saveSettings.mutate({ hiddenPrograms: next }, {
      onSuccess: () => {
        if (hide) {
          toasts.info(t('hiddenProgramsV1.hiddenToast', program.name), {
            action: { label: t('dashboardQolV3.undo.action'), onClick: () => setHidden(program, false) }
          });
        } else {
          toasts.info(t('hiddenProgramsV1.unhiddenToast', program.name));
        }
      },
      onError: (error) => toasts.error(t('hiddenProgramsV1.saveFailed'), { detail: error.message })
    });
  };

  const menuItems = menu ? rowMenuItems(menu.program, {
    t, toasts, onUninstall, onRemoveStoreApp, onRemoveSourceItem, onRemoveUnregistered,
    trace: traceForProgram(menu.program, traces), onDeleteTrace: deleteTrace,
    hidden: isHidden(menu.program), onSetHidden: setHidden
  }) : [];

  // The shape of the table that is coming, not a line of text where it
  // will be. The list takes about a second to arrive and the header,
  // filters and column set are all known before it does -- showing them
  // immediately means nothing moves when the rows land.
  if (loading) {
    const skeletonColumns = COLUMNS
      .filter((c) => COLUMN_KEYS[c.key])
      .map((c) => ({ ...c, label: t(COLUMN_KEYS[c.key]) }));
    return (
      <div className="flex flex-col min-h-0">
        <TableSkeleton columns={skeletonColumns} rows={10} label={t('applications.loading')} />
      </div>
    );
  }
  if (error) return <div className="select-text" style={{ color: 'var(--danger)' }}>{t('applications.loadError', error)}</div>;

  return (
    <div className="flex flex-col min-h-0">
      {/* Wraps rather than squeezing: with every source present the filters
          alone are ~660px, and at the 900px minimum window the search box
          was left 58px wide. The filters drop to their own line instead. */}
      <div className="flex flex-wrap items-center gap-3 mb-4 shrink-0">
        <div className="flex-1 min-w-[240px] max-w-md relative">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[color:var(--text-muted)]">
            <circle cx="11" cy="11" r="8"></circle>
            <path d="m21 21-4.35-4.35"></path>
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('applications.search.placeholder')}
            // Not labelled by the placeholder alone -- that is not an
            // accessible name, and it disappears the moment anything is
            // typed, so the field goes anonymous exactly when it has
            // content worth describing.
            aria-label={t('applications.search.label')}
            // Named so the global Ctrl+K can find it without a ref
            // threaded through App, ProgramList and the header. The
            // shortcut is app-wide; the box belongs to one screen.
            data-app-search="applications"
            className="w-full bg-[color:var(--bg-panel)] border border-[color:var(--border-subtle)] rounded-xl pl-10 pr-4 py-2 text-[13px] placeholder:text-[color:var(--text-muted)] focus:outline-none focus:border-[color:var(--accent-primary)] focus:ring-4 focus:ring-[color:var(--accent-primary)]/10 transition"
          />
        </div>
        {/* Two groups, not one row of nine. Where a program came from (All,
            Store, Chocolatey...) and what is wrong with it (unused, unsigned,
            left behind) are different questions, and together they ran past
            the five-to-seven segments a control like this can carry. Still
            one filter: choosing in either group replaces the other's choice. */}
        {[
          {
            key: 'sources',
            label: t('sigV6.groups.sources'),
            items: [
              { id: 'all', label: t('applications.filters.all') },
              ...(storeCount > 0 ? [{ id: 'store', label: t('applications.filters.storeCount', storeCount) }] : []),
              ...(chocolateyCount > 0 ? [{ id: 'chocolatey', label: t('applications.filters.chocolateyCount', chocolateyCount) }] : []),
              ...(extensions.length > 0 ? [{ id: 'extensions', label: t('applications.filters.extensionsCount', extensions.length) }] : []),
              ...(unregistered.length > 0 ? [{ id: 'unregistered', label: t('applications.filters.unregisteredCount', unregistered.length) }] : []),
              ...(windowsItems.length > 0 ? [{ id: 'windows', label: t('applications.filters.windowsCount', windowsItems.length) }] : []),
              ...(otherUsers.length > 0 ? [{ id: 'otherUsers', label: t('applications.filters.otherUsersCount', otherUsers.length) }] : [])
            ]
          },
          {
            key: 'checks',
            label: t('sigV6.groups.checks'),
            // Only offered when there's something to see. On a healthy
            // machine these would return an empty list every time, and a
            // permanently-empty view teaches people to ignore it -- when one
            // does appear, it means something.
            items: [
              ...(unusedCount > 0 ? [{ id: 'unused', label: t('applications.filters.unused') }] : []),
              ...(unsignedCount > 0 ? [{ id: 'unsigned', label: t('applications.filters.unsignedCount', unsignedCount) }] : []),
              ...(brokenCount > 0 ? [{ id: 'broken', label: t('applications.filters.brokenCount', brokenCount) }] : [])
            ]
          }
        ].filter((group) => group.items.length > 0).flatMap((group) => [(
          <div key={group.key} role="group" aria-label={group.label} className="flex items-center gap-1 p-1 bg-[color:var(--bg-panel)] border border-[color:var(--border-subtle)] rounded-xl">
            {group.items.map(f => (
              <button
                key={f.id}
                aria-pressed={filter === f.id}
                onClick={() => setFilter(f.id)}
                className={`px-3 py-1.5 rounded-lg text-[12.5px] font-medium transition ${filter === f.id ? 'pill-selected bg-[color:var(--surface-hover)] text-[color:var(--text-primary)]' : 'text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)]'}`}
              >
                {f.label}
              </button>
            ))}
          </div>
        ), ...(group.key === 'sources' && otherProfiles.length > 0 && otherUsers.length === 0 ? [(
          // An action, so not a segment: a control that shows which filter is
          // on must not also run things. Only on a PC with other accounts,
          // and only until they have been read -- then it is a filter above.
          <button key="other-accounts" className="btn-ghost px-3 py-1.5 rounded-lg text-[12.5px] font-medium" onClick={() => onOpenOtherAccounts?.()}>
            {t('otherV7.button')}
          </button>
        )] : [])])}
        {/* Not a segment of either group: it is not one more answer to
            "which list", it is on or off over whichever list is chosen. So
            it gets its own frame, the same look, and states its state with
            aria-pressed. Offered only while something in view is hidden. */}
        {hiddenCount > 0 && (
          <div className="flex items-center p-1 bg-[color:var(--bg-panel)] border border-[color:var(--border-subtle)] rounded-xl">
            <button
              aria-pressed={showHidden}
              onClick={() => setShowHidden((on) => !on)}
              className={`px-3 py-1.5 rounded-lg text-[12.5px] font-medium transition ${showHidden ? 'pill-selected bg-[color:var(--surface-hover)] text-[color:var(--text-primary)]' : 'text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)]'}`}
            >
              {t('hiddenProgramsV1.showHidden', hiddenCount)}
            </button>
          </div>
        )}
      </div>

      {/* Said while the filter is on rather than left for a tooltip: "unused"
          is a claim about the user's habits, and a technical reader checks
          what it is based on before removing anything by it. */}
      {filter === 'unused' && (
        <p className="text-[12px] text-[color:var(--text-secondary)] -mt-2 mb-3 shrink-0">{t('applications.unusedDefinition')}</p>
      )}
      {/* Both lists need saying what they are before anything in them is
          removed: one holds things that may be there on purpose, the other
          is Windows itself. */}
      {filter === 'otherUsers' && (
        <div className="flex items-start gap-4 -mt-2 mb-3 shrink-0">
          <p className="text-[12px] text-[color:var(--text-secondary)] max-w-[72ch]">{t('otherV7.definition')}</p>
          <button className="btn-ghost px-2.5 py-1 rounded-md text-[11.5px] font-medium shrink-0" onClick={() => onOpenOtherAccounts?.()}>{t('otherV7.readAgain')}</button>
        </div>
      )}
      {filter === 'unsigned' && (
        <p className="text-[12px] text-[color:var(--text-secondary)] -mt-2 mb-3 shrink-0 max-w-[72ch]">{t('sigV6.definition')}</p>
      )}
      {(filter === 'unregistered' || filter === 'windows') && (
        <p className="text-[12px] text-[color:var(--text-secondary)] -mt-2 mb-3 shrink-0 max-w-[72ch]">
          {t(filter === 'unregistered' ? 'sourcesV4.unregisteredDefinition' : 'sourcesV4.windowsDefinition')}
        </p>
      )}

      <div className="glass-panel overflow-hidden flex flex-col min-h-0">
        {/* One scroll area for the header and the rows, so a table wider than
            the window scrolls them together (the header used to stay put while
            the rows slid under it). The header sticks to the top of it, and
            sorting lives there rather than in a separate control: with eight
            columns on screen, the thing you want to sort by is already in
            front of you. */}
        <div data-table-scroll className="overflow-auto min-h-0 flex-1" style={TABLE_VARS}>
        <div role="table" aria-label={t('app.installedApplications')} aria-rowcount={filtered.length + 1}>
        <div
          role="row"
          data-table-header
          className={`${ROW_GRID} sticky top-0 z-10 border-b border-[color:var(--border-subtle)] bg-[color:var(--glass-bg)] backdrop-blur-xl shrink-0`}
        >
          {COLUMNS.map((col) => {
            const wide = NARROW_HIDDEN.includes(col.key);
            if (col.key === 'select') {
              return (
                <div key={col.key} role="columnheader" className="flex items-center">
                  <RowCheckbox
                    checked={allSelected}
                    disabled={selectable.length === 0}
                    label={allSelected ? t('applications.clearSelection') : t('applications.selectAll')}
                    onChange={toggleAll}
                  />
                </div>
              );
            }
            const active = sort.column === col.sort;
            const content = (
              <>
                {COLUMN_KEYS[col.key] ? t(COLUMN_KEYS[col.key]) : ''}
                <SortArrow active={active} direction={sort.direction} />
              </>
            );
            const classes = `flex items-center gap-1 min-h-8 text-[11px] font-mono uppercase tracking-[0.13em] ${
              active ? 'text-[color:var(--text-primary)]' : 'text-[color:var(--text-muted)]'
            } ${col.align === 'right' ? 'justify-end' : ''}`;
            const cellClass = `${wide ? WIDE_ONLY_FLEX : 'flex'} ${col.key === 'action' ? STICKY_ACTION : ''}`.trim();

            return (
              <div
                key={col.key}
                role="columnheader"
                aria-sort={col.sort ? (active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none') : undefined}
                className={cellClass}
              >
                {col.sort ? (
                  <button
                    onClick={() => setSort((s) => nextSortState(s, col.sort))}
                    className={`${classes} w-full hover:text-[color:var(--text-primary)] transition-colors`}
                  >
                    {content}
                  </button>
                ) : (
                  <span className={`${classes} w-full`}>{content}</span>
                )}
              </div>
            );
          })}
        </div>

        <div ref={rowsRef} role="rowgroup" onKeyDown={onRowsKeyDown} className="divide-y divide-[color:var(--border-subtle)]">
          {filtered.map((program) => (
            <ProgramRow
              key={program.id}
              program={program}
              tabStop={program.id === tabStopId}
              onFocusRow={() => setCursorId(program.id)}
              iconSrc={icons[program.id]}
              checked={selected.has(program.id)}
              running={Boolean(running[program.id])}
              isNew={newIds.has(program.id)}
              monitored={monitoredIds.has(program.id)}
              hidden={showHidden && isHidden(program)}
              onToggle={() => toggleRow(program)}
              onUninstall={onUninstall}
              onRemoveStoreApp={onRemoveStoreApp}
              onRemoveSourceItem={onRemoveSourceItem}
              onRemoveUnregistered={onRemoveUnregistered}
              onContextMenu={openMenu}
            />
          ))}
        </div>
        </div>

        <div className="divide-y divide-[color:var(--border-subtle)]">
          {filtered.length === 0 && (
            // An empty result with no search and no filter is a different
            // situation from all the others below it: 'all' plus an empty
            // query never filters anything out, so this exact combination
            // means the backend itself found zero programs -- and a real
            // Windows install always has dozens. Reported live (2026-09):
            // a fresh Windows 10 machine showed this screen empty because
            // the registry read failed silently. The backend now retries
            // and falls back before giving up, but if it still comes back
            // empty, saying so plainly and offering Retry beats "Nothing
            // matches", which blames a filter that was never set.
            query.trim() === '' && filter === 'all' && programs.length === 0 ? (
              <div className="text-center py-16 px-6">
                <p className="text-[13px] text-[color:var(--text-secondary)]">
                  {t('applications.empty.noPrograms')}
                </p>
                <button
                  className="btn-ghost mt-4 px-3.5 py-2 rounded-lg text-[12.5px] font-medium"
                  onClick={() => setRetryTick((n) => n + 1)}
                >
                  {t('applications.retry')}
                </button>
              </div>
            ) : query.trim() === '' && !showHidden && hiddenCount > 0 && hiddenCount === inFilter.length ? (
              // Everything in this view is hidden. "Clear search and filters"
              // would not bring anything back, so the way back is offered.
              <div className="text-center py-16 px-6">
                <p className="text-[13px] text-[color:var(--text-secondary)]">
                  {t('hiddenProgramsV1.allHidden')}
                </p>
                <button
                  className="btn-ghost mt-4 px-3.5 py-2 rounded-lg text-[12.5px] font-medium"
                  onClick={() => setShowHidden(true)}
                >
                  {t('hiddenProgramsV1.showHidden', hiddenCount)}
                </button>
              </div>
            ) : (
              // Any other empty result on this screen is almost always a
              // filter the user forgot, not an empty machine. So it says
              // which filter is responsible and offers to undo it, rather
              // than reporting the absence and stopping.
              <div className="text-center py-16 px-6">
                <p className="text-[13px] text-[color:var(--text-secondary)]">
                  {query.trim() && filter !== 'all'
                    ? t('applications.empty.withQueryAndFilter', query.trim(), t(`applications.filters.${filter}`))
                    : query.trim()
                      ? t('applications.empty.withQuery', query.trim())
                      : t('applications.empty.withFilter', t(`applications.filters.${filter}`))}
                </p>
                <p className="text-[12.5px] text-[color:var(--text-muted)] mt-1.5">
                  {t('applications.empty.hiddenCount', listFor(filter).length)}
                </p>
                <button
                  className="btn-ghost mt-4 px-3.5 py-2 rounded-lg text-[12.5px] font-medium"
                  onClick={() => { setQuery(''); setFilter('all'); }}
                >
                  {t('applications.empty.clear')}
                </button>
              </div>
            )
          )}
        </div>
        </div>

        {/* The installation count sits at the bottom of the window,
            and it earns the space: it's the one number that changes as
            you filter. */}
        {summary.count > 0 ? (
          // The footer becomes the batch bar once anything is ticked,
          // rather than a separate strip appearing and pushing the table:
          // it's the same row of information, about a smaller set.
          <div className="flex items-center justify-between gap-4 px-4 py-2 border-t border-[color:var(--accent-primary)]/25 bg-[color:var(--accent-primary)]/[0.07] shrink-0">
            <span className="text-[12px] text-[color:var(--text-secondary)]">
              <span className="text-[color:var(--text-primary)] font-medium">{t('applications.footer.selected', summary.count)}</span>{' · '}
              <span className="font-mono">{formatBytes(summary.totalBytes)}</span>
              {summary.unknownSizes > 0 && (
                <span className="text-[color:var(--text-muted)]"> {t('applications.footer.unknownSizes', summary.unknownSizes)}</span>
              )}
            </span>
            <div className="flex items-center gap-2.5">
              <button
                className="min-h-6 px-2 text-[11.5px] text-[color:var(--text-secondary)] hover:text-[color:var(--accent-primary)] transition-colors"
                onClick={() => setSelected(new Set())}
              >
                {t('applications.footer.clear')}
              </button>
              <button
                className="btn-danger px-3.5 py-1.5 rounded-lg text-[12px] font-medium"
                onClick={() => onBatchUninstall?.(selectedPrograms)}
              >
                {t('applications.footer.uninstallCount', summary.count)}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-4 px-4 py-2 border-t border-[color:var(--border-subtle)] bg-[color:var(--surface-subtle)] shrink-0 text-[11.5px] font-mono text-[color:var(--text-muted)]">
            <span>
              {filtered.length === programs.length
                ? t('applications.footer.installations', programs.length)
                // Against the list actually being filtered. Extensions are
                // their own list, so "24 of 210" would be comparing them
                // against a total they are not part of.
                : t('applications.footer.showingOf', filtered.length, listFor(filter).length)}
              {/* The count the old New Programs heading used to carry, and
                  the only place the column's window is spelled out. A
                  badge saying New is not self-explanatory about how new. */}
              {newIds.size > 0 && (
                <span className="text-[color:var(--text-secondary)]">
                  {' · '}{t('applications.footer.newInDays', newIds.size, RECENT_DAYS)}
                </span>
              )}
            </span>
            {/* Windows features and updates have no size to add up. */}
            {filter !== 'windows' && <span>{formatBytes(totalBytes)} {t('applications.footer.total')}</span>}
          </div>
        )}
      </div>

      <ContextMenu
        // A row with nothing to offer (a feature Windows depends on) opens no
        // empty menu.
        open={Boolean(menu) && menuItems.length > 0}
        x={menu?.x ?? 0}
        y={menu?.y ?? 0}
        onClose={() => setMenu(null)}
        items={menuItems}
      />
    </div>
  );
}

/** What a right-click on a row offers.
 *
 * Nothing here is new behaviour: Uninstall hands the program to the same
 * handlers the row's own button does (so it opens the same confirmation
 * dialog and removes nothing by itself), Open folder is the Folder button,
 * and Copy is a read. An item that has nothing to act on is left out rather
 * than shown dead. */
export function rowMenuItems(program, { t, toasts, onUninstall, onRemoveStoreApp, onRemoveSourceItem, onRemoveUnregistered, trace = null, onDeleteTrace, hidden = false, onSetHidden }) {
  const items = [];

  if (program.installLocation) {
    items.push({
      label: t('applications.openFolder'),
      onSelect: () => revealInExplorer(program.installLocation)
        .catch((error) => toasts.error(t('applications.reveal.notFound'), { detail: error.message }))
    });
  }

  if (program.uninstallString && program.source !== 'store' && program.source !== 'extension') {
    items.push({
      label: t('applications.copyUninstallCommand'),
      onSelect: () => Promise.resolve()
        .then(() => navigator.clipboard.writeText(program.uninstallString))
        .then(() => toasts.info(t('applications.commandCopied')))
        .catch(() => toasts.error(t('applications.copyFailed')))
    });
  }

  // Forgetting what the install monitor recorded. It changes nothing on the
  // machine; the program just loses its Monitored badge and its exactness.
  if (trace && onDeleteTrace) {
    items.push({ label: t('uninstallerV3.monitor.menuDelete'), onSelect: () => onDeleteTrace(trace) });
  }

  // Out of the list, not off the machine: nothing about the program changes,
  // and Show hidden brings it back. Its own group, because it is about the
  // list rather than the program.
  if (onSetHidden) {
    items.push(hidden
      ? { label: t('hiddenProgramsV1.unhide'), separated: items.length > 0, onSelect: () => onSetHidden(program, false) }
      : { label: t('hiddenProgramsV1.hide'), separated: items.length > 0, onSelect: () => onSetHidden(program, true) });
  }

  // The removal goes LAST, set apart and in the danger style: the menu opens
  // with focus on the menu itself, and the choice that deletes is the one a
  // stray arrow key should reach last, not first.
  const removal = [];
  if (program.source === 'feature' && program.protected) {
    // Nothing to offer: see the row's "Required".
  } else if (program.source === 'feature') {
    removal.push({ label: t('sourcesV4.actions.turnOff'), danger: true, onSelect: () => onRemoveSourceItem?.(program) });
  } else if (program.source === 'update' || program.source === 'chocolatey') {
    removal.push({ label: t('applications.uninstall'), danger: true, onSelect: () => onRemoveSourceItem?.(program) });
  } else if (program.source === 'otherUser') {
    if (program.installLocation) removal.push({ label: t('sourcesV4.actions.remove'), danger: true, onSelect: () => onRemoveUnregistered?.(program) });
  } else if (program.source === 'unregistered') {
    removal.push({ label: t('sourcesV4.actions.remove'), danger: true, onSelect: () => onRemoveUnregistered?.(program) });
  } else if (program.source === 'store' && program.nonRemovable) {
    removal.push({
      label: t('applications.inWindows.button'),
      onSelect: () => { openInstalledAppsSettings().catch(() => {}); }
    });
  } else if (program.source === 'store') {
    removal.push({ label: t('applications.uninstall'), danger: true, onSelect: () => onRemoveStoreApp?.(program) });
  } else if (program.source !== 'extension') {
    removal.push({
      label: program.health?.orphaned ? t('applications.forceRemove') : t('applications.uninstall'),
      danger: true,
      onSelect: () => onUninstall?.(program)
    });
  }
  // A program a package installed keeps its own uninstaller as the main
  // way; Chocolatey's is offered beside it, which keeps the package record true.
  if (program.chocolateyId && program.source !== 'chocolatey') {
    removal.push({ label: t('sourcesV4.actions.chocoUninstall'), danger: true, onSelect: () => onRemoveSourceItem?.(program) });
  }
  // A divider above a lone item would separate it from nothing.
  if (items.length > 0) removal.forEach((item) => { item.separated = true; });
  items.push(...removal);

  return items;
}
