import { useQuery } from '@tanstack/react-query';
import { fetchAutomation } from '../lib/api.js';
import { keys } from '../lib/queryClient.js';

/** The scheduled run, and an honest account of what it can do.
 *
 * The limitation is stated on the screen rather than buried: this runs
 * while Prune is running. A Windows scheduled task would fire with the
 * app closed, but there is no headless entry point for one to invoke, and
 * launching the whole desktop app at 2 AM to clean unattended would put a
 * window on screen nobody asked for. So it catches up instead -- and says
 * how many windows went by while the machine was off, which is the
 * difference between "broken" and "your computer was asleep".
 */
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-mono uppercase tracking-[0.13em] text-[color:var(--text-muted)]">
        {label}
      </span>
      {children}
    </label>
  );
}

const selectClass =
  'font-mono text-[12.5px] px-3 py-2 rounded-lg bg-white/[0.04] border border-[color:var(--border-subtle)] text-[color:var(--text-primary)] focus:outline-none focus:border-[color:var(--accent-primary)]/50';

export default function AutomationSettings({ settings, save }) {
  const automation = settings?.automation ?? {};
  const status = useQuery({
    queryKey: keys.automation,
    queryFn: fetchAutomation,
    // Refetched while this screen is open so "next run" does not sit
    // frozen at whatever it was when the tab was opened.
    refetchInterval: 30_000,
    staleTime: 0
  });

  const set = (partial) => save({ automation: { ...automation, ...partial } });

  const nextRun = status.data?.nextRun ? new Date(status.data.nextRun) : null;
  const lastResult = status.data?.lastResult ?? null;

  return (
    <div>
      <h3 className="text-[13.5px] font-medium text-[color:var(--text-primary)] mb-1.5">Automation</h3>
      <p className="text-[12.5px] text-[color:var(--text-secondary)] mb-4 max-w-[62ch]">
        Runs while Prune is open. It cannot wake a sleeping machine — a window that passes while
        the computer is off is reported as missed rather than silently skipped, and caught up the
        next time you open the app.
      </p>

      <div className="flex items-center gap-3 mb-4">
        <button
          type="button"
          role="switch"
          aria-checked={automation.enabled === true}
          onClick={() => set({ enabled: !automation.enabled })}
          className={`w-[38px] h-[21px] rounded-full relative transition-colors shrink-0 ${
            automation.enabled ? 'bg-[color:var(--accent-primary)]' : 'bg-white/[0.12]'
          }`}
        >
          <span
            className="absolute top-[3px] w-[15px] h-[15px] rounded-full bg-white transition-all"
            style={{ left: automation.enabled ? '20px' : '3px' }}
          />
        </button>
        <span className="text-[12.5px] text-[color:var(--text-secondary)]">
          {automation.enabled ? 'Scheduled' : 'Off'}
        </span>
      </div>

      {automation.enabled && (
        <>
          <div className="flex flex-wrap gap-3 mb-4">
            <Field label="How often">
              <select
                className={selectClass}
                value={automation.frequency ?? 'weekly'}
                onChange={(e) => set({ frequency: e.target.value })}
              >
                <option value="daily">Every day</option>
                <option value="weekly">Every week</option>
              </select>
            </Field>

            {automation.frequency === 'weekly' && (
              <Field label="Day">
                <select
                  className={selectClass}
                  value={automation.weekday ?? 0}
                  onChange={(e) => set({ weekday: Number(e.target.value) })}
                >
                  {WEEKDAYS.map((day, i) => <option key={day} value={i}>{day}</option>)}
                </select>
              </Field>
            )}

            <Field label="At">
              <input
                type="time"
                className={selectClass}
                value={`${String(automation.hour ?? 2).padStart(2, '0')}:${String(automation.minute ?? 0).padStart(2, '0')}`}
                onChange={(e) => {
                  const [hour, minute] = e.target.value.split(':').map(Number);
                  if (Number.isInteger(hour) && Number.isInteger(minute)) set({ hour, minute });
                }}
              />
            </Field>

            <Field label="What it does">
              <select
                className={selectClass}
                value={automation.task ?? 'scan'}
                onChange={(e) => set({ task: e.target.value })}
              >
                <option value="scan">Measure only</option>
                <option value="clean">Clean</option>
              </select>
            </Field>
          </div>

          {/* Said plainly, and only when it applies. An unattended clean is
              the one setting on this screen that removes files with nobody
              watching, and it should read as the bigger commitment it is. */}
          {automation.task === 'clean' && (
            <div className="mb-4 px-3.5 py-3 rounded-xl bg-[color:var(--warning-soft)] border border-[color:var(--warning)]/25">
              <p className="text-[12.5px] text-[color:var(--warning)]">
                This removes files with nobody watching. It cleans the rules Deep Clean recommends
                and that actually have something in them, and everything still goes to quarantine —
                so check the retention setting above before leaving this on.
              </p>
            </div>
          )}

          <div className="text-[12px] text-[color:var(--text-secondary)] space-y-1">
            <p>
              Next run:{' '}
              <span className="font-mono text-[color:var(--text-primary)]">
                {nextRun ? nextRun.toLocaleString() : '—'}
              </span>
            </p>
            {lastResult && (
              <p>
                Last run:{' '}
                <span className="font-mono text-[color:var(--text-primary)]">
                  {new Date(lastResult.at).toLocaleString()}
                </span>
                {' — '}
                {lastResult.ok === false
                  ? <span className="text-[color:var(--danger)]">{lastResult.error}</span>
                  : lastResult.summary}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
