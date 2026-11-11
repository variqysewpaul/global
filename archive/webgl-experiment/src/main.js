import '@fontsource-variable/montserrat';
import '@fontsource-variable/inter';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/700.css';
import './style.css';

import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import { createStage } from './stage.js';
import { createSequence } from './sequence.js';
import { buildStory } from './story.js';
import { initUI } from './ui.js';
import { state } from './state.js';

gsap.registerPlugin(ScrollTrigger);

async function boot() {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Lenis drives smooth scrolling; GSAP's ticker is the single clock for Lenis, ScrollTrigger and WebGL.
  const lenis = new Lenis({ lerp: reduced ? 1 : 0.085, wheelMultiplier: 0.95, smoothWheel: !reduced });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);

  const stage = await createStage(document.getElementById('stage'), { reduced });
  if (!stage) document.documentElement.classList.add('no-webgl');

  // optional photoreal footage layer
  const seq = await createSequence(document.getElementById('seq'));
  if (seq) {
    document.documentElement.classList.add('has-seq');
    await seq.ready;
  }

  const story = buildStory();
  const ui = initUI({ stage, lenis, story, reduced });

  gsap.ticker.add((time, deltaMs) => {
    stage?.update(Math.min(deltaMs / 1000, 0.05), time);
    if (seq) {
      seq.update(state.seq, state.seqMix);
      stage?.setCovered(state.seqMix > 0.995);
    }
    ui.update();
  });

  // reveal: fade the loader, then bring the hero copy in
  const loader = document.getElementById('loader');
  gsap.set('#beat-hero [data-s]', { y: 40, opacity: 0 });
  gsap.to(loader, { autoAlpha: 0, duration: 0.7, delay: 0.25, ease: 'power2.out', onComplete: () => loader.remove() });
  gsap.to('#beat-hero [data-s]', { y: 0, opacity: 1, duration: 1.2, stagger: 0.12, delay: 0.55, ease: 'power3.out', clearProps: 'transform,opacity' });
  gsap.from('.site-header', { yPercent: -100, duration: 0.9, delay: 0.7, ease: 'power3.out' });

  // handy for tuning in the console: __gss.lenis.scrollTo(__gss.story.yFor(86), {immediate:true})
  window.__gss = { lenis, story, stage, state, gsap, seq };
  if (import.meta.env.DEV && stage) import('./previs.js').then((m) => (window.__gss.previs = m.installPrevis({ stage, story, gsap })));
}

boot().catch((err) => {
  console.error(err);
  document.documentElement.classList.add('no-webgl');
  document.getElementById('loader')?.remove();
});
