import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchRunAsAdmin, setRunAsAdmin } from '../lib/api.js';
import { keys } from '../lib/queryClient.js';
import { useAdminAccess } from '../hooks/useAdminAccess.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import AdminRestartButton from './AdminRestartButton.jsx';
import Toggle from './Toggle.jsx';

/** Settings -> General -> "Always run as administrator".
 *
 * An opt-in, off by default, because it is a trade and not a free upgrade:
 * a UAC prompt on every start, no drag-and-drop from a normal Explorer window
 * (an elevated program is walled off from a non-elevated sender), no silent
 * start at sign-in, and every action running with full rights. The help text
 * lists those before anyone turns it on.
 *
 * The switch shows the flag Windows actually honours -- read from the
 * registry by the backend (services/runAsAdmin.js), not from a copy in
 * settings.json -- so it cannot drift from what happens at launch. Changing it
 * takes effect from the next start; when Prune is not elevated now, the
 * "Restart Prune as administrator" button applies it immediately.
 *
 * It warns, and does not decide, when Prune is also set to start with
 * Windows: an elevated program is not started silently at sign-in, and
 * whether to keep that startup entry is the person's call. */
export default function RunAsAdminSetting() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const admin = useAdminAccess();

  const status = useQuery({ queryKey: keys.runAsAdmin, queryFn: () => fetchRunAsAdmin(), retry: false });
  const change = useMutation({
    mutationFn: (enabled) => setRunAsAdmin(enabled),
    // The reply is the state read back from the registry, so it replaces the
    // cache; a failure leaves the switch where Windows has it.
    onSuccess: (updated) => queryClient.setQueryData(keys.runAsAdmin, updated)
  });

  const data = status.data;
  const supported = data?.supported === true;
  const enabled = supported && data?.enabled === true;
  const elevatedNow = data?.elevatedNow === true;
  const title = t('runAsAdminV3.title');

  // What to tell the person, in the order it matters: a failure first, then
  // where things stand, then the one thing they may want to act on.
  const notes = [];
  if (status.isError) notes.push(<p key="load" role="alert" className="text-[color:var(--danger)] select-text">{t('runAsAdminV3.loadFailed', status.error.message)}</p>);
  if (change.isError) notes.push(<p key="save" role="alert" className="text-[color:var(--danger)] select-text">{t('runAsAdminV3.saveFailed', change.error.message)}</p>);
  if (data && !supported) notes.push(<p key="unsupported" className="text-[color:var(--text-muted)]">{t('runAsAdminV3.unsupported')}</p>);
  if (elevatedNow) notes.push(<p key="running" className="text-[color:var(--text-primary)]">{t('runAsAdminV3.running')}</p>);
  if (supported && enabled !== elevatedNow) notes.push(<p key="next" className="text-[color:var(--text-secondary)]">{t('runAsAdminV3.nextStart')}</p>);
  if (enabled && data?.startsWithWindows) notes.push(<p key="startup" className="text-[color:var(--warning)] max-w-[62ch]">{t('runAsAdminV3.startupConflict')}</p>);
  return (
    <div className="glass-panel p-6">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[14px] font-medium text-[color:var(--text-primary)]">{title}</div>
          <p className="text-[12.5px] text-[color:var(--text-secondary)] mt-1 leading-relaxed max-w-[62ch]">
            {t('runAsAdminV3.description')}
          </p>
        </div>
        <Toggle
          checked={enabled}
          onChange={() => change.mutate(!enabled)}
          label={title}
          disabled={!supported || change.isPending}
        />
      </div>

      <div className="mt-4 pt-4 border-t border-[color:var(--border-subtle)]">
        <h3 className="text-[11px] font-mono uppercase tracking-[0.14em] text-[color:var(--text-muted)] mb-2">{t('runAsAdminV3.costsHeading')}</h3>
        <ul className="list-disc pl-5 flex flex-col gap-1 text-[12.5px] text-[color:var(--text-secondary)] leading-relaxed max-w-[62ch]">
          <li>{t('runAsAdminV3.costUac')}</li>
          <li>{t('runAsAdminV3.costDragDrop')}</li>
          <li>{t('runAsAdminV3.costStartup')}</li>
          <li>{t('runAsAdminV3.costRights')}</li>
        </ul>
      </div>

      {notes.length > 0 && <div className="mt-4 flex flex-col gap-2 text-[12.5px]">{notes}</div>}
      {/* Apply it now: only once it is on, and only for a Prune that is not
          elevated. The button itself is further gated by the admin status. */}
      {enabled && !elevatedNow && (
        <div className="mt-3"><AdminRestartButton admin={admin} /></div>
      )}
    </div>
  );
}
