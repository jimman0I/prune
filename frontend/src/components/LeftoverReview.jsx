const GROUPS = [
  { key: 'files', label: 'Files & folders' },
  { key: 'registryKeys', label: 'Registry keys' },
  { key: 'scheduledTasks', label: 'Scheduled tasks' }
];

/** `scanResult` is { files, registryKeys, scheduledTasks }, each
 * { ok, items }. `selected` is a Set of "group:index" keys — all checked
 * by default is the caller's job (UninstallModal seeds it), not this
 * component's. */
export default function LeftoverReview({ scanResult, selected, onToggle, onConfirm, onSkip }) {
  const totalItems = GROUPS.reduce((sum, g) => sum + (scanResult[g.key]?.items?.length || 0), 0);

  if (totalItems === 0) {
    return (
      <div>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>No leftovers found.</p>
        <button className="btn-primary" onClick={onSkip}>Done</button>
      </div>
    );
  }

  return (
    <div>
      {GROUPS.map(({ key, label }) => {
        const group = scanResult[key];
        if (!group) return null;
        if (!group.ok) {
          return (
            <div key={key} style={{ marginBottom: 16 }}>
              <div style={{ color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 6 }}>{label}</div>
              <div style={{ color: 'var(--warning)', fontSize: 12 }}>Couldn't check this.</div>
            </div>
          );
        }
        if (group.items.length === 0) return null;
        return (
          <div key={key} style={{ marginBottom: 16 }}>
            <div style={{ color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 6 }}>{label}</div>
            {group.items.map((item, i) => {
              const itemKey = `${key}:${i}`;
              return (
                <label key={itemKey} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    className="sleek"
                    checked={selected.has(itemKey)}
                    onChange={() => onToggle(itemKey)}
                  />
                  <span className="font-mono" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {item.path || item.name}
                  </span>
                </label>
              );
            })}
          </div>
        );
      })}
      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button className="btn-primary" onClick={onConfirm}>Remove selected</button>
        <button className="btn-ghost" onClick={onSkip}>Skip</button>
      </div>
    </div>
  );
}
