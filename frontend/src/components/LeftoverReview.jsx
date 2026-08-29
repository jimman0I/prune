import { useState } from 'react';

export default function LeftoverReview({ scanResult, selected, onToggle, onConfirm, onSkip }) {
  const [allSelected, setAllSelected] = useState(true);

  const toggleAll = () => {
    const newState = !allSelected;
    setAllSelected(newState);
    if (onToggle) {
      const allKeys = new Set([
        ...(scanResult.files || []),
        ...(scanResult.registryKeys || []),
        ...(scanResult.scheduledTasks || []),
      ]);
      if (!newState) allKeys.clear();
      onToggle(allKeys);
    }
  };

  const renderGroup = (title, items) => (
    <div className="mb-6">
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <ul className="space-y-2">
        {items?.map((item, i) => (
          <li key={i} className="flex items-center">
            <input
              type="checkbox"
              className="checkbox-sleek mr-2"
              checked={selected.has(item)}
              onChange={() => {
                const newSet = new Set(selected);
                if (newSet.has(item)) newSet.delete(item);
                else newSet.add(item);
                onToggle(newSet);
              }}
            />
            <span className="font-mono text-sm">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <div className="glass-panel">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Review Leftovers</h2>
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="selectAll"
            className="checkbox-sleek"
            checked={allSelected}
            onChange={toggleAll}
          />
          <label htmlFor="selectAll" className="text-sm">
            Select All
          </label>
        </div>
      </div>
      {renderGroup('Files', scanResult.files)}
      {renderGroup('Registry Keys', scanResult.registryKeys)}
      {renderGroup('Scheduled Tasks', scanResult.scheduledTasks)}
      <div className="flex justify-end space-x-2 mt-6">
        <button onClick={onSkip} className="btn btn-ghost">
          Skip
        </button>
        <button
          onClick={onConfirm}
          className="btn btn-danger"
          disabled={selected.size === 0}
        >
          Remove Selected
        </button>
      </div>
    </div>
  );
}
