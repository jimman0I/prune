import { useRef, useState, memo } from 'react';
import { runSandboxTest, openUpdatePage } from '../lib/api.js';
import { classifyExclusion } from '../lib/exclusionInput.js';
import { positiveOrOff } from '../lib/limitInput.js';
import AutomationSettings from './AutomationSettings.jsx';
import ThemeToggle from './ThemeToggle.jsx';
import Toggle from './Toggle.jsx';
import CookieKeepListSettings from './CookieKeepListSettings.jsx';
import { useSettings, useUpdateCheck } from '../hooks/useSystemQueries.js';
import { leftoverDestinationFrom } from '../lib/leftoverDestination.js';
import { useLanguage, LANGUAGES } from '../i18n/LanguageContext.jsx';
import { readStoredSettingsTab, writeStoredSettingsTab } from '../lib/settingsTab.js';

// The version is NOT kept here. It used to be a hand-copied constant that
// had to be bumped with the three package.json files, nothing failed when
// it was not, and the About panel said v2.2.0 through five releases. It is
// now read from the backend, whose package.json every release bumps.
const APP_NAME = 'Prune';

const TAB_IDS = ['general', 'uninstall', 'cleanup', 'about'];

/** The style every group heading on this screen shares -- the same small
 * mono uppercase label as "Scan output" on Deep Clean, so a panel's heading
 * reads as a label for the rows under it rather than as one more setting. */
const HEADING_CLASS = 'text-[11px] font-mono uppercase tracking-[0.14em] text-[color:var(--text-muted)]';

function SectionHeading({ id, children }) {
  return <h2 id={id} className={`${HEADING_CLASS} mb-3`}>{children}</h2>;
}

/** One setting with its explanation, for the panels that group several.
 *
 * The control sits in the right-hand slot: a switch by default, or whatever
 * `control` hands in (a number field and its unit). Every row of every panel
 * is this shape, so the eye finds the control in the same place each time. */
function SettingRow({ title, description, checked, onChange, control }) {
  return (
    <div data-setting-row className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <div className="text-[13.5px] font-medium text-[color:var(--text-primary)]">{title}</div>
        {description && (
          <p className="text-[12.5px] text-[color:var(--text-secondary)] mt-1 leading-relaxed max-w-[62ch]">{description}</p>
        )}
      </div>
      {control ?? <Toggle checked={checked} onChange={onChange} label={title} />}
    </div>
  );
}

function StepRow({ step }) {
  return (
    <div className="flex items-start gap-3 py-2">
      <div
        className={`w-4 h-4 rounded-full mt-0.5 shrink-0 flex items-center justify-center text-[10px] font-bold ${
          step.passed ? 'bg-[color:var(--success)]/20 text-[color:var(--success)]' : 'bg-[color:var(--danger)]/20 text-[color:var(--danger)]'
        }`}
      >
        {step.passed ? '✓' : '✕'}
      </div>
      <div className="min-w-0">
        <div className="text-[12.5px] text-[color:var(--text-primary)]">{step.name}</div>
        {step.detail && <div className="font-mono text-[11px] text-[color:var(--text-muted)] mt-0.5 break-all select-text">{step.detail}</div>}
      </div>
    </div>
  );
}

const numberFieldClass =
  'font-mono text-[12.5px] px-2.5 py-2 rounded-lg bg-[color:var(--surface-hover)] border border-[color:var(--border-subtle)] text-[color:var(--text-primary)] focus:border-[color:var(--accent-primary)]/50';

function SettingsPage({ onReportBug = null }) {
  const [tab, setTab] = useState(() => readStoredSettingsTab(window.localStorage, TAB_IDS) ?? 'general');
  const [saveError, setSaveError] = useState(null);
  const [newExclusion, setNewExclusion] = useState('');
  const [exclusionError, setExclusionError] = useState(null);
  const [sandboxRunning, setSandboxRunning] = useState(false);
  const [sandboxReport, setSandboxReport] = useState(null);
  const tabRefs = useRef({});

  const { settings, loading, save: saveMutation } = useSettings();
  const { t } = useLanguage();
  const update = useUpdateCheck(settings?.updateCheck === true);
  const destination = leftoverDestinationFrom(settings);

  const TABS = TAB_IDS.map((id) => ({ id, label: t(`settings.tabs.${id}`) }));

  /* Revo's three, in Prune's words. The descriptions avoid each other's
   * key words on purpose, so each option reads as exactly one choice. */
  const LEFTOVER_OPTIONS = [
    { value: 'quarantine', label: t('settings.uninstallTab.leftoverOptions.quarantine.label'), description: t('settings.uninstallTab.leftoverOptions.quarantine.description') },
    { value: 'recycle', label: t('settings.uninstallTab.leftoverOptions.recycle.label'), description: t('settings.uninstallTab.leftoverOptions.recycle.description') },
    { value: 'permanent', label: t('settings.uninstallTab.leftoverOptions.permanent.label'), description: t('settings.uninstallTab.leftoverOptions.permanent.description') }
  ];
  const acknowledgedCount = Array.isArray(settings?.acknowledgedCleanWarnings) ? settings.acknowledgedCleanWarnings.length : 0;
  // Everything but an explicit false keeps the behaviour Prune always had.
  const isOn = (key) => settings?.[key] !== false;
  const isOnlyIfTrue = (key) => settings?.[key] === true;
  const [openError, setOpenError] = useState(null);

  const handleOpenUpdatePage = () => {
    setOpenError(null);
    openUpdatePage().catch((err) => setOpenError(err.message));
  };
  const error = null;

  const handleTabChange = (id) => {
    setTab(id);
    writeStoredSettingsTab(window.localStorage, id);
  };

  /** Arrow keys move between the tabs and select as they go, Home and End
   * jump to the ends -- the standard tablist contract, with the tab that is
   * selected the only one in the Tab order (roving tabindex) so Tab leaves
   * the list instead of walking through four stops. */
  const handleTabKeyDown = (event, index) => {
    const last = TAB_IDS.length - 1;
    let next = null;
    if (event.key === 'ArrowRight') next = index === last ? 0 : index + 1;
    else if (event.key === 'ArrowLeft') next = index === 0 ? last : index - 1;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = last;
    if (next === null) return;

    event.preventDefault();
    const id = TAB_IDS[next];
    handleTabChange(id);
    tabRefs.current[id]?.focus();
  };

  /** Optimistic, and it rolls back on a real failure.
   *
   * A toggle that waits for a disk write before moving feels broken, and
   * one that moves and never checks can silently diverge from what is
   * actually persisted. onMutate writes the change into the cache and
   * hands back the previous settings; onError puts them straight back.
   *
   * The mutation is not retried -- see queryClient.js. Re-sending a
   * settings write because the reply was slow is how a preference flips
   * back after the user has already changed it again. */
  const save = (partial) => {
    setSaveError(null);
    saveMutation.mutate(partial, {
      onError: (err) => setSaveError(err.message)
    });
  };

  /** One field, two stores.
   *
   * "Add an exclusion" is one idea to a person, but a folder is matched
   * as a path prefix and an extension as a filename suffix, so they are
   * kept apart on disk. classifyExclusion decides once, here, where the
   * user's intent is clearest -- rather than every file of every scan
   * having to guess whether "C:\dev\node.js" is a folder or a file type.
   *
   * A bare word is refused with a message rather than guessed at, and the
   * message says the format. Guessing has two silent failure modes:
   * "temp" as a folder excludes nothing, and as an extension excludes
   * every .temp file on the machine. */
  const handleAddExclusion = () => {
    const parsed = classifyExclusion(newExclusion);
    if (!parsed) {
      setExclusionError(
        newExclusion.trim()
          ? t('settings.exclusions.invalidFormat')
          : null
      );
      return;
    }

    setExclusionError(null);
    const key = parsed.kind === 'extension' ? 'excludeExtensions' : 'excludeFolders';
    const current = settings[key] ?? [];
    if (current.includes(parsed.value)) { setNewExclusion(''); return; }

    save({ [key]: [...current, parsed.value] });
    setNewExclusion('');
  };

  const handleRemoveExclusion = (kind, value) => {
    const key = kind === 'extension' ? 'excludeExtensions' : 'excludeFolders';
    save({ [key]: (settings[key] ?? []).filter((v) => v !== value) });
  };

  // One list for the screen, each row remembering which store it came
  // from so removing it puts the change back in the right place.
  const exclusions = [
    ...(settings?.excludeFolders ?? []).map((value) => ({ kind: 'folder', value })),
    ...(settings?.excludeExtensions ?? []).map((value) => ({ kind: 'extension', value }))
  ];

  const handleRunSandboxTest = async () => {
    setSandboxRunning(true);
    setSandboxReport(null);
    try {
      const report = await runSandboxTest();
      setSandboxReport(report);
    } catch (err) {
      setSandboxReport({ passed: false, steps: [], error: err.message });
    } finally {
      setSandboxRunning(false);
    }
  };

  return (
    <div className="px-12 py-10 max-w-[1400px]">
      <h1 className="display-heading text-[30px] leading-none mb-6">{t('settings.title')}</h1>

      <div role="tablist" aria-label={t('settings.title')} className="flex items-center gap-1.5 mb-6">
        {TABS.map((tabDef, index) => (
          <button
            key={tabDef.id}
            ref={(el) => { tabRefs.current[tabDef.id] = el; }}
            role="tab"
            id={`settings-tab-${tabDef.id}`}
            aria-selected={tab === tabDef.id}
            aria-controls="settings-panel"
            tabIndex={tab === tabDef.id ? 0 : -1}
            onClick={() => handleTabChange(tabDef.id)}
            onKeyDown={(event) => handleTabKeyDown(event, index)}
            className={`px-4 py-2 rounded-lg text-[13px] font-medium transition-colors ${
              tab === tabDef.id
                ? 'pill-selected bg-[color:var(--accent-primary-soft)] text-[color:var(--accent-primary)]'
                : 'text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] hover:bg-[color:var(--surface-hover)]'
            }`}
          >
            {tabDef.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id="settings-panel" tabIndex={0} aria-labelledby={`settings-tab-${tab}`}>
      {/* Outside the settings gate, deliberately. Everything below waits
          on the backend, and this panel does not: the theme lives in
          localStorage and is applied before React renders. Gating it too
          meant the one control that still works when the backend is down
          was the one control you could not reach -- and a spinner where a
          theme switch should be is a worse answer than the switch. */}
      {tab === 'general' && (
        <div className="flex flex-col gap-4 mb-4">
          <div className="glass-panel p-6">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-[14px] font-medium text-[color:var(--text-primary)] mb-1">{t('settings.appearance.title')}</h2>
                <p className="text-[12.5px] text-[color:var(--text-secondary)] leading-relaxed max-w-[62ch]">
                  {t('settings.appearance.description')}
                </p>
              </div>
              <ThemeToggle />
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className="glass-panel flex flex-col items-center justify-center py-16">
          <div className="w-14 h-14 rounded-2xl bg-[color:var(--accent-primary)]/10 border border-[color:var(--accent-primary)]/25 flex items-center justify-center mb-5">
            <div className="w-6 h-6 border-2 border-[color:var(--accent-primary)] border-t-transparent rounded-full animate-spin"></div>
          </div>
          <p className="text-[13px] text-[color:var(--text-secondary)]">{t('settings.loading')}</p>
        </div>
      )}

      {!loading && error && (
        <div className="glass-panel p-6">
          <p className="text-[13px] text-[color:var(--danger)]">{t('settings.loadError', error)}</p>
        </div>
      )}

      {!loading && !error && settings && (
        <>
          {saveError && (
            <div className="mb-5 px-3.5 py-3 rounded-xl bg-[color:var(--danger-soft)] border border-[color:var(--danger)]/25">
              <p className="text-[12.5px] text-[color:var(--danger)] select-text">{t('settings.saveError', saveError)}</p>
            </div>
          )}

          {tab === 'general' && (
            <div className="flex flex-col gap-4">

              {/* What Prune's own screens are shown in -- the installer may
                  already have picked one, or Windows' own display language
                  did the first time Prune ever started; see
                  backend/src/services/settings.js. Changing it here is
                  instant: LanguageContext.jsx reads this same setting. */}
              <div className="glass-panel p-6">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-[14px] font-medium text-[color:var(--text-primary)]">{t('settings.language.title')}</div>
                    <p className="text-[12.5px] text-[color:var(--text-secondary)] mt-1 leading-relaxed max-w-[62ch]">
                      {t('settings.language.description')}
                    </p>
                  </div>
                  <select
                    value={settings.language ?? 'en'}
                    onChange={(e) => save({ language: e.target.value })}
                    aria-label={t('settings.language.title')}
                    className="bg-[color:var(--bg-panel)] border border-[color:var(--border-subtle)] rounded-lg px-3 py-2 text-[12.5px] text-[color:var(--text-primary)] focus:border-[color:var(--accent-primary)] shrink-0"
                  >
                    {LANGUAGES.map((lang) => (
                      <option key={lang.code} value={lang.code}>{lang.native}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="glass-panel p-6">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-[14px] font-medium text-[color:var(--text-primary)]">{t('settings.minimizeToTray.title')}</div>
                    <p className="text-[12.5px] text-[color:var(--text-secondary)] mt-1 leading-relaxed max-w-[62ch]">
                      {t('settings.minimizeToTray.description')}
                    </p>
                  </div>
                  <Toggle
                    checked={settings.minimizeToTray}
                    onChange={() => save({ minimizeToTray: !settings.minimizeToTray })}
                    label={t('settings.minimizeToTray.title')}
                  />
                </div>
              </div>

              {/* The one setting that lets anything leave the machine, so
                  it says exactly what, to whom and how often before it is
                  switched on -- and it is off until someone does. */}
              <div className="glass-panel p-6">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-[14px] font-medium text-[color:var(--text-primary)]">{t('settings.updateCheck.title')}</div>
                    <p className="text-[12.5px] text-[color:var(--text-secondary)] mt-1 leading-relaxed max-w-[62ch]">
                      {t('settings.updateCheck.description')}
                    </p>
                  </div>
                  <Toggle
                    checked={settings.updateCheck === true}
                    onChange={() => save({ updateCheck: settings.updateCheck !== true })}
                    label={t('settings.updateCheck.title')}
                  />
                </div>

                {/* The one switch that lets Prune replace itself without a
                    click. Meaningless without the check above -- nothing is
                    found to install -- so it cannot be turned on until that
                    is, and it says what it does before anyone does. */}
                <div className="flex items-center justify-between gap-4 mt-4 pt-4 border-t border-[color:var(--border-subtle)]">
                  <div className="min-w-0">
                    <div className={`text-[13.5px] font-medium ${settings.updateCheck === true ? 'text-[color:var(--text-primary)]' : 'text-[color:var(--text-muted)]'}`}>
                      {t('settings.autoInstallUpdates.title')}
                    </div>
                    <p className="text-[12.5px] text-[color:var(--text-secondary)] mt-1 leading-relaxed max-w-[62ch]">
                      {t('settings.autoInstallUpdates.description')}
                    </p>
                  </div>
                  <Toggle
                    checked={settings.autoInstallUpdates === true}
                    onChange={() => save({ autoInstallUpdates: settings.autoInstallUpdates !== true })}
                    label={t('settings.autoInstallUpdates.title')}
                    disabled={settings.updateCheck !== true}
                  />
                </div>

                {settings.updateCheck === true && (
                  <div className="mt-4 pt-4 border-t border-[color:var(--border-subtle)] text-[12.5px]">
                    {update.loading && (
                      <p className="text-[color:var(--text-muted)]">{t('settings.updateStatus.checking')}</p>
                    )}
                    {update.data?.error && (
                      <p className="text-[color:var(--warning)] select-text">{t('settings.updateStatus.loadError', update.data.error)}</p>
                    )}
                    {update.data?.newer === true && (
                      <div className="flex items-center justify-between gap-4">
                        <p className="text-[color:var(--text-primary)]">{t('settings.updateStatus.newerAvailable', update.data.latest)}</p>
                        <button type="button" className="btn-primary px-4 py-1.5 text-[12.5px] font-medium shrink-0" onClick={handleOpenUpdatePage}>
                          {t('settings.updateStatus.openDownloadPage')}
                        </button>
                      </div>
                    )}
                    {update.data?.newer === false && (
                      <p className="text-[color:var(--text-muted)]">{t('settings.updateStatus.upToDate', update.data.current)}</p>
                    )}
                    {openError && (
                      <p className="text-[color:var(--danger)] mt-2 select-text">{t('settings.updateStatus.openPageError', openError)}</p>
                    )}
                  </div>
                )}
              </div>

              <div className="glass-panel p-6">
                <SettingRow
                  title={t('settings.showFreeSpace.title')}
                  description={t('settings.showFreeSpace.description')}
                  checked={isOnlyIfTrue('showFreeSpaceOnMap')}
                  onChange={() => save({ showFreeSpaceOnMap: !isOnlyIfTrue('showFreeSpaceOnMap') })}
                />
              </div>
            </div>
          )}

          {tab === 'cleanup' && (
            <div className="flex flex-col gap-4">
              <div className="glass-panel p-6">
                <AutomationSettings settings={settings} save={save} />
              </div>

              <div className="glass-panel p-6">
                <SectionHeading>{t('nav.deepClean')}</SectionHeading>
                <div className="divide-y divide-[color:var(--border-subtle)]">
                  <SettingRow
                    title={t('settings.skipRecent.title')}
                    description={t('settings.skipRecent.description')}
                    control={(
                      <div className="flex items-center gap-2 shrink-0">
                        <input
                          type="number"
                          min="0"
                          max="720"
                          value={settings.skipRecentHours}
                          onChange={(e) => save({ skipRecentHours: Math.max(0, Number(e.target.value) || 0) })}
                          aria-label={t('settings.skipRecent.ariaLabel')}
                          className={`w-[72px] ${numberFieldClass}`}
                          style={{ fontVariantNumeric: 'tabular-nums' }}
                        />
                        <span className="text-[12.5px] text-[color:var(--text-muted)]">{t('settings.skipRecent.hoursUnit')}</span>
                      </div>
                    )}
                  />
                  <SettingRow
                    title={t('settings.hideUnavailable.title')}
                    description={t('settings.hideUnavailable.description')}
                    checked={settings.hideUnavailableRules}
                    onChange={() => save({ hideUnavailableRules: !settings.hideUnavailableRules })}
                  />
                </div>
              </div>

              {/* The two limits on the quarantine. Both empty by default,
                  and both read "blank means keep everything" -- the same
                  rule the backend applies to every ambiguous value, for
                  the same reason: a limit that fails to run wastes disk,
                  and one that runs when it should not destroys the only
                  copy of something removed by accident. */}
              <div className="glass-panel p-6">
                <SectionHeading>{t('nav.quarantine')}</SectionHeading>
                <div className="divide-y divide-[color:var(--border-subtle)]">
                  <SettingRow
                    title={t('settings.autoQuarantine.title')}
                    description={t('settings.autoQuarantine.description')}
                    checked={settings.autoQuarantine}
                    onChange={() => save({ autoQuarantine: !settings.autoQuarantine })}
                  />
                  <SettingRow
                    title={t('settings.quarantineRetention.title')}
                    description={t('settings.quarantineRetention.description')}
                    control={(
                      <div className="flex items-center gap-2 shrink-0">
                        <input
                          type="number"
                          min="0"
                          max="3650"
                          value={settings.quarantineRetentionDays ?? ''}
                          placeholder={t('settings.quarantineRetention.neverPlaceholder')}
                          onChange={(e) => save({ quarantineRetentionDays: positiveOrOff(e.target.value) })}
                          aria-label={t('settings.quarantineRetention.ariaLabel')}
                          className={`w-[88px] ${numberFieldClass}`}
                          style={{ fontVariantNumeric: 'tabular-nums' }}
                        />
                        <span className="text-[12.5px] text-[color:var(--text-muted)]">{t('settings.quarantineRetention.daysUnit')}</span>
                      </div>
                    )}
                  />
                  <SettingRow
                    title={t('settings.quarantineMaxSize.title')}
                    description={t('settings.quarantineMaxSize.description')}
                    control={(
                      <div className="flex items-center gap-2 shrink-0">
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          value={settings.quarantineMaxSizeGb ?? ''}
                          placeholder={t('settings.quarantineMaxSize.noLimitPlaceholder')}
                          onChange={(e) => save({ quarantineMaxSizeGb: positiveOrOff(e.target.value) })}
                          aria-label={t('settings.quarantineMaxSize.ariaLabel')}
                          className={`w-[88px] ${numberFieldClass}`}
                          style={{ fontVariantNumeric: 'tabular-nums' }}
                        />
                        <span className="text-[12.5px] text-[color:var(--text-muted)]">{t('settings.quarantineMaxSize.gbUnit')}</span>
                      </div>
                    )}
                  />
                </div>
              </div>

              <div className="glass-panel p-6">
                <div className="text-[14px] font-medium text-[color:var(--text-primary)] mb-1">{t('settings.exclusions.title')}</div>
                <p className="text-[12.5px] text-[color:var(--text-secondary)] mb-4 max-w-[62ch]">
                  {t('settings.exclusions.description')}
                </p>

                <div className="flex items-center gap-2 mb-1">
                  <input
                    type="text"
                    value={newExclusion}
                    onChange={(e) => { setNewExclusion(e.target.value); setExclusionError(null); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddExclusion(); }}
                    placeholder="D:\Games   or   *.iso"
                    aria-label={t('settings.exclusions.ariaLabel')}
                    aria-invalid={Boolean(exclusionError)}
                    className="flex-1 min-w-0 font-mono text-[12.5px] px-3 py-2 rounded-lg bg-[color:var(--surface-hover)] border border-[color:var(--border-subtle)] text-[color:var(--text-primary)] placeholder:text-[color:var(--text-muted)] focus:border-[color:var(--accent-primary)]/50"
                  />
                  <button className="btn-ghost px-3.5 py-2 rounded-lg text-[12px] font-medium shrink-0" onClick={handleAddExclusion}>
                    {t('settings.exclusions.add')}
                  </button>
                </div>

                {/* Says the format rather than just refusing. A bare word
                    is genuinely ambiguous and the user is the only one who
                    can resolve it. */}
                <p className={`text-[11.5px] mb-4 ${exclusionError ? 'text-[color:var(--danger)]' : 'text-[color:var(--text-muted)]'}`}>
                  {exclusionError || t('settings.exclusions.formatHint')}
                </p>

                {exclusions.length === 0 ? (
                  <p className="text-[12.5px] text-[color:var(--text-muted)]">{t('settings.exclusions.none')}</p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {exclusions.map(({ kind, value }) => (
                      <div key={`${kind}:${value}`} className="flex items-center justify-between gap-3 pl-3 pr-1.5 py-1 rounded-lg bg-[color:var(--surface-subtle)]">
                        <div className="flex items-center gap-2 min-w-0">
                          {/* Which kind, at a glance. The two behave
                              differently and the row should not need to be
                              parsed to tell them apart. */}
                          <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-px rounded border shrink-0 border-[color:var(--border-subtle)] text-[color:var(--text-muted)]">
                            {kind === 'extension' ? t('settings.exclusions.typeBadge') : t('settings.exclusions.folderBadge')}
                          </span>
                          <span className="font-mono text-[12px] text-[color:var(--text-secondary)] truncate min-w-0">{value}</span>
                        </div>
                        <button
                          aria-label={t('settings.exclusions.removeAriaLabel', value)}
                          onClick={() => handleRemoveExclusion(kind, value)}
                          className="w-6 h-6 inline-flex items-center justify-center rounded-md text-[color:var(--text-muted)] hover:text-[color:var(--danger)] transition-colors shrink-0 text-[13px] leading-none"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <CookieKeepListSettings settings={settings} save={save} />

              <div className="glass-panel p-6">
                <div className="text-[14px] font-medium text-[color:var(--text-primary)] mb-1">{t('settings.sandboxTest.title')}</div>
                <p className="text-[12.5px] text-[color:var(--text-secondary)] mb-4 max-w-[62ch]">
                  {t('settings.sandboxTest.description')}
                </p>
                <button
                  className="btn-primary px-5 py-2.5 text-[13px] font-medium disabled:opacity-50"
                  onClick={handleRunSandboxTest}
                  disabled={sandboxRunning}
                >
                  {sandboxRunning ? t('settings.sandboxTest.running') : t('settings.sandboxTest.run')}
                </button>

                {sandboxReport && (
                  <div className="mt-5 pt-4 border-t border-[color:var(--border-subtle)]">
                    <div
                      className={`text-[13px] font-medium mb-2 ${
                        sandboxReport.passed ? 'text-[color:var(--success)]' : 'text-[color:var(--danger)]'
                      }`}
                    >
                      {sandboxReport.passed ? t('settings.sandboxTest.allPassed') : t('settings.sandboxTest.failed')}
                    </div>
                    {sandboxReport.steps.map((step, i) => (
                      <StepRow key={i} step={step} />
                    ))}
                    {sandboxReport.error && (
                      <p className="text-[12px] text-[color:var(--danger)] mt-2 font-mono break-all select-text">{sandboxReport.error}</p>
                    )}
                  </div>
                )}
              </div>

              <div className="glass-panel p-6">
                <SettingRow
                  title={t('settings.warningConfirmations.title')}
                  description={acknowledgedCount === 0
                    ? t('settings.warningConfirmations.allAsk')
                    : t('settings.warningConfirmations.someSet', acknowledgedCount)}
                  control={(
                    <button
                      type="button"
                      className="btn-ghost px-3 py-1.5 rounded-md text-[12.5px] shrink-0 disabled:opacity-40"
                      disabled={acknowledgedCount === 0}
                      onClick={() => save({ acknowledgedCleanWarnings: [] })}
                    >
                      {t('settings.warningConfirmations.reset')}
                    </button>
                  )}
                />
              </div>
            </div>
          )}

          {tab === 'uninstall' && (
            <div className="flex flex-col gap-4">
              <div className="glass-panel p-6">
                <SectionHeading>{t('settings.uninstallTab.beforeHeading')}</SectionHeading>
                <div className="divide-y divide-[color:var(--border-subtle)]">
                  <SettingRow
                    title={t('settings.uninstallTab.restorePointUninstall.title')}
                    description={t('settings.uninstallTab.restorePointUninstall.description')}
                    checked={isOnlyIfTrue('restorePointBeforeUninstall')}
                    onChange={() => save({ restorePointBeforeUninstall: !isOnlyIfTrue('restorePointBeforeUninstall') })}
                  />
                  {/* Moved here from the Cleanup tab: it is the same kind of
                      safety net as the row above, taken before a forced
                      removal rather than a normal uninstall. Same setting
                      key and stored value as before -- only where it is
                      drawn changed. */}
                  <SettingRow
                    title={t('settings.restorePointCleanup.title')}
                    description={t('settings.restorePointCleanup.description')}
                    checked={settings.createRestorePoint}
                    onChange={() => save({ createRestorePoint: !settings.createRestorePoint })}
                  />
                  <SettingRow
                    title={t('settings.uninstallTab.registryBackup.title')}
                    description={t('settings.uninstallTab.registryBackup.description')}
                    checked={isOnlyIfTrue('registryBackupBeforeUninstall')}
                    onChange={() => save({ registryBackupBeforeUninstall: !isOnlyIfTrue('registryBackupBeforeUninstall') })}
                  />
                </div>
              </div>

              <div className="glass-panel p-6">
                <SectionHeading>{t('settings.uninstallTab.afterHeading')}</SectionHeading>
                <div className="divide-y divide-[color:var(--border-subtle)]">
                  <SettingRow
                    title={t('settings.uninstallTab.scanLeftovers.title')}
                    description={t('settings.uninstallTab.scanLeftovers.description')}
                    checked={isOn('scanLeftoversAfterUninstall')}
                    onChange={() => save({ scanLeftoversAfterUninstall: !isOn('scanLeftoversAfterUninstall') })}
                  />
                  <SettingRow
                    title={t('settings.uninstallTab.preselect.title')}
                    description={t('settings.uninstallTab.preselect.description')}
                    checked={isOn('preselectLeftovers')}
                    onChange={() => save({ preselectLeftovers: !isOn('preselectLeftovers') })}
                  />
                  <SettingRow
                    title={t('settings.uninstallTab.deleteLockedFiles.title')}
                    description={t('settings.uninstallTab.deleteLockedFiles.description')}
                    checked={isOnlyIfTrue('deleteLockedFilesOnRestart')}
                    onChange={() => save({ deleteLockedFilesOnRestart: !isOnlyIfTrue('deleteLockedFilesOnRestart') })}
                  />
                  <SettingRow
                    title={t('settings.uninstallTab.keepHistory.title')}
                    description={t('settings.uninstallTab.keepHistory.description')}
                    checked={isOn('keepUninstallHistory')}
                    onChange={() => save({ keepUninstallHistory: !isOn('keepUninstallHistory') })}
                  />
                </div>
              </div>

              <div className="glass-panel p-6">
                <SectionHeading id="leftover-destination">{t('settings.uninstallTab.destinationHeading')}</SectionHeading>
                <div role="radiogroup" aria-labelledby="leftover-destination" className="flex flex-col gap-3">
                  {LEFTOVER_OPTIONS.map((option) => (
                    <label key={option.value} className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="leftover-destination"
                        value={option.value}
                        checked={destination === option.value}
                        onChange={() => save({ leftoverDestination: option.value })}
                        className="mt-1 accent-[color:var(--accent-primary)]"
                      />
                      <span>
                        <span className="block text-[13.5px] font-medium text-[color:var(--text-primary)]">{option.label}</span>
                        <span className="block text-[12.5px] text-[color:var(--text-secondary)] max-w-[62ch]">{option.description}</span>
                      </span>
                    </label>
                  ))}
                </div>
                {destination === 'permanent' && (
                  <p className="mt-4 text-[12.5px] text-[color:var(--danger)] leading-relaxed max-w-[62ch]">
                    {t('settings.uninstallTab.permanentWarning')}
                  </p>
                )}
                <p className="mt-3 text-[12px] text-[color:var(--text-muted)] max-w-[62ch]">
                  {t('settings.uninstallTab.registryNote')}
                </p>
              </div>
            </div>
          )}

          {tab === 'about' && (
            <div className="glass-panel p-6">
              <h2 className="display-heading text-[20px] mb-1">{APP_NAME}</h2>
              {update.data?.current && (
                <p className="text-[12.5px] text-[color:var(--text-muted)] font-mono mb-4">{`v${update.data.current}`}</p>
              )}
              <p className="text-[13px] text-[color:var(--text-secondary)] leading-relaxed max-w-[52ch]">
                {t('settings.about.description')}
              </p>
              {/* The dialog itself belongs to App, so the rail's item and
                  this row open the same one and two can never be up at once. */}
              {onReportBug && (
                <div className="mt-5 pt-4 border-t border-[color:var(--border-subtle)] flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium text-[color:var(--text-primary)]">{t('settings.about.reportTitle')}</div>
                    <p className="text-[12px] text-[color:var(--text-muted)] mt-0.5 max-w-[52ch]">{t('settings.about.reportDescription')}</p>
                  </div>
                  <button type="button" className="btn-ghost shrink-0 px-3 py-1.5 rounded-lg text-[12.5px] min-h-[24px]" onClick={onReportBug}>
                    {t('settings.about.reportButton')}
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}
      </div>
    </div>
  );
}

/** Memoised because App owns the active-screen state.
 *
 * Screens stay mounted once visited (see Screen.jsx), so every setScreen
 * re-renders App and React then reconciles every screen that has ever
 * been opened -- hidden ones skip layout and paint, not render. Measured
 * before this was added: a hidden Disk Map rendered twice across two tab
 * switches, once per switch, and that cost grows with every tab the user
 * has visited.
 *
 * Safe here specifically because its one prop, onReportBug, is a stable
 * callback from App (useCallback), so the comparison can never produce a
 * stale screen. A component with unstable props would gain nothing from
 * this and is deliberately left alone. */
export default memo(SettingsPage);
