import '@fontsource-variable/montserrat';
import '@fontsource-variable/inter';
import '@fontsource-variable/geist-mono';
import '@fontsource/michroma';
import './style.css';
import './sections.css';
import './page.css';

import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import { initHero3D } from './hero3d.js';
import { initUI } from './ui.js';
import { initMotion } from './motion.js';
import { initPage } from './page.js';
import { initVideos } from './video.js';
import { initCurtain } from './curtain.js';

gsap.registerPlugin(ScrollTrigger);
ScrollTrigger.config({ ignoreMobileResize: true }); // the address bar sliding away on a phone is not a resize
history.scrollRestoration = 'manual';

async function boot() {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Lenis smooths the scroll; GSAP's ticker is the single clock for Lenis and ScrollTrigger, and the 3D scene keeps its own frame loop.
  const lenis = new Lenis({ lerp: reduced ? 1 : 0.12, wheelMultiplier: 0.95, smoothWheel: !reduced });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);

  // the curtain goes up first and locks the scroll; it waits for the fonts, the opening picture and (on big screens) the 3D scene
  let hero;
  const loaded = initCurtain({ lenis, reduced, progress: () => (hero ? hero.progress() : 0) });

  hero = initHero3D({ reduced, lenis });
  initUI({ lenis, reduced });
  initPage({ lenis, reduced }); // (before the ticks: the pinned sections must exist before anything measures the page below them)
  initMotion({ reduced });
  initVideos({ reduced });

  document.fonts?.ready.then(() => ScrollTrigger.refresh());
  loaded.then(() => ScrollTrigger.refresh());
  // development only: ?y=7000 jumps to that scroll position once the page is up (pictures can then be taken without a visible window)
  if (import.meta.env.DEV) {
    const y = new URLSearchParams(location.search).get('y');
    if (y !== null)
      loaded.then(() => {
        const go = (d) => (lenis.scrollTo(Number(y) + d, { immediate: true }), ScrollTrigger.update());
        setTimeout(() => go(0), 400);
        setTimeout(() => go(1), 2200); // (a second nudge: the first frame after a jump is not always painted)
        setTimeout(() => go(0), 4200);
      });
  }
  window.__gss = { lenis, hero, gsap, ScrollTrigger }; // handy for tuning in the console
}

boot().catch((err) => {
  console.error(err);
  document.getElementById('hero')?.classList.add('hero--still');
  document.documentElement.classList.remove('is-loading');
  document.documentElement.classList.add('is-loaded');
  document.getElementById('curtain')?.classList.add('is-hide');
});
