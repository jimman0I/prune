import { useState, useEffect } from 'react';
import NavRail from './components/NavRail.jsx';
import Dashboard from './components/Dashboard.jsx';
import DiskMap from './components/DiskMap.jsx';
import SmartCleanup from './components/SmartCleanup.jsx';
import ProgramList from './components/ProgramList.jsx';
import UninstallModal from './components/UninstallModal.jsx';
import QuarantinePanel from './components/QuarantinePanel.jsx';
import { fetchPrograms } from './lib/api.js';

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
  const [quarantineOpen, setQuarantineOpen] = useState(false);
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
        {screen === 'dashboard' && <Dashboard programs={programs} totalSize={totalSize} />}
        {screen === 'diskmap' && <DiskMap />}
        {screen === 'cleanup' && <SmartCleanup />}
        {screen === 'applications' && (
          <div className="px-12 py-10 max-w-[1400px]">
            <div className="flex items-baseline justify-between mb-8">
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
              <button className="btn-ghost" onClick={() => setQuarantineOpen(true)}>Quarantine</button>
            </div>
            <ProgramList programs={programs} onUninstall={setSelectedProgram} />
          </div>
        )}
      </div>
      {selectedProgram && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <UninstallModal program={selectedProgram} onClose={() => setSelectedProgram(null)} />
        </div>
      )}
      {quarantineOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center' }} onClick={(e) => { if (e.target === e.currentTarget) setQuarantineOpen(false); }}>
          <div className="glass-panel" style={{ padding: 24, width: 'min(560px, 90vw)', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
              <button className="btn-ghost" onClick={() => setQuarantineOpen(false)}>Close</button>
            </div>
            <QuarantinePanel />
          </div>
        </div>
      )}
    </div>
  );
}
