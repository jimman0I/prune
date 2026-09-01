import { useState } from 'react';
import { scanForLeftovers, streamUninstall, appendHistoryEntry } from '../lib/api.js';
import LeftoverReview from './LeftoverReview.jsx';

/** Shared spinner + live-command UI for both the "running the native
 * uninstaller" and "scanning for leftovers" phases -- same treatment,
 * different label/command text, matching the mockup's own reuse of one
 * progress view for both phases. */
function ProgressPhase({ title, command, progress }) {
  return (
    <div className="flex flex-col items-center justify-center py-10">
      <div className="w-14 h-14 rounded-2xl bg-[color:var(--accent-coral)]/10 border border-[color:var(--accent-coral)]/25 flex items-center justify-center mb-5">
        <div className="w-6 h-6 border-2 border-[color:var(--accent-coral)] border-t-transparent rounded-full animate-spin"></div>
      </div>
      <p className="text-[15px] font-medium mb-1">{title}</p>
      <p className="text-[12.5px] text-[color:var(--text-secondary)] font-mono mb-6">{command}</p>
      <div className="w-full max-w-sm h-1 rounded-full bg-[color:var(--bg-panel)] overflow-hidden">
        <div className="h-full rounded-full bg-gradient-to-r from-[color:var(--accent-coral)] to-[#e8624f] transition-all duration-500" style={{ width: `${progress}%` }}></div>
      </div>
    </div>
  );
}

export default function UninstallModal({ program, onClose }) {
  const [step, setStep] = useState('confirm');
  const [scanResult, setScanResult] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [error, setError] = useState(null);

  const startUninstall = async () => {
    setError(null);
    setStep('uninstalling');
    try {
      await streamUninstall(program.uninstallString, () => {});
      appendHistoryEntry({ programName: program.name, publisher: program.publisher, sizeBytes: program.sizeBytes }).catch(() => {
        // Best-effort logging -- a failed history write must never block
        // or fail the uninstall flow itself, the uninstall already
        // genuinely succeeded by this point.
      });
      setStep('scanning');
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
    } catch (err) {
      setError(err.message);
      setStep('confirm');
    }
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

  // program.id can carry a "#2"-style suffix (dedupeIds, for programs whose
  // registry key collides across hives) -- that's a React-key concern only,
  // strip it before showing anything that looks like a real command.
  const displayId = (program.id || '').replace(/#\d+$/, '');
  const command = `MsiExec.exe /X${displayId.toUpperCase()} /qn`;

  return (
    <div className="glass-panel rounded-2xl overflow-hidden max-w-[680px] w-full flex flex-col">
      <div className="flex items-center justify-between px-6 py-5 border-b border-[color:var(--border-subtle)]">
        <h2 className="text-[15px] font-semibold tracking-tight text-white truncate">
          Uninstall {program.name}
        </h2>
        <button onClick={onClose} className="btn-ghost px-3 py-1.5 rounded-lg text-[12px] font-medium">
          Close
        </button>
      </div>
      <div className="px-6 py-6">
        {step === 'confirm' && (
          <div>
            <p className="text-[13px] text-[color:var(--text-secondary)] mb-1">
              This runs {program.name}'s own uninstaller, then scans for anything it leaves behind.
            </p>
            <p className="text-[11.5px] text-[color:var(--text-muted)] font-mono mb-6">{command}</p>
            {error && (
              <p className="text-[12.5px] text-[#f7a8b0] mb-4">Uninstall failed: {error}</p>
            )}
            <button className="btn-primary" onClick={startUninstall}>Start uninstall</button>
          </div>
        )}
        {step === 'uninstalling' && (
          <ProgressPhase title="Running native uninstaller" command={command} progress={45} />
        )}
        {step === 'scanning' && (
          <ProgressPhase
            title="Scanning for leftovers"
            command="Checking filesystem, registry & scheduled tasks…"
            progress={85}
          />
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
    </div>
  );
}
