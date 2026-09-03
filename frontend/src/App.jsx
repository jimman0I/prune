import { useState, useEffect, useCallback, useMemo } from 'react';
import NavRail from './components/NavRail.jsx';
import Dashboard from './components/Dashboard.jsx';
import DiskMap from './components/DiskMap.jsx';
import Screen from './components/Screen.jsx';
import SmartCleanup from './components/SmartCleanup.jsx';
import ProgramList from './components/ProgramList.jsx';
import BatchUninstallModal from './components/BatchUninstallModal.jsx';
import UninstallModal from './components/UninstallModal.jsx';
import QuarantineManager from './components/QuarantineManager.jsx';
import SettingsPage from './components/SettingsPage.jsx';
import DeepClean from './components/DeepClean.jsx';
import StartupItems from './components/StartupItems.jsx';
import { fetchPrograms, fetchProgramIcons, fetchProgramSizes, fetchProgramVersions, fetchProgramInstallDates, fetchStoreApps, fetchBrowserExtensions } from './lib/api.js';
import { mergeMeasuredSizes } from './lib/mergeSizes.js';
import { mergeBinaryVersions } from './lib/mergeVersions.js';
import { mergeInstallDates } from './lib/mergeInstallDates.js';
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
  const [rawPrograms, setPrograms] = useState([]);

  // Sizes and versions are kept as they arrive rather than folded into
  // the program list, and merged at render instead.
  //
  // Folding them in was a real bug: both endpoints cache their answer on
  // the backend, so a warmed one replies in under two milliseconds while
  // the program list itself takes over a second. The merge then ran
  // against an empty array and the list that arrived afterwards wiped it
  // out -- versions the backend had correctly found never reached the
  // screen. Deriving the merge means the order the three land in cannot
  // matter.
  const [measuredSizes, setMeasuredSizes] = useState({});
  const [binaryVersions, setBinaryVersions] = useState({});
  const [keyInstallDates, setKeyInstallDates] = useState({});
  const [storeApps, setStoreApps] = useState([]);
  const [extensions, setExtensions] = useState([]);

  const programs = useMemo(
    () => [
      ...mergeInstallDates(
        mergeBinaryVersions(mergeMeasuredSizes(rawPrograms, measuredSizes), binaryVersions),
        keyInstallDates
      ),
      // Appended rather than merged: a Store app is not a registry entry
      // and none of the three fallbacks above apply to it -- it already
      // carries its own name, version and measured size.
      ...storeApps
    ],
    [rawPrograms, measuredSizes, binaryVersions, keyInstallDates, storeApps]
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Fetched at app start, not when the Application Manager opens.
  // Extraction takes ~2s across ~90 executables, and doing it on tab
  // click meant watching the icons appear a beat after the list did.
  // The backend also warms this cache the moment it boots, so by the
  // time anyone reaches that screen both ends are already done.
  const [icons, setIcons] = useState({});

  // Sizes for the 40 entries whose registry record has none. Measured by
  // walking their install folders, so it takes a while and arrives after
  // the list -- the rows show their real blank until it does, rather than
  // the list waiting on it.
  useEffect(() => {
    let cancelled = false;
    fetchProgramSizes()
      .then((sizes) => {
        if (!cancelled) setMeasuredSizes(sizes || {});
      })
      .catch(() => { /* the rows keep their honest blank */ });
    return () => { cancelled = true; };
  }, []);

  // Versions for the 15 entries whose registry record has none -- almost
  // all of them launcher-installed games, which is exactly where a blank
  // Version column is most noticeable. Read off each program's own
  // binary, so like the sizes it arrives after the list.
  useEffect(() => {
    let cancelled = false;
    fetchProgramVersions()
      .then((versions) => {
        if (!cancelled) setBinaryVersions(versions || {});
      })
      .catch(() => { /* the rows keep their honest blank */ });
    return () => { cancelled = true; };
  }, []);

  // Install dates for the 67 entries whose registry record has none -- more
  // than half the list, which is why the Installed column read as mostly
  // dashes next to Revo's.
  useEffect(() => {
    let cancelled = false;
    fetchProgramInstallDates()
      .then((dates) => { if (!cancelled) setKeyInstallDates(dates || {}); })
      .catch(() => { /* the rows keep their honest blank */ });
    return () => { cancelled = true; };
  }, []);

  // Store apps, which the uninstall registry does not list at all -- 81 of
  // them here, entirely invisible to Prune before this.
  useEffect(() => {
    let cancelled = false;
    fetchStoreApps()
      .then((apps) => { if (!cancelled) setStoreApps(apps || []); })
      .catch(() => { /* the registry programs still list fine */ });
    return () => { cancelled = true; };
  }, []);

  // Browser extensions, which no uninstall list mentions at all. Kept out
  // of `programs` on purpose: an extension is not an installed program,
  // and folding 24 of them into the list would dilute the count and the
  // total. They get their own filter instead, the way Revo gives them
  // their own module.
  useEffect(() => {
    let cancelled = false;
    fetchBrowserExtensions()
      .then((list) => { if (!cancelled) setExtensions(list || []); })
      .catch(() => { /* the program list is unaffected */ });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchProgramIcons()
      .then((result) => { if (!cancelled) setIcons(result); })
      .catch(() => { /* icons are decoration -- never block the app */ });
    return () => { cancelled = true; };
  }, []);

  // Named so the batch can call it when it finishes: the list on screen
  // would otherwise still show programs that are no longer installed.
  const refreshPrograms = useCallback(() => {
    fetchPrograms().then(setPrograms).catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchPrograms()
      .then((result) => { if (!cancelled) setPrograms(result); })
      .catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const totalSize = programs.reduce((sum, program) => sum + (program.sizeBytes || 0), 0);

  return (
    <div className="App grain h-screen overflow-hidden flex">
      <NavRail screen={screen} onNavigate={setScreen} />
      <div className="flex-1 overflow-y-auto min-h-0">
        <Screen active={screen === 'dashboard'} visited={visited.has('dashboard')}>
          <Dashboard programs={programs} totalSize={totalSize} onNavigate={setScreen} />
        </Screen>
        <Screen active={screen === 'diskmap'} visited={visited.has('diskmap')}><DiskMap /></Screen>
        <Screen active={screen === 'cleanup'} visited={visited.has('cleanup')}><SmartCleanup /></Screen>
        <Screen active={screen === 'quarantine'} visited={visited.has('quarantine')}><QuarantineManager /></Screen>
        <Screen active={screen === 'settings'} visited={visited.has('settings')}><SettingsPage /></Screen>
        <Screen active={screen === 'startup'} visited={visited.has('startup')}><StartupItems /></Screen>
        <Screen active={screen === 'deepclean'} visited={visited.has('deepclean')}><DeepClean /></Screen>
        <Screen active={screen === 'applications'} visited={visited.has('applications')}>
          <div className="px-12 py-10 h-full flex flex-col min-h-0">
            <div className="flex items-baseline justify-between mb-6 shrink-0">
              <div>
                <div className="text-[11px] text-[color:var(--text-muted)] font-mono uppercase tracking-[0.16em] mb-2">
                  Application Manager
                </div>
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
              icons={icons}
              onUninstall={setSelectedProgram}
              onBatchUninstall={setBatchPrograms}
            />
          </div>
        </Screen>
      </div>
      {batchPrograms && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <BatchUninstallModal
            programs={batchPrograms}
            onClose={() => setBatchPrograms(null)}
            onFinished={refreshPrograms}
          />
        </div>
      )}
      {selectedProgram && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <UninstallModal program={selectedProgram} onClose={() => setSelectedProgram(null)} />
        </div>
      )}
    </div>
  );
}
