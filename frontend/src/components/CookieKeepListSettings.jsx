import { useState } from 'react';
import { fetchCookieDomains } from '../lib/api.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';

/** Cookies to Preserve: closes the gap left by Phase C, which built
 * cookieKeepList's engine with no UI to populate it. Real data, not a
 * free-text field -- an explicit "Scan for cookies" click reads every
 * real cookie database this app already knows how to find (the same
 * `cookie`-action rules cleaners.json's own chrome/brave/edge_cookies
 * rules use), and the user ticks which domains survive a Deep Clean.
 *
 * No auto-scan on mount, matching Deep Clean's own Preview and Disk
 * Map's own fast-scan convention: nothing that reads every browser's
 * profile data happens without an explicit click. */
export default function CookieKeepListSettings({ settings, save }) {
  const { t } = useLanguage();
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [scanError, setScanError] = useState(null);
  const [filter, setFilter] = useState('');

  const keepList = Array.isArray(settings?.cookieKeepList) ? settings.cookieKeepList : [];

  const handleScan = async () => {
    setScanning(true);
    setScanError(null);
    try {
      setScanResult(await fetchCookieDomains());
    } catch (err) {
      setScanError(err.message);
    } finally {
      setScanning(false);
    }
  };

  const toggleDomain = (domain) => {
    save({
      cookieKeepList: keepList.includes(domain)
        ? keepList.filter((d) => d !== domain)
        : [...keepList, domain]
    });
  };

  const scannedDomains = scanResult?.domains ?? [];
  const scannedSet = new Set(scannedDomains.map((d) => d.domain));
  // A domain already in cookieKeepList (added on some earlier scan, or on
  // a machine that has since lost the browser that had it) still renders,
  // checked, even though nothing THIS scan measured -- same "don't hide
  // state" rule Deep Clean's own hidden-cleaners note already follows.
  const staleRows = keepList
    .filter((domain) => !scannedSet.has(domain))
    .map((domain) => ({ domain, count: null, stale: true }));
  const rows = [...scannedDomains, ...staleRows];
  const needle = filter.trim().toLowerCase();
  const filteredRows = needle ? rows.filter((row) => row.domain.toLowerCase().includes(needle)) : rows;

  return (
    <div className="glass-panel p-6">
      <div className="text-[14px] font-medium text-[color:var(--text-primary)] mb-1">
        {t('settings.cookiesToPreserve.title')}
      </div>
      <p className="text-[12.5px] text-[color:var(--text-secondary)] mb-4">
        {t('settings.cookiesToPreserve.description')}
      </p>

      <button
        className="btn-ghost px-3.5 py-2 rounded-lg text-[12px] font-medium disabled:opacity-50 mb-3"
        onClick={handleScan}
        disabled={scanning}
      >
        {scanning ? t('settings.cookiesToPreserve.scanning') : t('settings.cookiesToPreserve.scanButton')}
      </button>

      {scanError && (
        <p className="text-[12px] text-[color:var(--danger)] mb-3">
          {t('settings.cookiesToPreserve.scanErrorPrefix', scanError)}
        </p>
      )}

      {scanResult?.errors?.length > 0 && (
        <p className="text-[11.5px] text-[color:var(--warning)] mb-3">
          {t('settings.cookiesToPreserve.fileErrorsNote', scanResult.errors.length)}
        </p>
      )}

      {rows.length > 0 && (
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={t('settings.cookiesToPreserve.filterPlaceholder')}
          className="w-full font-mono text-[12.5px] px-3 py-2 mb-3 rounded-lg bg-[color:var(--surface-hover)] border border-[color:var(--border-subtle)] text-[color:var(--text-primary)] placeholder:text-[color:var(--text-muted)] focus:outline-none focus:border-[color:var(--accent-primary)]/50"
        />
      )}

      {scanResult && filteredRows.length === 0 && (
        <p className="text-[12.5px] text-[color:var(--text-muted)]">{t('settings.cookiesToPreserve.none')}</p>
      )}

      {filteredRows.length > 0 && (
        <div className="flex flex-col gap-1 max-h-[320px] overflow-y-auto">
          {filteredRows.map((row) => (
            <label
              key={row.domain}
              className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-[color:var(--surface-subtle)] cursor-pointer"
            >
              <span className="flex items-center gap-2 min-w-0">
                <input
                  type="checkbox"
                  className="prune-check"
                  checked={keepList.includes(row.domain)}
                  onChange={() => toggleDomain(row.domain)}
                  aria-label={t('settings.cookiesToPreserve.checkboxAriaLabel', row.domain)}
                />
                <span className="font-mono text-[12px] text-[color:var(--text-secondary)] truncate min-w-0">
                  {row.domain}
                </span>
                {row.stale && (
                  <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-px rounded border shrink-0 border-[color:var(--border-subtle)] text-[color:var(--text-muted)]">
                    {t('settings.cookiesToPreserve.staleBadge')}
                  </span>
                )}
              </span>
              {row.count !== null && (
                <span className="font-mono text-[11px] text-[color:var(--text-muted)] shrink-0">
                  {t('settings.cookiesToPreserve.countSuffix', row.count)}
                </span>
              )}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
