import '@fontsource-variable/montserrat';
import '@fontsource-variable/inter';
import '@fontsource/michroma';
import './style.css';

import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import { initJourney } from './journey.js';
import { initUI } from './ui.js';

gsap.registerPlugin(ScrollTrigger);
history.scrollRestoration = 'manual';

async function boot() {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Lenis smooths the scroll; GSAP's ticker is the single clock for Lenis, ScrollTrigger and the footage canvas.
  const lenis = new Lenis({ lerp: reduced ? 1 : 0.085, wheelMultiplier: 0.95, smoothWheel: !reduced });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);

  const journey = initJourney({ reduced, lenis });
  initUI({ lenis, reduced });

  document.fonts?.ready.then(() => ScrollTrigger.refresh());
  window.__gss = { lenis, journey, gsap, ScrollTrigger }; // handy for tuning in the console
}

boot().catch((err) => {
  console.error(err);
  document.getElementById('hero')?.classList.add('hero--still');
});
