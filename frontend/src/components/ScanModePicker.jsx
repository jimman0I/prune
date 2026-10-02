import { useId, useRef } from 'react';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { SCAN_MODES } from '../lib/leftoverScanMode.js';

/** Safe / Moderate / Advanced, as a radio group in the same segmented-pill
 * style as the filter bar on the Applications screen.
 *
 * It is a real radiogroup: one of the three is always chosen, the arrow keys
 * move and choose together, and only the chosen one is in the Tab order. The
 * sentence under it describes the CHOSEN mode, because the difference between
 * the three is the whole decision and a label alone does not carry it. */
export default function ScanModePicker({ mode, onChange, disabled = false }) {
  const { t } = useLanguage();
  const labelId = useId();
  const hintId = useId();
  const refs = useRef({});

  const move = (event, index) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const next = SCAN_MODES[(index + step + SCAN_MODES.length) % SCAN_MODES.length];
    onChange(next);
    refs.current[next]?.focus();
  };

  return (
    <div className="mb-5" data-scan-mode-picker>
      <div id={labelId} className="block text-[11px] text-[color:var(--text-muted)] font-mono uppercase tracking-[0.14em] mb-1.5">
        {t('uninstallerV3.scanMode.label')}
      </div>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        aria-describedby={hintId}
        className="inline-flex items-center gap-1 p-1 bg-[color:var(--bg-panel)] border border-[color:var(--border-subtle)] rounded-xl"
      >
        {SCAN_MODES.map((id, index) => {
          const selected = id === mode;
          return (
            <button
              key={id}
              ref={(node) => { refs.current[id] = node; }}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected ? 0 : -1}
              disabled={disabled}
              onClick={() => onChange(id)}
              onKeyDown={(event) => move(event, index)}
              className={`px-3 py-1.5 rounded-lg text-[12.5px] font-medium transition disabled:opacity-50 ${
                selected
                  ? 'pill-selected bg-[color:var(--surface-hover)] text-[color:var(--text-primary)]'
                  : 'text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)]'
              }`}
            >
              {t(`uninstallerV3.scanMode.${id}`)}
            </button>
          );
        })}
      </div>
      <p id={hintId} className="text-[12px] text-[color:var(--text-muted)] mt-1.5">
        {t(`uninstallerV3.scanMode.${mode}Hint`)}
      </p>
    </div>
  );
}
