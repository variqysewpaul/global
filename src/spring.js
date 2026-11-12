// Motion (the animation library) drives the springs and the staggered entrances. Nothing needs it before the first scroll, so it is
// fetched as its own chunk once the page has finished loading, and everything that uses it works without it (the copy simply
// appears, unanimated) if it has not arrived yet.
let lib = null;
const loaded = new Promise((resolve) => (document.readyState === 'complete' ? resolve() : addEventListener('load', resolve, { once: true }))).then(() => ('requestIdleCallback' in window ? new Promise((r) => requestIdleCallback(r, { timeout: 1500 })) : null)).then(() => import('./motion-lib.js')).then((m) => (lib = m));

/** The Motion module, or null while it is still loading. */
export const getMotion = () => lib;
/** Resolves with the Motion module once it has loaded. */
export const motionReady = () => loaded;
