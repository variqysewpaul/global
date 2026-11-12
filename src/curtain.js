// The loading curtain, after armadillo-gs.com: a dark screen with the logo mark in the middle. The mark fills with colour from the
// top down as the page really loads (fonts, the hero's opening picture, and the 3D scene where it is built up front), then rises
// and fades, the curtain fades away, and the header and hero text come in (the entrance transitions are in sections.css, and wait
// for the `is-loaded` class on <html> that this adds).
//
// It never makes anyone wait for long: a minimum of 1.7 s the first time (so the fill can be seen), under a second on repeat visits
// in the same session and with reduced motion. Loading is waited for only up to 3.2 s (after that the opening picture, which is
// the same frame as the 3D scene's, stands in and the scene fades in over it), and nothing holds the curtain longer than 5 s. The page is locked from
// scrolling behind it.
export function initCurtain({ lenis, reduced, progress }) {
  const root = document.documentElement;
  const el = document.getElementById('curtain');
  const finish = () => {
    root.classList.remove('is-loading');
    root.classList.add('is-loaded');
    performance.mark('curtain-lifted'); // for measuring: performance.getEntriesByName('curtain-lifted')
    lenis.start();
    window.dispatchEvent(new Event('gss:loaded'));
  };
  if (!el) {
    finish();
    return Promise.resolve();
  }
  lenis.stop();

  let seen = false;
  try {
    seen = sessionStorage.getItem('gss-seen') === '1';
  } catch {
    /* private mode: treat as a first visit */
  }
  const minMs = reduced ? 400 : seen ? 900 : 1700;
  const sceneMs = 3200; // how long loading is waited for
  const maxMs = 5000;
  const start = performance.now();

  // what has to be ready: the fonts, the hero's opening picture, and the scene (progress() says how far it is; 1 when not waited for)
  const done = { fonts: 0, poster: 0 };
  document.fonts?.ready.then(() => (done.fonts = 1), () => (done.fonts = 1));
  if (!document.fonts) done.fonts = 1;
  // (loaded, not decoded: decode() can wait for a tab that is not being shown, and the picture is decoded when it is first painted)
  const img = new Image();
  img.onload = img.onerror = () => (done.poster = 1);
  img.src = matchMedia('(max-aspect-ratio: 1/1)').matches ? '/poster-tall.webp' : '/poster.webp';
  if (img.complete) done.poster = 1;

  return new Promise((resolve) => {
    let shown = 0;
    let last = start;
    const tick = setInterval(() => {
      const now = performance.now();
      const t = now - start;
      const dt = now - last;
      last = now;
      // after sceneMs, whatever is still loading no longer holds the curtain
      const real = t >= sceneMs ? 1 : 0.15 * done.fonts + 0.25 * done.poster + 0.6 * Math.min(1, progress());
      const target = t >= maxMs ? 1 : Math.min(real, t / minMs);
      shown += (target - shown) * (1 - Math.exp(-dt / 160)); // by elapsed time, so a throttled background tab catches up at once
      if (target >= 1 && shown > 0.995) shown = 1;
      el.style.setProperty('--p', shown.toFixed(3));
      if (shown < 1) return;
      clearInterval(tick);
      try {
        sessionStorage.setItem('gss-seen', '1');
      } catch {
        /* ignore */
      }
      // the fill is complete: the mark rises and fades, then the curtain fades and the page's entrance begins
      el.classList.add('is-done');
      setTimeout(
        () => {
          el.classList.add('is-hide');
          finish();
          setTimeout(() => {
            el.remove();
            resolve();
          }, 700);
        },
        reduced ? 0 : 750,
      );
    }, 40);
  });
}
