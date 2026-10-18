import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSingleFlight } from '../hooks/useSingleFlight.js';
import { scanOtherAccounts } from '../lib/programSourcesApi.js';
import { keys } from '../lib/queryClient.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';

/** Reading the programs the other accounts on this PC installed for
 * themselves (backend services/otherAccounts.js).
 *
 * One question, asked before anything happens: this needs administrator
 * permission and changes nothing. Afterwards, what each account gave up,
 * and the list gains an "Other accounts" filter. A registry file Windows
 * did not release is said plainly, because it is the one outcome that
 * affects somebody else: that person's next sign-in. */
export default function OtherAccountsDialog({ profiles, onClose, onBusyChange }) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [state, setState] = useState('asking');
  const [scan, setScan] = useState(null);
  const [note, setNote] = useState(null);
  const [error, setError] = useState(null);

  const busy = state === 'scanning';
  const onBusyChangeRef = useRef(onBusyChange);
  onBusyChangeRef.current = onBusyChange;
  useEffect(() => { onBusyChangeRef.current?.(busy); }, [busy]);
  useEffect(() => () => onBusyChangeRef.current?.(false), []);

  const start = useSingleFlight(async () => {
    setState('scanning');
    setNote(null);
    setError(null);
    try {
      const result = await scanOtherAccounts();
      if (result.cancelled) {
        setNote(t('otherV7.cancelled'));
        setState('asking');
        return;
      }
      setScan(result.scan);
      setState('done');
      queryClient.invalidateQueries({ queryKey: keys.otherAccounts });
    } catch (err) {
      setError(err.message);
      setState('asking');
    }
  });

  return (
    <div className="glass-panel w-full max-w-[520px] p-6 rounded-xl">
      <h2 className="display-heading text-[19px] mb-2">{t('otherV7.title')}</h2>

      {state === 'done' && scan ? (
        <div role="status">
          <ul className="space-y-1.5 mb-4">
            {scan.accounts.map((account) => (
              <li key={account.sid} className="flex items-center justify-between gap-4 px-3.5 py-2 rounded-lg bg-[color:var(--surface-subtle)]">
                <span className="text-[12.5px] truncate">{account.name}</span>
                <span className={`text-[11.5px] font-mono shrink-0 ${account.error ? 'text-[color:var(--warning)]' : 'text-[color:var(--text-secondary)]'}`}>
                  {account.error ? t('otherV7.unreadable') : t('otherV7.found', account.count)}
                </span>
              </li>
            ))}
          </ul>
          {scan.stuck?.length > 0 && (
            <p role="alert" className="text-[12.5px] text-[color:var(--danger)] leading-snug mb-4">{t('otherV7.stuck')}</p>
          )}
          <p className="text-[12.5px] text-[color:var(--text-secondary)] leading-relaxed mb-5">
            {scan.programs.length > 0 ? t('otherV7.whereToFind') : t('otherV7.nothingFound')}
          </p>
        </div>
      ) : (
        <>
          <p className="text-[13px] text-[color:var(--text-secondary)] leading-relaxed mb-3">{t('otherV7.intro')}</p>
          <p className="text-[12px] text-[color:var(--text-muted)] mb-5">{t('otherV7.accounts', profiles.map((p) => p.name).join(', '))}</p>
        </>
      )}

      {note && <p role="status" className="text-[12px] text-[color:var(--text-secondary)] leading-snug mb-4">{note}</p>}
      {error && <p role="alert" className="text-[12px] text-[color:var(--danger)] leading-snug mb-4 select-text">{error}</p>}

      <div className="flex justify-end gap-2">
        <button type="button" className="btn-ghost px-3 py-1.5 rounded-md text-[12.5px] disabled:opacity-40" onClick={onClose} disabled={busy}>
          {state === 'done' ? t('otherV7.close') : t('otherV7.cancel')}
        </button>
        {state !== 'done' && (
          <button type="button" className="btn-primary px-3 py-1.5 rounded-md text-[12.5px] font-medium" aria-busy={busy || undefined} onClick={start}>
            {busy ? t('otherV7.scanning') : t('otherV7.scan')}
          </button>
        )}
      </div>
    </div>
  );
}
