import { useState, useEffect } from 'react';
import NavRail from './components/NavRail.jsx';
import Dashboard from './components/Dashboard.jsx';
import DiskMap from './components/DiskMap.jsx';
import Screen from './components/Screen.jsx';
import { useProgramData } from './hooks/usePrograms.js';
import ToastHost from './components/ToastHost.jsx';
import ShortcutsModal from './components/ShortcutsModal.jsx';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts.js';
import ProgramList from './components/ProgramList.jsx';
import BatchUninstallModal from './components/BatchUninstallModal.jsx';
import ModalOverlay from './components/ModalOverlay.jsx';
import UninstallModal from './components/UninstallModal.jsx';
import QuarantineManager from './components/QuarantineManager.jsx';
import SettingsPage from './components/SettingsPage.jsx';
import DeepClean from './components/DeepClean.jsx';
import Duplicates from './components/Duplicates.jsx';
import StartupItems from './components/StartupItems.jsx';
import { rememberVisited } from './lib/visitedScreens.js';

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

  // Eight endpoints, merged at render. See hooks/usePrograms.js -- the
  // separation is load-bearing, not tidiness: these all cache on the
  // backend, so a warmed one can reply before the program list does, and
  // folding them into shared state used to let the slow list overwrite
  // the fast answer.
  const { programs, icons, totalSize, extensions, running, loading, error, refresh: refreshPrograms } =
    useProgramData();

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
    <div className="App grain h-screen overflow-hidden flex">
      <ToastHost />
      <NavRail screen={screen} onNavigate={setScreen} />
      <div className="flex-1 overflow-y-auto min-h-0">
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
            />
          </div>
        </Screen>
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
