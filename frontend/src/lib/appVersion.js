/** The version this build was made from (frontend/vite.config.js injects it
 * from the backend's package.json). 'dev' where nothing injected it, which
 * keeps a remembered value tied to "some unversioned build" rather than
 * letting it match every real one. */
export const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';
