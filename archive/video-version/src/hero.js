// The top-of-page transition: the supplied clip, scrubbed by scroll. Camera movement (push-in + drift),
// colour grading (tone, vignette, shade) and the copy beats are all tied to one GSAP timeline.
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { createSequence } from './sequence.js';
import { FRAMES, HERO_P } from './story.js';

export async function initHero({ reduced }) {
  const hero = document.getElementById('hero');
  const plate = document.getElementById('plate');
  const conn = navigator.connection || {};
  const lowData = conn.saveData || /(^|-)2g$/.test(conn.effectiveType || '');
  const still = reduced || lowData || new URLSearchParams(location.search).has('still');
  const small = matchMedia('(max-width: 800px)').matches;

  const seq = await createSequence(plate, { name: FRAMES + (small ? '-sm' : ''), ends: still });
  if (!seq) {
    // no footage installed: a graded, static hero so the page still reads well
    hero.classList.add('hero--still', 'hero--nofootage');
    return { seq: null, tick() {} };
  }
  await seq.ready;

  if (still) {
    // reduced motion / low data: one frame (the opening shot), no scroll-jacking, same copy
    hero.classList.add('hero--still');
    seq.update(0);
    return { seq, tick() {} };
  }

  const state = { p: 0 };
  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom bottom', scrub: true },
  });
  const portrait = () => matchMedia('(max-aspect-ratio: 9/10)').matches;

  // the footage plays over the first 92% of the scroll, then holds on the stop
  tl.to(state, { p: 1, duration: 0.92 }, 0);

  // camera: slow dolly-in with a little drift, like a push on a gimbal
  tl.fromTo(plate, { scale: 1, xPercent: 0, yPercent: 0, transformOrigin: '50% 58%' }, { scale: portrait() ? 1 : 1.03, xPercent: -0.3, yPercent: -0.3, duration: 1 }, 0);

  // grade: cool night -> a warmer, pinker tone as the camera glides along the property
  tl.fromTo('.grade__tone', { opacity: 0 }, { opacity: 0.26, duration: 1 }, 0);
  tl.fromTo('.grade__vignette', { opacity: 0.45 }, { opacity: 0.8, duration: 1 }, 0);

  // copy: opening headline sits low-left under the house, then hands over to the closing line.
  // portrait: the copy sits below the footage, so it stays until the closing copy takes over.
  const P = portrait();
  tl.fromTo('#hero-a', { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.07, ease: 'power1.in' }, P ? 0.72 : 0.4);
  tl.fromTo('#hero-b', { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.1, ease: 'power1.out' }, 0.8);
  tl.fromTo('#hero-b .hero__inner', { yPercent: 14 }, { yPercent: 0, duration: 0.12, ease: 'power2.out' }, 0.8);
  tl.fromTo('#scroll-cue', { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.04 }, 0);
  tl.set({}, {}, 1);

  // subtle pointer parallax on the plate for fine pointers
  if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
    const px = gsap.quickTo('.hero__parallax', 'x', { duration: 1.1, ease: 'power3' });
    const py = gsap.quickTo('.hero__parallax', 'y', { duration: 1.1, ease: 'power3' });
    window.addEventListener('pointermove', (e) => {
      px((e.clientX / innerWidth - 0.5) * -14);
      py((e.clientY / innerHeight - 0.5) * -8);
    });
  }

  ScrollTrigger.create({ trigger: hero, start: 'top bottom', end: 'bottom top', onToggle: (s) => (hero.dataset.active = s.isActive ? '1' : '0') });

  return {
    seq,
    // called every frame from the shared ticker; draws only when the frame index changes
    tick() {
      if (hero.dataset.active !== '0') seq.update(state.p * HERO_P);
    },
  };
}
