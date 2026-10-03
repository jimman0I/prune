import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchScheduledClean, setScheduledClean } from '../lib/api.js';
import { keys } from '../lib/queryClient.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import Toggle from './Toggle.jsx';
import LastAutoClean from './LastAutoClean.jsx';

/** Windows Task Scheduler's own codes that are not failures: 0 success, 1 a
 * rule reported an error (the last-clean line already says so), 267009 running,
 * 267011 not run yet, 267014 stopped by the user. */
const QUIET_RESULTS = new Set([0, 1, 267009, 267011, 267014]);

/** Settings -> Cleanup -> under the schedule: "Also run when Prune is closed".
 *
 * An opt-in, off by default: it registers a Windows scheduled task, so it is
 * only ever created by this switch, and the help text says what that task is --
 * for this account only, no administrator rights, no stored password, the same
 * command line anyone can run, and removed again by turning this off or
 * uninstalling Prune. It follows the schedule above it (there is no second
 * schedule to set).
 *
 * The switch shows the task as Windows has it, read by the backend, not a copy
 * in settings.json. It is offered only in the installed app on Windows, and
 * only while the schedule cleans; otherwise it is off and says why. */
export default function BackgroundCleanSetting({ automation }) {
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();

  const status = useQuery({
    queryKey: keys.scheduledClean,
    queryFn: () => fetchScheduledClean(),
    retry: false,
    // So "next run" does not sit frozen, and a task changed outside Prune shows.
    refetchInterval: 30_000
  });
  const change = useMutation({
    mutationFn: (enabled) => setScheduledClean(enabled),
    // The reply is the state read back from Windows, so it replaces the cache.
    onSuccess: (updated) => {
      queryClient.setQueryData(keys.scheduledClean, (current) => ({ ...current, ...updated }));
      queryClient.invalidateQueries({ queryKey: keys.automation });
    }
  });

  const data = status.data;
  const supported = data?.supported === true;
  const exists = supported && data?.exists === true;
  const cleans = automation?.task === 'clean';
  const title = t('backgroundV3.task.title');

  // Off and explained when it cannot be offered. An existing task can always be
  // switched off, whatever else is true.
  let reason = null;
  if (data && !supported) reason = data.reason === 'cli-missing' ? t('backgroundV3.task.cliMissing') : t('backgroundV3.task.unsupported');
  else if (data && supported && !cleans && !exists) reason = t('backgroundV3.task.needsClean');

  const disabled = !data || change.isPending || (!exists && (!supported || !cleans));
  const nextRun = exists && data.nextRun ? new Date(data.nextRun).toLocaleString(language) : null;
  const failedCode = exists && data.lastRun && Number.isFinite(data.lastTaskResult) && !QUIET_RESULTS.has(data.lastTaskResult) ? data.lastTaskResult : null;

  return (
    <div className="mt-5 pt-5 border-t border-[color:var(--border-subtle)]" data-testid="background-clean">
      <div data-setting-row className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-[13.5px] font-medium text-[color:var(--text-primary)]">{title}</h3>
          <p className="text-[12.5px] text-[color:var(--text-secondary)] mt-1 leading-relaxed max-w-[62ch]">
            {t('backgroundV3.task.description')}
          </p>
        </div>
        <Toggle checked={exists} onChange={() => change.mutate(!exists)} label={title} disabled={disabled} />
      </div>

      <div className="mt-3 flex flex-col gap-1.5 text-[12px]">
        {status.isError && <p role="alert" className="text-[color:var(--danger)] select-text">{t('backgroundV3.task.loadFailed', status.error.message)}</p>}
        {change.isError && <p role="alert" className="text-[color:var(--danger)] select-text">{t('backgroundV3.task.saveFailed', change.error.message)}</p>}
        {reason && <p className="text-[color:var(--text-muted)] max-w-[62ch]">{reason}</p>}
        {supported && <p className="text-[color:var(--text-secondary)] max-w-[62ch]">{t('backgroundV3.task.detail')}</p>}
        {exists && data.inSync === false && <p className="text-[color:var(--warning)] max-w-[62ch]">{t('backgroundV3.task.outOfSync')}</p>}
        {nextRun && (
          <p className="text-[color:var(--text-secondary)]">
            {t('backgroundV3.task.nextRun', nextRun)}
          </p>
        )}
        {failedCode !== null && <p className="text-[color:var(--warning)]">{t('backgroundV3.task.taskFailed', failedCode)}</p>}
        <LastAutoClean />
      </div>
    </div>
  );
}
