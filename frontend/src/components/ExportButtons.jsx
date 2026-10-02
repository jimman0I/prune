import { useLanguage } from '../i18n/LanguageContext.jsx';

/** The Disk Map's two exports: the rows on screen as a CSV, and (in the Tree
 * view) the treemap as a PNG. Both are made in the window itself -- see
 * lib/exportCsv.js and lib/exportPng.js -- so neither asks the backend for
 * anything or adds a way for the window to write files. */
export function ExportButtons({ onCsv, onPng, busy }) {
  const { t } = useLanguage();
  const cls = 'btn-ghost px-3 py-1.5 rounded-lg text-[12px] font-medium disabled:opacity-50';
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <button type="button" className={cls} onClick={onCsv} disabled={busy}>{t('diskMapV3.export.csv')}</button>
      {onPng && <button type="button" className={cls} onClick={onPng} disabled={busy}>{t('diskMapV3.export.png')}</button>}
    </div>
  );
}
