import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchLastAutoClean } from '../lib/api.js';
import { keys } from '../lib/queryClient.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { formatBytes } from '../lib/formatBytes.js';
import { formatRelativeTime } from '../lib/formatRelativeTime.js';

/** "Last automatic clean: 3 hours ago — moved 1.2 GB, freed 0 B".
 *
 * One quiet line about the clean Windows ran while Prune was closed (the
 * "Also run when Prune is closed" task). It says nothing until such a run has
 * happened, and nothing if the report cannot be read. The numbers are the
 * report's: "moved" went into Quarantine (or the Recycle Bin) and is not free
 * yet, "freed" is space that is really back -- the same line Deep Clean draws.
 *
 * Reading the report is also what adds that freed space to the lifetime total
 * (once per run, in the backend), so the total is refreshed from here. */
export default function LastAutoClean({ active = true, className = '' }) {
  const { t, language } = useLanguage();
  const query = useQuery({ queryKey: keys.lastAutoClean, queryFn: () => fetchLastAutoClean(), retry: false });

  // Screens stay mounted once visited: read it again when this one comes back
  // into view, not on first mount, which has just read it.
  const wasActive = useRef(active);
  const { refetch } = query;
  useEffect(() => {
    if (active && !wasActive.current) refetch();
    wasActive.current = active;
  }, [active, refetch]);

  const run = query.data;
  if (!run || !Number.isFinite(run.at)) return null;

  const when = formatRelativeTime(run.at, language);
  const moved = formatBytes(run.movedBytes ?? 0);
  const freed = formatBytes(run.freedBytes ?? 0);
  return (
    <p data-testid="last-auto-clean" className={className || 'text-[12px] text-[color:var(--text-muted)]'}>
      {run.ok === false ? t('backgroundV3.last.errors', when, moved, freed) : t('backgroundV3.last.clean', when, moved, freed)}
    </p>
  );
}
