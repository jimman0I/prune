import { useState } from 'react';
import { scanForLeftovers, streamUninstall } from '../lib/api.js';
import LeftoverReview from './LeftoverReview.jsx';

export default function UninstallModal({ program, onClose }) {
  const [step, setStep] = useState('uninstalling');
  const [scanResult, setScanResult] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [events, setEvents] = useState([]);

  const startUninstall = async () => {
    setStep('uninstalling');
    setEvents([]);
    await streamUninstall(program.uninstallString, (type, data) => {
      setEvents(prev => [...prev, { type, data }]);
    });
    const result = await scanForLeftovers(program.name, program.publisher);
    setScanResult(result);
    const allKeys = [];
    Object.keys(result).forEach(groupKey => {
      const group = result[groupKey];
      if (group && group.items) {
        group.items.forEach((_, i) => {
          allKeys.push(`${groupKey}:${i}`);
        });
      }
    });
    setSelected(new Set(allKeys));
    setStep('review');
  };

  const handleToggle = (key) => {
    const newSelected = new Set(selected);
    if (newSelected.has(key)) {
      newSelected.delete(key);
    } else {
      newSelected.add(key);
    }
    setSelected(newSelected);
  };

  const handleConfirm = async () => {
    // Placeholder for the actual removal logic
    onClose();
  };

  const handleSkip = () => {
    onClose();
  };

  return (
    <div style={{ background: 'var(--bg-zinc)', borderRadius: 12, padding: 24, maxWidth: 520, width: '100%' }}>
      <h2 style={{ color: 'var(--text-primary)', fontSize: 18, fontWeight: 600, marginBottom: 16 }}>
        Uninstall {program.name}
      </h2>
      {step === 'uninstalling' && (
        <div>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 16 }}>
            Uninstalling {program.name}…
          </p>
          <button className="btn-primary" onClick={startUninstall}>Start Uninstall</button>
        </div>
      )}
      {step === 'review' && scanResult && (
        <LeftoverReview
          scanResult={scanResult}
          selected={selected}
          onToggle={handleToggle}
          onConfirm={handleConfirm}
          onSkip={handleSkip}
        />
      )}
    </div>
  );
}