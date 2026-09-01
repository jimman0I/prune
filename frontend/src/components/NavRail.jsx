const ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="9" rx="1.5"></rect>
      <rect x="14" y="3" width="7" height="5" rx="1.5"></rect>
      <rect x="14" y="12" width="7" height="9" rx="1.5"></rect>
      <rect x="3" y="16" width="7" height="5" rx="1.5"></rect>
    </svg>
  ) },
  { id: 'diskmap', label: 'Disk Map', icon: (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="10" height="10" rx="1.5"></rect>
      <rect x="15" y="3" width="6" height="6" rx="1.5"></rect>
      <rect x="15" y="11" width="6" height="10" rx="1.5"></rect>
      <rect x="3" y="15" width="10" height="6" rx="1.5"></rect>
    </svg>
  ) },
  { id: 'applications', label: 'Applications', icon: (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="4" rx="1"></rect>
      <rect x="3" y="10" width="18" height="4" rx="1"></rect>
      <rect x="3" y="16" width="18" height="4" rx="1"></rect>
    </svg>
  ) },
  { id: 'cleanup', label: 'Smart Cleanup', icon: (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"></polyline>
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
      <path d="M10 11v6"></path>
      <path d="M14 11v6"></path>
      <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"></path>
    </svg>
  ) }
];

export default function NavRail({ screen, onNavigate }) {
  return (
    <nav className="glass-panel flex flex-col items-center gap-2 py-6 w-[72px] shrink-0" aria-label="Main">
      {ITEMS.map((item) => {
        const active = screen === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            aria-current={active ? 'page' : undefined}
            title={item.label}
            className={`w-11 h-11 rounded-xl flex items-center justify-center transition-colors ${
              active ? 'bg-[color:var(--accent-coral-soft)] text-[color:var(--accent-coral)]' : 'text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] hover:bg-white/[0.04]'
            }`}
          >
            {item.icon}
          </button>
        );
      })}
    </nav>
  );
}