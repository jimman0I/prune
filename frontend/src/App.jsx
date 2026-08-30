import { useState } from 'react';
import ProgramList from './components/ProgramList.jsx';
import UninstallModal from './components/UninstallModal.jsx';
import QuarantinePanel from './components/QuarantinePanel.jsx';

export default function App() {
  const [selectedProgram, setSelectedProgram] = useState(null);
  const [quarantineOpen, setQuarantineOpen] = useState(false);

  return (
    <div className="App grain h-screen overflow-hidden flex flex-col">
      <div className="px-12 py-10 max-w-[1400px] overflow-y-auto flex-1 min-h-0">
        <div className="flex items-baseline justify-between mb-8">
          <div>
            <div className="text-[11px] text-[#71717a] font-mono uppercase tracking-[0.16em] mb-2">
              Application Manager
            </div>
            <h1 className="text-[30px] font-semibold tracking-tight leading-none">
              Installed applications
            </h1>
          </div>
          <button className="btn-ghost" onClick={() => setQuarantineOpen(true)}>Quarantine</button>
        </div>
        <ProgramList onUninstall={setSelectedProgram} />
      </div>
      {selectedProgram && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <UninstallModal program={selectedProgram} onClose={() => setSelectedProgram(null)} />
        </div>
      )}
      {quarantineOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center' }} onClick={(e) => { if (e.target === e.currentTarget) setQuarantineOpen(false); }}>
          <div className="glass-strong" style={{ borderRadius: 16, padding: 24, width: 'min(560px, 90vw)', maxHeight: '80vh', overflowY: 'auto' }}>
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
