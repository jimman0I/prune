import { useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { keys } from './lib/queryClient.js';
import NavRail from './components/NavRail.jsx';
import TitleBar from './components/TitleBar.jsx';
import Dashboard from './components/Dashboard.jsx';
import DiskMap from './components/DiskMap.jsx';
import Screen from './components/Screen.jsx';
import Page from './components/Page.jsx';
import { useProgramData } from './hooks/usePrograms.js';
import ToastHost from './components/ToastHost.jsx';
import UpdateButton from './components/UpdateButton.jsx';
import ShortcutsModal from './components/ShortcutsModal.jsx';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts.js';
import ProgramList from './components/ProgramList.jsx';
import BatchUninstallModal from './components/BatchUninstallModal.jsx';
import ModalOverlay from './components/ModalOverlay.jsx';
import UninstallModal from './components/UninstallModal.jsx';
import StoreRemoveDialog from './components/StoreRemoveDialog.jsx';
import QuarantineManager from './components/QuarantineManager.jsx';
import SettingsPage from './components/SettingsPage.jsx';
import DeepClean from './components/DeepClean.jsx';
import Duplicates from './components/Duplicates.jsx';
import StartupItems from './components/StartupItems.jsx';
import { rememberVisited } from './lib/visitedScreens.js';
import { useIdlePrefetch } from './hooks/useIdlePrefetch.js';
import { useScreenFade } from './hooks/useScreenFade.js';
import { useWindowActivity } from './hooks/useWindowActivity.js';
import { useLanguage } from './i18n/LanguageContext.jsx';

function formatBytes(bytes) {
  if (bytes === null || bytes === undefined) return '—';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export default function App() {
  const { t } = useLanguage();
  const [screen, setScreen] = useState('dashboard');

  // Which tabs have been opened. A screen is built the first time it is
  // asked for and then kept in the DOM, hidden, so switching away no
  // longer throws its state out -- the Disk Map used to rescan the drive
  // every time it was reopened, for a result it had already produced.
  const [visited, setVisited] = useState(() => new Set(['dashboard']));
  useEffect(() => { setVisited((prev) => rememberVisited(prev, screen)); }, [screen]);
  const [selectedProgram, setSelectedProgram] = useState(null);
  const [batchPrograms, setBatchPrograms] = useState(null);
  // Its own state rather than reusing selectedProgram: that one opens
  // UninstallModal, which runs a registered uninstaller a Store app
  // does not have.
  const [storeAppToRemove, setStoreAppToRemove] = useState(null);

  /* Whether the open uninstall dialog is in the middle of something it
   * cannot take back: a running uninstaller, a scan, a removal. Only one of
   * the three dialogs is ever open, so one flag serves them. Each reports it
   * through onBusyChange, and it turns Escape off (dismissible below). A
   * dialog closed mid-uninstall would keep running behind a screen that
   * still lists the program. */
  const [dialogBusy, setDialogBusy] = useState(false);
  const queryClient = useQueryClient();

  // Eight endpoints, merged at render. See hooks/usePrograms.js -- the
  // separation is load-bearing, not tidiness: these all cache on the
  // backend, so a warmed one can reply before the program list does, and
  // folding them into shared state used to let the slow list overwrite
  // the fast answer.
  const { programs, icons, totalSize, extensions, running, loading, error, refresh: refreshPrograms } =
    useProgramData();

  /* What every one of the three dialogs does when it closes, however it was
   * closed (its own button, Escape, a Done). The single-program dialog used to
   * close without telling anyone, so an uninstalled program stayed in the list
   * until something else refreshed it; and what a removal moved into
   * Quarantine was not on that screen until it was next fetched. */
  const closeDialog = (clear) => () => {
    clear(null);
    setDialogBusy(false);
    refreshPrograms();
    queryClient.invalidateQueries({ queryKey: keys.quarantine });
  };

  /* Reads the startup screen's list and icons while the app is idle.
   *
   * Both take seconds and both spawn PowerShell, and nothing asked for
   * either until the tab was opened -- so the first visit showed lettered
   * tiles that swapped to real icons while the user was already reading
   * the table. Warming it here costs nothing visible: it waits for idle,
   * and prefetchQuery is a no-op once the data is fresh. */
  useIdlePrefetch();

  /* The screen-change fade (see hooks/useScreenFade.js for why it is a
     container fade and not AnimatePresence: screens stay mounted). */
  const stageRef = useRef(null);
  useScreenFade(stageRef, screen);

  // Pauses the aurora while the window is unfocused or hidden.
  useWindowActivity();

  const [showShortcuts, setShowShortcuts] = useState(false);

  /** The app's global chords.
   *
   * Search focuses whichever search box is on screen rather than jumping
   * to a fixed one: the shortcut means "find the box here", and sending
   * someone to another tab's box would be a worse answer than doing
   * nothing. Only a VISIBLE box qualifies -- inactive screens stay mounted
   * and hidden, so their inputs are still in the DOM and still focusable
   * by script, which would put the caret somewhere nobody can see. */
  useKeyboardShortcuts({
    onSearch: () => {
      const box = [...document.querySelectorAll('[data-app-search]')]
        .find((input) => input.offsetParent !== null);
      box?.focus();
      box?.select?.();
    },
    onSettings: () => setScreen('settings'),
    onHelp: () => setShowShortcuts(true),
    /* Ctrl+1 to Ctrl+8, in rail order. Not while a dialog is open: the
       dialog traps focus precisely so the screen behind it stays put, and a
       chord that changed that screen from inside it would leave someone
       confirming a removal on a page they can no longer see. Asked of the
       DOM rather than of this component's own modal state, so a dialog a
       screen opens for itself (Deep Clean's risk warning) counts too. */
    onGoToScreen: (id) => {
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      setScreen(id);
    }
  });


  return (
    /* Column, then row. The title bar spans the full width above
       everything -- including the nav rail -- because it is the WINDOW's
       bar, not the content area's, and Windows draws its buttons across
       the whole top edge regardless of what is underneath them. */
    <div className="App grain h-screen overflow-hidden flex flex-col">
      <TitleBar />
      <div className="flex-1 flex min-h-0">
      <ToastHost />
      <NavRail screen={screen} onNavigate={setScreen} footer={<UpdateButton />} />
      <div ref={stageRef} className="flex-1 overflow-y-auto min-h-0">
        <Screen active={screen === 'dashboard'} visited={visited.has('dashboard')}>
          <Dashboard programs={programs} totalSize={totalSize} onNavigate={setScreen} />
        </Screen>
        <Screen active={screen === 'diskmap'} visited={visited.has('diskmap')}><DiskMap /></Screen>
        <Screen active={screen === 'quarantine'} visited={visited.has('quarantine')}><QuarantineManager /></Screen>
        <Screen active={screen === 'settings'} visited={visited.has('settings')}><SettingsPage /></Screen>
        <Screen active={screen === 'startup'} visited={visited.has('startup')}><StartupItems /></Screen>
        <Screen active={screen === 'deepclean'} visited={visited.has('deepclean')}><DeepClean /></Screen>
        <Screen active={screen === 'duplicates'} visited={visited.has('duplicates')}><Duplicates /></Screen>
        <Screen active={screen === 'applications'} visited={visited.has('applications')}>
          <Page className="h-full flex flex-col min-h-0">
            <div className="flex items-baseline justify-between mb-6 shrink-0">
              <div>
                <h1 className="display-heading text-[30px] leading-none">
                  {t('app.installedApplications')}
                </h1>
                <p className="text-[13px] text-[color:var(--text-secondary)] mt-2.5">
                  {t('app.applicationsSummary', programs.length, formatBytes(totalSize))}
                </p>
              </div>
              <button className="btn-ghost" onClick={() => setScreen('quarantine')}>{t('nav.quarantine')}</button>
            </div>
            <ProgramList
              programs={programs}
              extensions={extensions}
              running={running}
              icons={icons}
              onUninstall={setSelectedProgram}
              onBatchUninstall={setBatchPrograms}
              onRemoveStoreApp={setStoreAppToRemove}
            />
          </Page>
        </Screen>
      </div>
      </div>
      {/* Both dialogs used to be a bare inline-styled fixed div: no
          role, no Escape, no focus trap, no initial focus. Tab from an
          open uninstall dialog moved focus into the program list behind
          it, so the user was driving the table they were about to delete
          from while the dialog was still up. */}
      {showShortcuts && <ShortcutsModal onClose={() => setShowShortcuts(false)} />}

      {batchPrograms && (
        <ModalOverlay
          label={t('batchUninstallModal.title', batchPrograms.length)}
          onClose={closeDialog(setBatchPrograms)}
          dismissible={!dialogBusy}
        >
          <BatchUninstallModal
            programs={batchPrograms}
            onClose={closeDialog(setBatchPrograms)}
            onBusyChange={setDialogBusy}
          />
        </ModalOverlay>
      )}
      {storeAppToRemove && (
        <ModalOverlay
          label={t('app.removeStoreApp', storeAppToRemove.name)}
          onClose={closeDialog(setStoreAppToRemove)}
          dismissible={!dialogBusy}
        >
          <StoreRemoveDialog
            app={storeAppToRemove}
            onClose={closeDialog(setStoreAppToRemove)}
            onRemoved={refreshPrograms}
            onBusyChange={setDialogBusy}
          />
        </ModalOverlay>
      )}
      {selectedProgram && (
        <ModalOverlay
          label={t('uninstallModal.titleNormal', selectedProgram.name)}
          onClose={closeDialog(setSelectedProgram)}
          dismissible={!dialogBusy}
        >
          <UninstallModal
            program={selectedProgram}
            running={Boolean(running[selectedProgram.id])}
            onClose={closeDialog(setSelectedProgram)}
            onBusyChange={setDialogBusy}
          />
        </ModalOverlay>
      )}
    </div>
  );
}
