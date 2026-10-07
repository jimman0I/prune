import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchStartWithWindows, setStartWithWindows } from '../lib/api.js';
import { keys } from '../lib/queryClient.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import Toggle from './Toggle.jsx';

/** Settings -> General -> "Start Prune when I sign in to Windows".
 *
 * An opt-in, off by default: it adds one entry to the per-user Run key, which
 * is the thing programs do to start themselves, so it is only ever written by
 * this switch and the help text says it is for this account only and needs no
 * administrator rights. The sub-option decides whether it starts minimised
 * (to the tray, or to the taskbar when the tray setting is off).
 *
 * Both switches show the entry Windows actually honours -- read from the
 * registry by the backend (services/startWithWindows.js), not from a copy in
 * settings.json -- so they cannot drift from what happens at sign-in.
 *
 * It warns, and does not decide, when "Always run as administrator" is also
 * on: Windows asks for approval every time for an elevated program (or does
 * not start it), so it will not start silently at sign-in. */
export default function StartWithWindowsSetting() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();

  const status = useQuery({ queryKey: keys.startWithWindows, queryFn: () => fetchStartWithWindows(), retry: false });
  const change = useMutation({
    mutationFn: (request) => setStartWithWindows(request),
    // The reply is the state read back from the registry, so it replaces the
    // cache; a failure leaves the switches where Windows has them.
    onSuccess: (updated) => queryClient.setQueryData(keys.startWithWindows, updated)
  });

  const data = status.data;
  const supported = data?.supported === true;
  const enabled = supported && data?.enabled === true;
  const minimized = supported && data?.minimized === true;
  const title = t('backgroundV3.startup.title');
  const minimizedTitle = t('backgroundV3.startup.minimizedTitle');
  const busy = change.isPending;

  const notes = [];
  if (status.isError) notes.push(<p key="load" role="alert" className="text-[color:var(--danger)] select-text">{t('backgroundV3.startup.loadFailed', status.error.message)}</p>);
  if (change.isError) notes.push(<p key="save" role="alert" className="text-[color:var(--danger)] select-text">{t('backgroundV3.startup.saveFailed', change.error.message)}</p>);
  if (data && !supported) notes.push(<p key="unsupported" className="text-[color:var(--text-muted)]">{t('backgroundV3.startup.unsupported')}</p>);
  if (supported && data.disabledByWindows) notes.push(<p key="windows" className="text-[color:var(--text-secondary)] max-w-[110ch]">{t('backgroundV3.startup.disabledByWindows')}</p>);
  if (supported && data.foreign && !enabled) notes.push(<p key="foreign" className="text-[color:var(--text-secondary)] max-w-[110ch]">{t('backgroundV3.startup.foreign')}</p>);
  if (enabled && data.runAsAdmin) notes.push(<p key="admin" role="status" className="text-[color:var(--warning)] max-w-[110ch]">{t('backgroundV3.startup.adminConflict')}</p>);

  return (
    <div className="py-3 first:pt-0 last:pb-0" data-testid="start-with-windows">
      <div data-setting-row className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[13.5px] font-medium text-[color:var(--text-primary)]">{title}</div>
          <p className="text-[12.5px] text-[color:var(--text-secondary)] mt-1 leading-relaxed max-w-[110ch]">
            {t('backgroundV3.startup.description')}
          </p>
        </div>
        <Toggle
          checked={enabled}
          // Switching on starts minimised: a program that opens itself at
          // sign-in is expected to stay out of the way. The sub-switch changes it.
          onChange={() => change.mutate(enabled ? { enabled: false } : { enabled: true, minimized: true })}
          label={title}
          disabled={!supported || busy}
        />
      </div>

      <div data-setting-row className="mt-4 pt-4 border-t border-[color:var(--border-subtle)] flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className={`text-[13.5px] font-medium ${enabled ? 'text-[color:var(--text-primary)]' : 'text-[color:var(--text-muted)]'}`}>{minimizedTitle}</div>
          <p className="text-[12.5px] text-[color:var(--text-secondary)] mt-1 leading-relaxed max-w-[110ch]">
            {t('backgroundV3.startup.minimizedNote')}
          </p>
        </div>
        <Toggle
          checked={minimized}
          onChange={() => change.mutate({ enabled: true, minimized: !minimized })}
          label={minimizedTitle}
          disabled={!enabled || busy}
        />
      </div>

      {notes.length > 0 && <div className="mt-4 flex flex-col gap-2 text-[12.5px]">{notes}</div>}
    </div>
  );
}
