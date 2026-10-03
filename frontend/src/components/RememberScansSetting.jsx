import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchAutoScans, deleteAutoScans } from '../lib/api.js';
import { keys } from '../lib/queryClient.js';
import { formatBytes } from '../lib/formatBytes.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import Toggle from './Toggle.jsx';

/** Settings -> General -> "Remember the last Disk Map scan of each drive".
 *
 * On by default. The help text says what it keeps and roughly how much disk it
 * takes before anyone has to wonder, and while any automatic scans exist the
 * count and size are shown. Switching it off stops the saving at once; if there
 * are scans already saved, it asks whether to delete them rather than either
 * silently keeping or silently deleting. Scans saved by hand are never touched. */
export default function RememberScansSetting({ remembering, onChange }) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [keptOnPurpose, setKeptOnPurpose] = useState(false);
  const [justDeleted, setJustDeleted] = useState(false);

  const usage = useQuery({
    queryKey: [...keys.autoScansAll, 'usage'],
    queryFn: () => fetchAutoScans(),
    staleTime: 0,
    retry: false
  });
  const remove = useMutation({
    mutationFn: () => deleteAutoScans(),
    onSuccess: () => {
      setJustDeleted(true);
      queryClient.invalidateQueries({ queryKey: keys.autoScansAll });
    }
  });

  const count = usage.data?.count ?? 0;
  const title = t('diskMapQolV3.setting.title');
  const offerDelete = !remembering && count > 0 && !keptOnPurpose;

  const toggle = () => {
    setKeptOnPurpose(false);
    setJustDeleted(false);
    onChange(!remembering);
  };

  return (
    <div className="glass-panel p-6">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[14px] font-medium text-[color:var(--text-primary)]">{title}</div>
          <p className="text-[12.5px] text-[color:var(--text-secondary)] mt-1 leading-relaxed max-w-[110ch]">
            {t('diskMapQolV3.setting.description')}
          </p>
        </div>
        <Toggle checked={remembering} onChange={toggle} label={title} />
      </div>

      {count > 0 && (
        <p className="mt-3 text-[12.5px] font-mono text-[color:var(--text-muted)]">
          {t('diskMapQolV3.setting.usage', count, formatBytes(usage.data.bytes))}
        </p>
      )}

      {offerDelete && (
        <div className="mt-3 flex items-center gap-3 flex-wrap">
          <p className="text-[12.5px] text-[color:var(--text-primary)]">{t('diskMapQolV3.setting.deleteQuestion')}</p>
          <div className="flex items-center gap-2">
            <button type="button" className="btn-danger px-3 py-1.5 rounded-lg text-[12px] font-medium disabled:opacity-50" onClick={() => remove.mutate()} disabled={remove.isPending}>
              {t('diskMapQolV3.setting.deleteNow')}
            </button>
            <button type="button" className="btn-ghost px-3 py-1.5 rounded-lg text-[12px] font-medium" onClick={() => setKeptOnPurpose(true)} disabled={remove.isPending}>
              {t('diskMapQolV3.setting.keep')}
            </button>
          </div>
        </div>
      )}
      {remove.isError && (
        <p role="alert" className="mt-2 text-[12.5px] text-[color:var(--danger)] select-text">{t('diskMapQolV3.setting.deleteFailed', remove.error.message)}</p>
      )}
      {justDeleted && !remove.isError && count === 0 && (
        <p role="status" className="mt-2 text-[12.5px] text-[color:var(--text-secondary)]">{t('diskMapQolV3.setting.deleted')}</p>
      )}
    </div>
  );
}
