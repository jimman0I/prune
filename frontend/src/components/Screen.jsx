/** One tab's content, kept alive once it has been opened.
 *
 * `display: contents` rather than a plain wrapper div: the parent lays
 * its children out itself, and an extra block box in the middle would
 * change that layout. When the screen isn't the active one it is
 * `display: none`, which costs no layout or paint and stops it receiving
 * mouse events -- it just holds its state until the tab comes back.
 *
 * Nothing is rendered until the screen has actually been visited, so
 * opening the app still only builds the dashboard. The Disk Map's scan,
 * Deep Clean's results and the quarantine list now survive a tab switch
 * instead of being thrown away and rebuilt from scratch. */
export default function Screen({ active, visited, children }) {
  if (!visited) return null;

  return (
    <div style={{ display: active ? 'contents' : 'none' }}>
      {children}
    </div>
  );
}
