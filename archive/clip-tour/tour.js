// Services tour: ONE pinned stage and one scroll timeline.
//
// The page continues the hero's final frame (the whole house at night). For each service the camera zooms into the
// part of the house that does the job (focus-pull blur), dissolves into that service's close-up clip, which plays as
// you scroll while the explanation is on screen, then dissolves back and the camera returns to the full house before
// going to the next one. Scrolling up runs everything in reverse.
//
// Markup contract (see index.html): .tour__wide (the wide still), N × canvas.tour__clip with
//   data-frames  frame-set name in public/frames/
//   data-px/py   where the subject sits in the wide frame (0–1)
//   data-qx/qy   where that subject first appears in the close-up clip (0–1)
//   data-scale   zoom factor from the wide frame to the close-up
// and N × .tour__chapter (the copy), plus .tour__steps buttons.
//
// Reduced motion / low data: the whole tour is hidden; the Services cards below carry the same information.
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { createSequence } from './sequence.js';

const GRADE = 'contrast(1.05) saturate(1.08)';
// the wide still's resting state = where the hero's push-in finished, so the join between hero and tour is seamless
const HOME = { scale: 1.08, xPercent: -0.6, yPercent: -0.8 };

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
  const portrait = matchMedia('(max-aspect-ratio: 9/10)').matches;
  const wide = root.querySelector('.tour__wide');
  const clips = [...root.querySelectorAll('.tour__clip')];
  const chapters = [...root.querySelectorAll('.tour__chapter')];
  const stepBtns = [...root.querySelectorAll('.tour__steps button')];
  const stops = clips.map(() => ({ p: 0, seq: null, loading: false }));

  const load = (i) => {
    const s = stops[i];
    if (!s || s.loading) return;
    s.loading = true;
    createSequence(clips[i], { name: clips[i].dataset.frames + (small ? '-sm' : '') }).then((seq) => {
      s.seq = seq;
      seq?.update(s.p);
    });
  };

  // where the subject lands after zooming the wide frame (origin = centre): translate so point p ends up at q
  const zoomTo = (c) => {
    const px = +c.dataset.px;
    const py = +c.dataset.py;
    const qx = +c.dataset.qx;
    const qy = +c.dataset.qy;
    const s = +c.dataset.scale;
    return { scale: s, xPercent: (qx - 0.5 - (px - 0.5) * s) * 100, yPercent: (qy - 0.5 - (py - 0.5) * s) * 100 };
  };
  const blur = (px) => `${GRADE} blur(${px}px)`;

  /* ---------------------------------------------------------------- timeline (arbitrary units) */
  const SCRUB = 2.4; // scroll length of each clip
  const DIS = 0.45; // dissolve length
  gsap.set(wide, { ...HOME, transformOrigin: '50% 50%' }); // resting state = end of the hero's push-in
  const tl = gsap.timeline({ defaults: { ease: 'none' } });
  const chapterAt = [];
  let c;
  let total;

  // Crossfades keep the outgoing layer solid and fade the incoming one over it (no dip to black).
  // The wide still sits above the clips (z-index); a clip is revealed beneath it, or the wide still fades in over a clip.
  const reveal = (el, at) => {
    tl.fromTo(el, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.01, immediateRender: false }, at);
    tl.fromTo(el, { filter: blur(10) }, { filter: blur(0), duration: DIS, immediateRender: false }, at);
  };
  const fadeIn = (el, at) => tl.fromTo(el, { autoAlpha: 0 }, { autoAlpha: 1, duration: DIS, immediateRender: false }, at);
  const fadeOut = (el, at) => tl.fromTo(el, { autoAlpha: 1 }, { autoAlpha: 0, duration: DIS, immediateRender: false }, at);
  const hide = (el, at) => tl.fromTo(el, { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.01, immediateRender: false }, at);

  if (!portrait) {
    // intro: wide frame → zoom to subject 1 → clip 1 sharpens beneath as the wide frame fades away
    tl.fromTo(wide, { ...HOME, filter: blur(0) }, { ...zoomTo(clips[0]), filter: blur(7), duration: 0.9, ease: 'power2.in', immediateRender: false }, 0);
    reveal(clips[0], 0.75);
    fadeOut(wide, 0.75);
    c = 1.15;
  } else {
    fadeIn(clips[0], 0);
    c = 0.5;
  }

  clips.forEach((clip, k) => {
    chapterAt.push(c);
    tl.to(stops[k], { p: 1, duration: SCRUB }, c);
    tl.fromTo(chapters[k], { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.35, ease: 'power2.out', immediateRender: false }, c + 0.1);
    tl.fromTo(chapters[k], { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.3, ease: 'power1.in', immediateRender: false }, c + SCRUB - 0.3);
    const last = k === clips.length - 1;
    const out = c + SCRUB;
    if (!portrait) {
      // clip → wide frame (zoomed on the subject, blurred) → pull back to the full house
      fadeIn(wide, out);
      hide(clip, out + DIS);
      tl.fromTo(wide, { ...zoomTo(clip), filter: blur(7) }, { ...HOME, filter: blur(0), duration: 0.7, ease: 'power2.out', immediateRender: false }, out + 0.4);
      if (!last) {
        // full house → zoom to the next subject → its clip sharpens beneath as the wide frame fades away
        const next = clips[k + 1];
        tl.fromTo(wide, { ...HOME, filter: blur(0) }, { ...zoomTo(next), filter: blur(7), duration: 0.7, ease: 'power2.in', immediateRender: false }, out + 1.1);
        reveal(next, out + 1.55);
        fadeOut(wide, out + 1.55);
        c = out + 2.0;
      } else {
        total = out + 1.4;
      }
    } else if (!last) {
      fadeIn(clips[k + 1], out);
      hide(clip, out + DIS);
      c = out + 0.7;
    } else {
      total = out + 0.4;
    }
  });
  tl.set({}, {}, total);

  /* ---------------------------------------------------------------- scroll link, stepper, lazy loading */
  const st = ScrollTrigger.create({
    trigger: root,
    start: 'top top',
    end: 'bottom bottom',
    scrub: true,
    animation: tl,
    onUpdate: (self) => {
      const t = self.progress * total;
      if (t > 0.5) load(1);
      if (t > chapterAt[1] - 1.5) load(2);
      let active = -1;
      if (t >= chapterAt[0] - 0.4 && t <= chapterAt[chapterAt.length - 1] + SCRUB) {
        chapterAt.forEach((a, i) => {
          if (t >= a - 0.4) active = i;
        });
      }
      stepBtns.forEach((b, i) => {
        if (i === active) b.setAttribute('aria-current', 'step');
        else b.removeAttribute('aria-current');
      });
    },
  });
  ScrollTrigger.create({ trigger: root, start: 'top bottom+=120%', once: true, onEnter: () => load(0) });

  stepBtns.forEach((b, i) => {
    b.addEventListener('click', () => {
      const y = st.start + ((chapterAt[i] + SCRUB * 0.35) / total) * (st.end - st.start);
      lenis.scrollTo(y, { duration: reduced ? 0.01 : 1.6, easing: (t) => 1 - Math.pow(1 - t, 4) });
    });
  });

  ScrollTrigger.refresh();

  return {
    tick() {
      for (const s of stops) if (s.seq) s.seq.update(s.p);
    },
  };
}
