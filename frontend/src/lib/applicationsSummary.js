/** The line under the Applications heading.
 *
 * The list owns the search and the filter, the page owns the heading, so the
 * list reports what it is showing (`view`) and this decides the wording. A
 * header that kept saying "210 installed applications" over one visible row
 * was a number that no longer described the screen; while anything narrows
 * the list it says how many of how many are shown, and the size of just
 * those. `count` and `sizeBytes` are the whole list, used when nothing does. */
export function applicationsSummary({ t, view, count, sizeBytes, format }) {
  if (view?.filtered) return t('app.applicationsSummaryFiltered', view.shown, view.total, format(view.bytes));
  return t('app.applicationsSummary', count, format(sizeBytes));
}
