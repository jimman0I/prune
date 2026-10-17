import { useId, useRef, useState } from 'react';
import { addStartupItem, pickPath } from '../lib/api.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';

/** A segmented radio group, the same pill style and keyboard behaviour as
 * ScanModePicker: arrows move and choose together, only the chosen option is
 * in the Tab order. */
function Segmented({ label, options, value, onChange, disabled }) {
  const labelId = useId();
  const refs = useRef({});
  const move = (event, index) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const next = options[(index + step + options.length) % options.length].id;
    onChange(next);
    refs.current[next]?.focus();
  };
  return (
    <div className="mb-5">
      <div id={labelId} className="block text-[11px] text-[color:var(--text-muted)] font-mono uppercase tracking-[0.14em] mb-1.5">{label}</div>
      <div role="radiogroup" aria-labelledby={labelId} className="inline-flex flex-wrap items-center gap-1 p-1 bg-[color:var(--bg-panel)] border border-[color:var(--border-subtle)] rounded-xl">
        {options.map((option, index) => {
          const selected = option.id === value;
          return (
            <button
              key={option.id}
              ref={(node) => { refs.current[option.id] = node; }}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected ? 0 : -1}
              disabled={disabled}
              onClick={() => onChange(option.id)}
              onKeyDown={(event) => move(event, index)}
              className={`px-3 py-1.5 rounded-lg text-[12.5px] font-medium transition disabled:opacity-50 ${
                selected
                  ? 'pill-selected bg-[color:var(--surface-hover)] text-[color:var(--text-primary)]'
                  : 'text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)]'
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const FIELD = 'w-full bg-[color:var(--bg-panel)] border border-[color:var(--border-subtle)] rounded-xl px-3.5 py-2.5 text-[13px] placeholder:text-[color:var(--text-muted)] focus:outline-none focus:border-[color:var(--accent-primary)] focus:ring-4 focus:ring-[color:var(--accent-primary)]/10 transition';
const LABEL = 'block text-[11px] text-[color:var(--text-muted)] font-mono uppercase tracking-[0.14em] mb-1.5';

/** "Add entry…" on the startup screen: a name, the program to start, who it
 * starts for and how. The server checks the program exists and refuses a
 * name already taken, and says why in words that land here. */
export default function AddStartupDialog({ onClose, onAdded, onBusyChange }) {
  const { t } = useLanguage();
  const [name, setName] = useState('');
  const [command, setCommand] = useState('');
  const [scope, setScope] = useState('user');
  const [kind, setKind] = useState('run');
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState(null);

  const ready = name.trim() !== '' && command.trim() !== '' && !busy;
  const setWorking = (value) => { setBusy(value); onBusyChange?.(value); };

  const browse = async () => {
    setError(null);
    setPicking(true);
    try {
      const { path } = await pickPath('program');
      if (path) {
        // A path with spaces needs quotes to stay one argument.
        setCommand(/\s/.test(path) ? `"${path}"` : path);
        if (!name.trim()) setName(path.split(/[\\/]/).pop().replace(/\.(exe|bat|cmd)$/i, ''));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setPicking(false);
    }
  };

  const submit = async (event) => {
    event?.preventDefault();
    if (!ready) return;
    setError(null);
    setWorking(true);
    const result = await addStartupItem({ name: name.trim(), command: command.trim(), scope, kind });
    setWorking(false);
    if (result?.ok) { onAdded?.(name.trim()); return; }
    // A declined consent prompt is a choice, not an error: stay open, say nothing.
    if (!result?.cancelled) setError(result?.error || t('startup.menu.failed', ''));
  };

  return (
    <form onSubmit={submit} data-modal-panel className="glass-panel rounded-2xl overflow-hidden max-w-[560px] w-full flex flex-col max-h-[85vh]">
      <div className="flex items-center justify-between gap-4 px-6 py-5 border-b border-[color:var(--border-subtle)] shrink-0">
        <h2 className="text-[15px] font-semibold tracking-tight text-[color:var(--text-primary)]">{t('startup.add.title')}</h2>
        <button type="button" onClick={onClose} disabled={busy} className="btn-ghost px-3 py-1.5 rounded-lg text-[12px] font-medium disabled:opacity-50">
          {t('startup.add.cancel')}
        </button>
      </div>
      <div data-modal-body className="px-6 py-5 overflow-y-auto min-h-0">
        <label htmlFor="startup-add-name" className={LABEL}>{t('startup.add.name')}</label>
        <input id="startup-add-name" value={name} onChange={(e) => setName(e.target.value)} disabled={busy} className={`${FIELD} mb-5`} autoComplete="off" />

        <label htmlFor="startup-add-command" className={LABEL}>{t('startup.add.command')}</label>
        <div className="flex items-center gap-2">
          <input
            id="startup-add-command"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            disabled={busy}
            aria-describedby="startup-add-command-hint"
            spellCheck={false}
            autoComplete="off"
            className={`${FIELD} flex-1 min-w-0 font-mono`}
          />
          <button type="button" onClick={browse} disabled={picking || busy} className="btn-ghost px-3.5 py-2 rounded-lg text-[12.5px] font-medium shrink-0 disabled:opacity-50">
            {t('startup.add.browse')}
          </button>
        </div>
        <p id="startup-add-command-hint" className="text-[12px] text-[color:var(--text-muted)] mt-1.5 mb-5">{t('startup.add.commandHint')}</p>

        <Segmented
          label={t('startup.add.scope')}
          value={scope}
          onChange={setScope}
          disabled={busy}
          options={[{ id: 'user', label: t('startup.add.user') }, { id: 'machine', label: t('startup.add.machine') }]}
        />
        <Segmented
          label={t('startup.add.kind')}
          value={kind}
          onChange={setKind}
          disabled={busy}
          options={[
            { id: 'run', label: t('startup.add.run') },
            { id: 'runonce', label: t('startup.add.runOnce') },
            { id: 'folder', label: t('startup.add.folder') }
          ]}
        />

        {error && <p role="alert" className="text-[12.5px] text-[color:var(--danger)] mb-4 select-text">{error}</p>}
        <div className="flex items-center gap-3 flex-wrap">
          <button type="submit" className="btn-primary" disabled={!ready}>
            {busy ? t('startup.add.adding') : t('startup.add.confirm')}
          </button>
          {scope === 'machine' && <span className="text-[12px] text-[color:var(--text-muted)]">{t('startup.add.machineNote')}</span>}
        </div>
      </div>
    </form>
  );
}
