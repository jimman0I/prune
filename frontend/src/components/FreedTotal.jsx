import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchStats } from '../lib/api.js';
import { keys } from '../lib/queryClient.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { formatBytes } from '../lib/formatBytes.js';

/** The date the count began, in the language on screen. The platform's own
 * locale data, falling back to the browser's default for a code it lacks. */
function formatSince(timestamp, language) {
  try {
    return new Intl.DateTimeFormat(language, { dateStyle: 'medium' }).format(timestamp);
  } catch {
    return new Date(timestamp).toLocaleDateString();
  }
}

/** "Prune has freed 12.4 GB since 3 Mar 2026." -- a quiet line, not a trophy.
 *
 * Says something only when there is something true to say: nothing counted yet,
 * or a total that could not be read, renders nothing. The total is the
 * backend's (services/stats.js) and counts only space that is really back --
 * deleted bytes, and Quarantine batches once they are permanently deleted. The
 * second sentence says so, so a clean that moved 5 GB into Quarantine does not
 * look like it was forgotten. */
export default function FreedTotal({ active = true }) {
  const { t, language } = useLanguage();
  const query = useQuery({
    queryKey: keys.stats,
    // Inside an arrow so a screen that mounts this without the call defined
    // simply shows nothing.
    queryFn: () => fetchStats(),
    retry: false
  });

  // Screens stay mounted once visited, so a clean or an emptied Quarantine
  // elsewhere does not touch this one. Read it again when the Dashboard comes
  // back into view -- and not on first mount, which has just read it.
  const wasActive = useRef(active);
  const { refetch } = query;
  useEffect(() => {
    if (active && !wasActive.current) refetch();
    wasActive.current = active;
  }, [active, refetch]);

  const stats = query.data;
  if (!stats || !(stats.freedBytes > 0)) return null;

  const size = formatBytes(stats.freedBytes);
  return (
    <p data-testid="freed-total" className="px-6 py-3 border-t border-[color:var(--border-subtle)] text-[12px] text-[color:var(--text-muted)]">
      <span>
        {stats.since
          ? t('dashboardQolV3.stats.freed', size, formatSince(stats.since, language))
          : t('dashboardQolV3.stats.freedNoDate', size)}
      </span>
      {' '}
      <span>{t('dashboardQolV3.stats.note')}</span>
    </p>
  );
}
