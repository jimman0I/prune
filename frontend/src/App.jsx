import { useState } from 'react';
import ProgramList from './components/ProgramList.jsx';
import UninstallModal from './components/UninstallModal.jsx';
import QuarantinePanel from './components/QuarantinePanel.jsx';

export default function App() {
  const [selectedProgram, setSelectedProgram] = useState(null);

  return (
    <div className="app-shell">
      <div style={{ display: 'flex', gap: 24, padding: 24 }}>
        <div style={{ flex: 1 }}>
          <ProgramList onUninstall={setSelectedProgram} />
        </div>
        <div style={{ flex: 1 }}>
          <QuarantinePanel />
        </div>
      </div>
      {selectedProgram && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <UninstallModal program={selectedProgram} onClose={() => setSelectedProgram(null)} />
        </div>
      )}
    </div>
  );
}
