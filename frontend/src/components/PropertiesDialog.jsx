import { useLanguage } from '../i18n/LanguageContext.jsx';
import { formatBytes } from '../lib/formatBytes.js';
import ModalOverlay from './ModalOverlay.jsx';

/** What the Disk Map knows about one item, in one place: the right-click
 * menu's Properties.
 *
 * A figure the scan never took is left out rather than shown as zero (a
 * folder the scan never opened has no counts; a scan that did not measure
 * allocation has no "Allocated"), and the full path is selectable so it can
 * be pasted into Explorer or a bug report. */
export function PropertiesDialog({ info, onClose }) {
  const { t } = useLanguage();
  const isFolder = info.type === 'directory';
  const lines = [
    [t('diskMapV3.props.path'), info.fullPath, 'break-all select-text'],
    [t('diskMapV3.props.type'), isFolder ? t('diskMap.removeModal.folder') : t('diskMap.removeModal.file')],
    [t('diskMap.folderTable.columns.size'), formatBytes(info.size)],
    typeof info.allocated === 'number' && [t('diskMapV3.columns.allocated'), formatBytes(info.allocated)],
    isFolder && typeof info.files === 'number' && [t('diskMap.folderTable.columns.files'), info.files.toLocaleString()],
    isFolder && typeof info.folders === 'number' && [t('diskMap.folderTable.columns.folders'), info.folders.toLocaleString()],
    typeof info.modified === 'number' && [t('diskMap.folderTable.columns.modified'), new Date(info.modified).toLocaleString()]
  ].filter(Boolean);

  return (
    <ModalOverlay label={t('diskMapV3.menu.properties')} onClose={onClose}>
      <div className="glass-panel w-full max-w-[520px] p-6">
        <h2 className="display-heading text-[20px] mb-1 break-words">{info.name}</h2>
        <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-5 gap-y-2 text-[12.5px]">
          {lines.map(([label, value, extra]) => (
            <div key={label} className="contents">
              <dt className="text-[color:var(--text-muted)]">{label}</dt>
              <dd className={`font-mono text-[color:var(--text-primary)] min-w-0 ${extra ?? ''}`}>{value}</dd>
            </div>
          ))}
        </dl>
        <div className="flex justify-end mt-6">
          <button type="button" className="btn-ghost px-4 py-2 rounded-lg text-[12.5px] font-medium" onClick={onClose}>
            {t('diskMapV3.props.close')}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}
