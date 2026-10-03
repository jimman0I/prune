const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

/** The same wording in the app's chosen language, from the platform's own
 * locale data rather than 40 hand-written phrase tables. Null when the
 * platform has no such locale, which sends the caller back to English. */
function localised(timestamp, diff, locale) {
  try {
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    if (diff < MINUTE) return rtf.format(0, 'second');
    if (diff < HOUR) return rtf.format(-Math.floor(diff / MINUTE), 'minute');
    if (diff < DAY) return rtf.format(-Math.floor(diff / HOUR), 'hour');
    if (diff < WEEK) return rtf.format(-Math.floor(diff / DAY), 'day');
    return new Date(timestamp).toLocaleDateString(locale);
  } catch {
    return null;
  }
}

/** "2 hours ago" style relative time for the Dashboard's Recent Activity
 * list. Falls back to a real localized date beyond a week -- "23 days ago"
 * stops being a useful number long before "10 minutes ago" does.
 *
 * English unless a `locale` (a language code such as 'el' or 'pt-BR') is
 * given; the Dashboard passes none and keeps its wording. */
export function formatRelativeTime(timestamp, locale) {
  const diff = Date.now() - timestamp;
  if (locale && locale !== 'en') {
    const text = localised(timestamp, diff, locale);
    if (text) return text;
  }
  if (diff < MINUTE) return 'just now';
  if (diff < HOUR) {
    const n = Math.floor(diff / MINUTE);
    return `${n} minute${n === 1 ? '' : 's'} ago`;
  }
  if (diff < DAY) {
    const n = Math.floor(diff / HOUR);
    return `${n} hour${n === 1 ? '' : 's'} ago`;
  }
  if (diff < WEEK) {
    const n = Math.floor(diff / DAY);
    return `${n} day${n === 1 ? '' : 's'} ago`;
  }
  return new Date(timestamp).toLocaleDateString();
}
