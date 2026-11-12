import '@fontsource-variable/montserrat';
import '@fontsource-variable/inter';
import '@fontsource/michroma';
import '@fontsource/poppins/400.css';
import '@fontsource/poppins/500.css';
import './style.css';
import './sections.css';

import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import { initHero3D } from './hero3d.js';
import { initUI } from './ui.js';
import { initMotion } from './motion.js';
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
  initMotion({ reduced });
  initVideos({ reduced });

  document.fonts?.ready.then(() => ScrollTrigger.refresh());
  loaded.then(() => ScrollTrigger.refresh());
  window.__gss = { lenis, hero, gsap, ScrollTrigger }; // handy for tuning in the console
}

boot().catch((err) => {
  console.error(err);
  document.getElementById('hero')?.classList.add('hero--still');
  document.documentElement.classList.remove('is-loading');
  document.documentElement.classList.add('is-loaded');
  document.getElementById('curtain')?.classList.add('is-hide');
});
