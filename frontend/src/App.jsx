import { useState, useEffect, useCallback } from 'react';
import NavRail from './components/NavRail.jsx';
import Dashboard from './components/Dashboard.jsx';
import DiskMap from './components/DiskMap.jsx';
import SmartCleanup from './components/SmartCleanup.jsx';
import ProgramList from './components/ProgramList.jsx';
import BatchUninstallModal from './components/BatchUninstallModal.jsx';
import UninstallModal from './components/UninstallModal.jsx';
import QuarantineManager from './components/QuarantineManager.jsx';
import SettingsPage from './components/SettingsPage.jsx';
import DeepClean from './components/DeepClean.jsx';
import { fetchPrograms, fetchProgramIcons } from './lib/api.js';

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
  const [selectedProgram, setSelectedProgram] = useState(null);
  const [batchPrograms, setBatchPrograms] = useState(null);
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Fetched at app start, not when the Application Manager opens.
  // Extraction takes ~2s across ~90 executables, and doing it on tab
  // click meant watching the icons appear a beat after the list did.
  // The backend also warms this cache the moment it boots, so by the
  // time anyone reaches that screen both ends are already done.
  const [icons, setIcons] = useState({});

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
        {screen === 'dashboard' && <Dashboard programs={programs} totalSize={totalSize} onNavigate={setScreen} />}
        {screen === 'diskmap' && <DiskMap />}
        {screen === 'cleanup' && <SmartCleanup />}
        {screen === 'quarantine' && <QuarantineManager />}
        {screen === 'settings' && <SettingsPage />}
        {screen === 'deepclean' && <DeepClean />}
        {screen === 'applications' && (
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
              icons={icons}
              onUninstall={setSelectedProgram}
              onBatchUninstall={setBatchPrograms}
            />
          </div>
        )}
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
