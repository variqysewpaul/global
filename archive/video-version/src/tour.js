// Services tour: one pinned stage, one continuous camera move.
//
// A single walkthrough clip (a slow sideways dolly past the gate and beams, the CCTV camera, the gate motor, then the
// indoor beams) is scrubbed by scroll. Each service's copy is shown while its part of the clip is on screen, so the
// footage and the explanation move together. Scrolling up plays it in reverse.
//
// Markup contract (see index.html): one canvas.tour__clip[data-frames], N × .tour__chapter (the copy) and N matching
// .tour__steps buttons. CHAPTERS below gives each chapter's start/end in seconds of the clip (clip length: CLIP_SECONDS).
//
// Reduced motion / low data: the whole tour is hidden; the Services cards below carry the same information.
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { createSequence } from './sequence.js';
import { CLIP_SECONDS, HERO_END, HERO_P, FRAMES } from './story.js';

// [start, end] seconds of the clip during which each chapter's copy is shown: beams, CCTV, gate motor, inside + out.
// The hero has already played 0 → HERO_END of the same clip; the tour carries on from there.
const CHAPTERS = [
  [3.9, 6.6],
  [7.0, 10.2],
  [10.9, 13.6],
  [14.6, 19.4],
];

export function initTour({ reduced, lenis }) {
  const root = document.getElementById('tour');
  const none = { tick() {} };
  if (!root) return none;

  const conn = navigator.connection || {};
  const lowData = conn.saveData || /(^|-)2g$/.test(conn.effectiveType || '');
  const still = reduced || lowData || new URLSearchParams(location.search).has('still');
  if (still) {
    root.hidden = true;
    return none;
  }

  const small = matchMedia('(max-width: 800px)').matches;
  const canvas = root.querySelector('.tour__clip');
  const chapters = [...root.querySelectorAll('.tour__chapter')];
  const stepBtns = [...root.querySelectorAll('.tour__steps button')];
  const state = { p: HERO_P, seq: null, loading: false };

  const load = () => {
    if (state.loading) return;
    state.loading = true;
    createSequence(canvas, { name: FRAMES + (small ? '-sm' : '') }).then((seq) => {
      state.seq = seq;
      seq?.update(state.p);
    });
  };

  const SPAN = CLIP_SECONDS - HERO_END; // seconds of footage the tour scrubs
  const f = (s) => (s - HERO_END) / SPAN; // seconds of clip -> 0–1 along the tour's scroll
  const FADE = 0.012; // copy fade length, as a fraction of the whole scroll
  const tl = gsap.timeline({ defaults: { ease: 'none' } });
  tl.fromTo(state, { p: HERO_P }, { p: 1, duration: 1, immediateRender: false }, 0);
  chapters.forEach((ch, k) => {
    const [a, b] = CHAPTERS[k];
    tl.fromTo(ch, { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: FADE * 1.6, ease: 'power2.out', immediateRender: false }, f(a));
    tl.fromTo(ch, { autoAlpha: 1 }, { autoAlpha: 0, duration: FADE, ease: 'power1.in', immediateRender: false }, f(b) - FADE);
  });
  // slow push on the whole frame for a little extra camera life
  tl.fromTo(canvas, { scale: 1.0 }, { scale: 1.04, duration: 1, immediateRender: false }, 0);

  const st = ScrollTrigger.create({
    trigger: root,
    start: 'top top',
    end: 'bottom bottom',
    scrub: true,
    animation: tl,
    onUpdate: (self) => {
      const t = HERO_END + self.progress * SPAN;
      let active = -1;
      CHAPTERS.forEach(([a], i) => {
        if (t >= a - 0.3) active = i;
      });
      stepBtns.forEach((b, i) => {
        if (i === active) b.setAttribute('aria-current', 'step');
        else b.removeAttribute('aria-current');
      });
    },
  });
  ScrollTrigger.create({ trigger: root, start: 'top bottom+=120%', once: true, onEnter: load });

  stepBtns.forEach((b, i) => {
    b.addEventListener('click', () => {
      const [a, e] = CHAPTERS[i];
      const y = st.start + (f((a + e) / 2)) * (st.end - st.start);
      lenis.scrollTo(y, { duration: reduced ? 0.01 : 1.8, easing: (t) => 1 - Math.pow(1 - t, 4) });
    });
  });

  ScrollTrigger.refresh();

  return {
    tick() {
      if (state.seq) state.seq.update(state.p);
    },
  };
}
