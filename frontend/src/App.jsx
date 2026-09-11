import { useState, useEffect, useRef } from 'react';
import NavRail from './components/NavRail.jsx';
import TitleBar from './components/TitleBar.jsx';
import Dashboard from './components/Dashboard.jsx';
import DiskMap from './components/DiskMap.jsx';
import Screen from './components/Screen.jsx';
import { useProgramData } from './hooks/usePrograms.js';
import ToastHost from './components/ToastHost.jsx';
import UpdateTile from './components/UpdateTile.jsx';
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

function formatBytes(bytes) {
  if (bytes === null || bytes === undefined) return '—';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export default function App() {
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

  // Eight endpoints, merged at render. See hooks/usePrograms.js -- the
  // separation is load-bearing, not tidiness: these all cache on the
  // backend, so a warmed one can reply before the program list does, and
  // folding them into shared state used to let the slow list overwrite
  // the fast answer.
  const { programs, icons, totalSize, extensions, running, loading, error, refresh: refreshPrograms } =
    useProgramData();

  /* Reads the startup screen's list and icons while the app is idle.
   *
   * Both take seconds and both spawn PowerShell, and nothing asked for
   * either until the tab was opened -- so the first visit showed lettered
   * tiles that swapped to real icons while the user was already reading
   * the table. Warming it here costs nothing visible: it waits for idle,
   * and prefetchQuery is a no-op once the data is fresh. */
  useIdlePrefetch();

  /* The screen-change transition.
   *
   * Not AnimatePresence, and the reason is this app's architecture rather
   * than preference. Screens STAY MOUNTED once visited (see Screen.jsx) so
   * the Disk Map's scan and Deep Clean's results survive a tab switch.
   * AnimatePresence animates things in and out of the tree, and keying a
   * wrapper on `screen` would remount every screen on every switch --
   * throwing away exactly the state that design protects. So the CONTAINER
   * plays a short enter while its children are left alone.
   *
   * Web Animations rather than framer-motion, for one concrete reason:
   * framer-motion writes its keyframe values as INLINE STYLES, so a
   * cancelled or stalled run leaves `opacity: 0` sitting on the element
   * permanently. WAAPI at the default `fill: none` writes nothing -- once
   * the animation ends or is cancelled, the element is back to its
   * stylesheet value with no residue.
   *
   * That is NOT the same as "safe if it never runs". An animation that is
   * running but not progressing holds its first keyframe, whichever API
   * drives it, so a screen mid-transition in a context that never
   * composites shows opacity 0 either way. The cleanup below is what
   * bounds that: leaving the screen cancels the animation and the element
   * returns to visible immediately.
   *
   * The cancel is also a real fix rather than tidiness. Without it every
   * tab switch stacks another animation on the same element -- measured
   * three live at once after three switches -- and they fight over the
   * same properties.
   *
   * Reduced motion is checked directly. MotionConfig covers framer-motion
   * and index.css covers CSS transitions; neither reaches a WAAPI call. */
  const stageRef = useRef(null);
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage?.animate) return undefined;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;

    const animation = stage.animate(
      [
        { opacity: 0, transform: 'translateY(12px)' },
        { opacity: 1, transform: 'translateY(0)' }
      ],
      { duration: 300, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
    );
    return () => animation.cancel();
  }, [screen]);

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
    onHelp: () => setShowShortcuts(true)
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
      <UpdateTile />
      <NavRail screen={screen} onNavigate={setScreen} />
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
          <div className="px-12 py-10 h-full flex flex-col min-h-0">
            <div className="flex items-baseline justify-between mb-6 shrink-0">
              <div>
                <h1 className="display-heading text-[30px] leading-none">
                  Installed applications
                </h1>
                <p className="text-[13px] text-[color:var(--text-secondary)] mt-2.5">
                  <span className="text-[color:var(--text-primary)] font-medium">{programs.length}</span> applications ·
                  <span className="text-[color:var(--text-primary)] font-medium">{formatBytes(totalSize)}</span> installed
                </p>
              </div>
              <button className="btn-ghost" onClick={() => setScreen('quarantine')}>Quarantine</button>
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
          </div>
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
          label={`Uninstall ${batchPrograms.length} programs`}
          onClose={() => setBatchPrograms(null)}
        >
          <BatchUninstallModal
            programs={batchPrograms}
            onClose={() => setBatchPrograms(null)}
            onFinished={refreshPrograms}
          />
        </ModalOverlay>
      )}
      {storeAppToRemove && (
        <ModalOverlay
          label={`Remove ${storeAppToRemove.name}`}
          onClose={() => setStoreAppToRemove(null)}
        >
          <StoreRemoveDialog
            app={storeAppToRemove}
            onClose={() => setStoreAppToRemove(null)}
            onRemoved={refreshPrograms}
          />
        </ModalOverlay>
      )}
      {selectedProgram && (
        <ModalOverlay
          label={`Uninstall ${selectedProgram.name}`}
          onClose={() => setSelectedProgram(null)}
        >
          <UninstallModal
            program={selectedProgram}
            running={Boolean(running[selectedProgram.id])}
            onClose={() => setSelectedProgram(null)}
          />
        </ModalOverlay>
      )}
    </div>
  );
}
