/** The treemap as a PNG.
 *
 * The map is an SVG whose colours are CSS variables (`var(--bg-base)`) and
 * whose text is styled by the page's stylesheet. Serialised on its own and
 * drawn into a canvas it would have neither, and come out black and
 * fontless. So the SVG is copied, every variable is replaced by its live
 * value, text gets a concrete font, and a solid background is added -- then
 * the standalone copy is what is rasterised. The live drawing is never
 * touched.
 *
 * Split in two for testing: the serialisation (pure DOM, covered by tests)
 * and the rasterisation (canvas, which needs a real browser and is checked
 * by hand). */

const VAR = /var\(\s*(--[\w-]+)\s*(?:,\s*([^)]*?)\s*)?\)/g;

/** Replaces CSS variable references with live values. `getVar(name)` returns
 * the value or a falsy value when undefined; then the reference's own
 * fallback is used, and failing that `currentColor`, so no `var(` survives
 * into an image that has no stylesheet to resolve it. */
export function resolveCssVars(markup, getVar) {
  return String(markup).replace(VAR, (_, name, fallback) => {
    const value = getVar(name);
    if (value) return value;
    return fallback ? fallback : 'currentColor';
  });
}

const MAP_FONT = "Consolas, 'Cascadia Mono', 'Courier New', monospace";

/** A standalone SVG document string for `svg`, plus its pixel size. */
export function serializeMapSvg(svg, { width, height, background, getVar }) {
  const copy = svg.cloneNode(true);
  copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  copy.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
  copy.setAttribute('width', String(width));
  copy.setAttribute('height', String(height));
  if (!copy.getAttribute('viewBox')) copy.setAttribute('viewBox', `0 0 ${width} ${height}`);
  for (const text of copy.querySelectorAll('text')) text.setAttribute('font-family', MAP_FONT);

  const backdrop = svg.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'rect');
  backdrop.setAttribute('width', '100%');
  backdrop.setAttribute('height', '100%');
  backdrop.setAttribute('fill', background);
  copy.insertBefore(backdrop, copy.firstChild);

  const markup = resolveCssVars(new XMLSerializer().serializeToString(copy), getVar);
  return { markup, width, height };
}

/** Rasterises the live map to a PNG Blob at `scale` times its on-screen size
 * (2 by default, so text stays sharp). Rejects with a readable reason. */
export async function svgToPngBlob(svg, { scale = 2 } = {}) {
  const box = svg.getBoundingClientRect();
  const width = Math.max(1, Math.round(box.width));
  const height = Math.max(1, Math.round(box.height));
  const style = getComputedStyle(document.documentElement);
  const getVar = (name) => style.getPropertyValue(name).trim();
  const { markup } = serializeMapSvg(svg, { width, height, background: getVar('--bg-base') || '#09090b', getVar });

  const image = new Image();
  const loaded = new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = () => reject(new Error('The map could not be drawn to an image.'));
  });
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
  await loaded;

  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = height * scale;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('This window cannot create an image.');
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('The image could not be encoded.'))), 'image/png');
  });
}
