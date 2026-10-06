import { useState, useEffect, useRef, useCallback, lazy, Suspense, startTransition } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { keys } from './lib/queryClient.js';
import NavRail from './components/NavRail.jsx';
import TitleBar from './components/TitleBar.jsx';
import Dashboard from './components/Dashboard.jsx';
import Screen from './components/Screen.jsx';
import Page from './components/Page.jsx';
import { useProgramData } from './hooks/usePrograms.js';
import ToastHost from './components/ToastHost.jsx';
import UpdateButton from './components/UpdateButton.jsx';
import ShortcutsModal from './components/ShortcutsModal.jsx';
import BugReportModal from './components/BugReportModal.jsx';
import WhatsNewDialog from './components/WhatsNewDialog.jsx';
import { useWhatsNew } from './hooks/useWhatsNew.js';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts.js';
import BatchUninstallModal from './components/BatchUninstallModal.jsx';
import ModalOverlay from './components/ModalOverlay.jsx';
import UninstallModal from './components/UninstallModal.jsx';
import StoreRemoveDialog from './components/StoreRemoveDialog.jsx';
import ApplicationsTools from './components/ApplicationsTools.jsx';
import ProgramDropZone from './components/ProgramDropZone.jsx';
import { onOpenRequest } from './lib/openRequests.js';
import { rememberVisited } from './lib/visitedScreens.js';
import { useIdlePrefetch } from './hooks/useIdlePrefetch.js';
import { useScreenFade } from './hooks/useScreenFade.js';
import { useWindowActivity } from './hooks/useWindowActivity.js';
import { useLowPowerMode } from './hooks/useLowPowerMode.js';
import { useSettings } from './hooks/useSystemQueries.js';
import { useLanguage } from './i18n/LanguageContext.jsx';
import { applicationsSummary } from './lib/applicationsSummary.js';
import { setLastProgramsCount } from './lib/lastProgramsCount.js';

/* Every screen but Dashboard, loaded on first visit rather than bundled
 * into the initial chunk. Dashboard's own ~530 lines stay a static import
 * -- it's the one screen every launch shows regardless -- but these seven
 * together are over 5,000 lines, more than half the app, for six screens
 * and Applications' own list that are frequently never opened in a given
 * session at all. Screen.jsx already returns null until `visited`, so
 * none of these begin loading before that; the Suspense fallback below
 * each one only shows for the brief first fetch of its chunk, a local
 * file in the packaged app rather than a network request. */
const DiskMap = lazy(() => import('./components/DiskMap.jsx'));
const ProgramList = lazy(() => import('./components/ProgramList.jsx'));
const QuarantineManager = lazy(() => import('./components/QuarantineManager.jsx'));
const SettingsPage = lazy(() => import('./components/SettingsPage.jsx'));
const DeepClean = lazy(() => import('./components/DeepClean.jsx'));
const Duplicates = lazy(() => import('./components/Duplicates.jsx'));
const StartupItems = lazy(() => import('./components/StartupItems.jsx'));

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
  // Two values for one idea. `screen` is what is RENDERED; `navTarget` is what the
  // sidebar shows. A click sets the second at once, so the highlight starts sliding
  // immediately, and the first inside a transition, so React builds the new screen
  // in small interruptible slices instead of one 400ms+ block (Applications used to
  // freeze the whole window that long on first open) and keeps showing the old
  // screen until the new one is ready.
  const [screen, setCommittedScreen] = useState('dashboard');
  const [navTarget, setNavTarget] = useState('dashboard');

  // Which tabs have been opened. A screen is built the first time it is
  // asked for and then kept in the DOM, hidden, so switching away no
  // longer throws its state out -- the Disk Map used to rescan the drive
  // every time it was reopened, for a result it had already produced.
  const [visited, setVisited] = useState(() => new Set(['dashboard']));
  const setScreen = useCallback((id) => {
    setNavTarget(id);
    startTransition(() => {
      setCommittedScreen(id);
      setVisited((prev) => rememberVisited(prev, id));
    });
  }, []);
  useEffect(() => { setVisited((prev) => rememberVisited(prev, screen)); }, [screen]);
  const [selectedProgram, setSelectedProgram] = useState(null);
  const [batchPrograms, setBatchPrograms] = useState(null);
  // Its own state rather than reusing selectedProgram: that one opens
  // UninstallModal, which runs a registered uninstaller a Store app
  // does not have.
  const [storeAppToRemove, setStoreAppToRemove] = useState(null);
  // What the Applications list is showing under its search and filter, for the
  // heading's count. The list owns both; the heading only reads the result.
  const [appsView, setAppsView] = useState(null);

  /* Requests from File Explorer's right-click menu ("Shred with Prune", "Find
   * in Prune (uninstall)") and a program dropped on Applications. Each one only
   * SHOWS something: the Shred dialog with the path filled in, or the find
   * dialog -- nothing is shredded or uninstalled without those dialogs' own
   * confirmations. A nonce makes a second request for the same file count.
   *
   * A find request waits while one of the three removal dialogs is open: handing
   * a match to the uninstall dialog would swap the program a running uninstall
   * is about. */
  const requestCount = useRef(0);
  const [shredRequest, setShredRequest] = useState(null);
  const [findRequest, setFindRequest] = useState(null);
  const [waitingFind, setWaitingFind] = useState(null);
  const requestFind = useCallback((path) => {
    setScreen('applications');
    setWaitingFind(path);
  }, []);
  useEffect(() => onOpenRequest((open) => {
    requestCount.current += 1;
    if (open.kind === 'shred') {
      setShredRequest({ paths: [open.path], nonce: requestCount.current });
      setScreen('deepclean');
    } else {
      requestFind(open.path);
    }
  }), [requestFind]);

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
  //
  // Five of the eight only feed Applications (icons, versions, install
  // dates, extensions, the running-process poll) and stay off, via
  // `visited` -- the same tracking that decides which screens to mount --
  // until that screen has actually been opened once this session.
  const { programs, icons, totalSize, extensions, running, loading, error, sizesSettled, refresh: refreshPrograms } =
    useProgramData({ loadDecorations: visited.has('applications') });

  // Bug report diagnostic (lib/lastProgramsCount.js). The base list query
  // is eager regardless of screen (Dashboard needs it too), so this is
  // known within about a second of launch -- not gated on an Applications
  // visit. Real bug this caught in its own first live check: an earlier
  // version of this set it from ProgramList's own local fetch fallback,
  // which App.jsx's `programs` prop makes unreachable in the shipped app,
  // so the count silently never showed up at all.
  useEffect(() => {
    if (!loading && !error) setLastProgramsCount(programs.length);
  }, [loading, error, programs.length]);

  /* What every one of the three dialogs does when it closes, however it was
   * closed (its own button, Escape, a Done). The single-program dialog used to
   * close without telling anyone, so an uninstalled program stayed in the list
   * until something else refreshed it; and what a removal moved into
   * Quarantine was not on that screen until it was next fetched. */
  const removalDialogOpen = Boolean(selectedProgram || batchPrograms || storeAppToRemove);
  useEffect(() => {
    if (!waitingFind || removalDialogOpen) return;
    requestCount.current += 1;
    setFindRequest({ path: waitingFind, nonce: requestCount.current });
    setWaitingFind(null);
  }, [waitingFind, removalDialogOpen]);

  const closeDialog = (clear) => () => {
    clear(null);
    setDialogBusy(false);
    refreshPrograms();
    queryClient.invalidateQueries({ queryKey: keys.quarantine });
  };

  // The Dashboard's "view all" opens the Quarantine screen on its History tab.
  // Asked for by a state value rather than a call so the screen, kept mounted
  // once visited, can follow it.
  // The nonce makes a second request for the same tab count as a request.
  const [quarantineTab, setQuarantineTab] = useState({ tab: 'quarantine', nonce: 0 });
  const openHistory = useCallback(() => {
    setQuarantineTab((current) => ({ tab: 'history', nonce: current.nonce + 1 }));
    setScreen('quarantine');
  }, []);

  // The Applications tools (forced uninstall and the rest) change what is on
  // the machine and what is in Quarantine; this is what closing one does.
  const handleToolsChanged = useCallback(() => {
    refreshPrograms();
    queryClient.invalidateQueries({ queryKey: keys.quarantine });
  }, [refreshPrograms, queryClient]);

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

  // Settings -> General -> Low power mode (and the same auto-detected
  // default a brand-new install already picks -- see backend's
  // detectLowPowerDefault()). A second useSettings() call, same query
  // key as SettingsPage's own, so React Query serves it from cache
  // rather than a second request.
  const { settings: appSettings } = useSettings();
  useLowPowerMode(appSettings?.lowPowerMode === true);

  const [showShortcuts, setShowShortcuts] = useState(false);
  // One dialog, opened from the rail and from Settings > About. Stable, so
  // the memoised SettingsPage that receives it does not re-render with App.
  const [showBugReport, setShowBugReport] = useState(false);
  const openBugReport = useCallback(() => setShowBugReport(true), []);

  /* The "What's new" notice after an update (hooks/useWhatsNew.js). It waits
     while one of this component's own dialogs is up; a screen's own is found
     in the DOM. "Show me" lands on a screen and, for Settings, a tab. */
  const [settingsTabRequest, setSettingsTabRequest] = useState({ tab: null, nonce: 0 });
  const whatsNew = useWhatsNew({
    blocked: showShortcuts || showBugReport || Boolean(selectedProgram || batchPrograms || storeAppToRemove)
  });
  const openWhatsNew = whatsNew.openManual;
  const goToWhatsNewTarget = useCallback((target) => {
    if (target.settingsTab) setSettingsTabRequest((current) => ({ tab: target.settingsTab, nonce: current.nonce + 1 }));
    setScreen(target.screen);
  }, []);

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
      <NavRail screen={navTarget} onNavigate={setScreen} footer={<UpdateButton />} onReportBug={openBugReport} />
      <div ref={stageRef} className="flex-1 overflow-y-auto min-h-0">
        <Screen active={screen === 'dashboard'} visited={visited.has('dashboard')}>
          <Dashboard programs={programs} programsMeasured={sizesSettled} onNavigate={setScreen} onOpenHistory={openHistory} active={screen === 'dashboard'} />
        </Screen>
        <Screen active={screen === 'diskmap'} visited={visited.has('diskmap')}>
          <Suspense fallback={null}><DiskMap /></Suspense>
        </Screen>
        <Screen active={screen === 'quarantine'} visited={visited.has('quarantine')}>
          <Suspense fallback={null}><QuarantineManager initialTab={quarantineTab.tab} tabNonce={quarantineTab.nonce} /></Suspense>
        </Screen>
        <Screen active={screen === 'settings'} visited={visited.has('settings')}>
          <Suspense fallback={null}><SettingsPage onReportBug={openBugReport} onShowWhatsNew={openWhatsNew} tabRequest={settingsTabRequest} /></Suspense>
        </Screen>
        <Screen active={screen === 'startup'} visited={visited.has('startup')}>
          <Suspense fallback={null}><StartupItems /></Suspense>
        </Screen>
        <Screen active={screen === 'deepclean'} visited={visited.has('deepclean')}>
          <Suspense fallback={null}><DeepClean onNavigate={setScreen} shredRequest={shredRequest} /></Suspense>
        </Screen>
        <Screen active={screen === 'duplicates'} visited={visited.has('duplicates')}>
          <Suspense fallback={null}><Duplicates /></Suspense>
        </Screen>
        <Screen active={screen === 'applications'} visited={visited.has('applications')}>
          {/* A program (.exe) or shortcut (.lnk) dropped anywhere on this screen is
              looked up like the right-click "Find in Prune". */}
          <ProgramDropZone className="h-full" onProgramFile={requestFind}>
          <Page className="h-full flex flex-col min-h-0">
            <div className="flex items-baseline justify-between mb-6 shrink-0">
              <div>
                <h1 className="display-heading text-[30px] leading-none">
                  {t('app.installedApplications')}
                </h1>
                <p className="text-[13px] text-[color:var(--text-secondary)] mt-2.5">
                  {applicationsSummary({ t, view: appsView, count: programs.length, sizeBytes: totalSize, format: formatBytes })}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <ApplicationsTools programs={programs} onChanged={handleToolsChanged} onUninstall={setSelectedProgram} findRequest={findRequest} />
                <button className="btn-ghost" onClick={() => setScreen('quarantine')}>{t('nav.quarantine')}</button>
              </div>
            </div>
            <Suspense fallback={null}>
              <ProgramList
                programs={programs}
                extensions={extensions}
                running={running}
                icons={icons}
                onUninstall={setSelectedProgram}
                onBatchUninstall={setBatchPrograms}
                onRemoveStoreApp={setStoreAppToRemove}
                onViewChange={setAppsView}
              />
            </Suspense>
          </Page>
          </ProgramDropZone>
        </Screen>
      </div>
      </div>
      {/* Both dialogs used to be a bare inline-styled fixed div: no
          role, no Escape, no focus trap, no initial focus. Tab from an
          open uninstall dialog moved focus into the program list behind
          it, so the user was driving the table they were about to delete
          from while the dialog was still up. */}
      {showShortcuts && <ShortcutsModal onClose={() => setShowShortcuts(false)} />}
      {showBugReport && <BugReportModal onClose={() => setShowBugReport(false)} />}
      {whatsNew.mode && (
        <WhatsNewDialog
          version={whatsNew.version}
          onClose={whatsNew.dismiss}
          onShowMe={(target) => whatsNew.showMe(target, goToWhatsNewTarget)}
        />
      )}

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
