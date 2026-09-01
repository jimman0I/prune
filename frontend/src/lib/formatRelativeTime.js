const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

/** "2 hours ago" style relative time for the Dashboard's Recent Activity
 * list. Falls back to a real localized date beyond a week -- "23 days ago"
 * stops being a useful number long before "10 minutes ago" does. */
export function formatRelativeTime(timestamp) {
  const diff = Date.now() - timestamp;
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