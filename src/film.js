// The top of the page: one 10-second clip of a property at night, scrubbed by scroll.
//
// Scrolling down plays the clip forward and scrolling up plays it back, so the footage always moves with the page. It pushes in
// on the gate motor, the CCTV bullet camera and a dome camera, then violet alarm beams switch on across a window and the camera
// pulls back to show the whole house, where the closing message sits. Each chapter's copy is shown while its part of the clip is
// on screen. The footage is shown as it was made: no colour overlay, no grain, only a light shade behind the copy.
//
// Reduced motion / low data / frames missing (?still): the hero is one still frame (the wide shot), no pinning, no frames fetched.
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { createSequence } from './sequence.js';

const FPS = 24;
const FRAMES = 'film';
// scroll windows (0–1 across the whole hero) in which each chapter's copy is on screen: gates, CCTV, beams, control room
const WINDOWS = [
  [0.12, 0.27],
  [0.32, 0.57],
  [0.66, 0.81], // the beams light up at about 0.67
  [0.88, 1.0],
];
// scroll -> seconds of clip: [scroll, seconds, ease into this key]. Slow where there is something to read, quicker between.
const TIME = [
  [0, 0],
  [0.08, 0.45], // the opening shot, with the headline
  [0.12, 0.6],
  [0.26, 1.75], // the gate motor
  [0.3, 2.1],
  [0.56, 5.9], // the bullet camera, then the dome camera
  [0.61, 6.3],
  [0.78, 8.3], // the window, beams switching on
  [0.9, 10, 'power1.inOut'], // pull back to the whole house
  [1, 10],
];

export function initFilm({ reduced, lenis }) {
  const hero = document.getElementById('hero');
  const none = { tick() {} };
  if (!hero) return none;

  const conn = navigator.connection || {};
  const lowData = conn.saveData || /(^|-)2g$/.test(conn.effectiveType || '');
  const still = reduced || lowData || new URLSearchParams(location.search).has('still');
  if (still) {
    hero.classList.add('hero--still'); // the wide-shot poster is the whole hero
    return none;
  }

  const plate = document.getElementById('plate');
  const intro = hero.querySelector('#hero-a');
  const chapters = [...hero.querySelectorAll('.chapter')];
  const stepBtns = [...hero.querySelectorAll('.steps button')];
  const small = matchMedia('(max-width: 800px)').matches;
  const cam = { t: 0 };
  let seq = null;
  let active = -1;
  let st;

  const apply = () => {
    if (!seq) return;
    const last = seq.count - 1;
    seq.update(Math.min(cam.t * FPS, last) / last);
  };

  const setState = (u) => {
    let a = -1;
    WINDOWS.forEach(([s0], i) => {
      if (u >= s0 - 0.03) a = i;
    });
    if (a !== active) {
      active = a;
      hero.dataset.station = a < 0 ? 'intro' : String(a);
      stepBtns.forEach((b, i) => (i === a ? b.setAttribute('aria-current', 'step') : b.removeAttribute('aria-current')));
    }
  };

  // The poster (the clip's first frame) is already on screen, so the canvas stays hidden until the first frame is decoded.
  createSequence(plate, { name: FRAMES + (small ? '-sm' : '') }).then(async (s) => {
    if (!s) {
      hero.classList.add('hero--still'); // frames missing: the poster is the whole hero
      st?.kill();
      return;
    }
    seq = s;
    await s.ready;
    apply();
    plate.classList.add('is-ready');
  });

  const tl = gsap.timeline({ defaults: { ease: 'none' }, onUpdate: apply });
  // one keyframe track: the clip time follows the scroll
  tl.set(cam, { t: TIME[0][1] }, 0);
  for (let i = 1; i < TIME.length; i++) {
    const [t0, v0] = TIME[i - 1];
    const [t1, v1, ease = 'none'] = TIME[i];
    tl.fromTo(cam, { t: v0 }, { t: v1, duration: t1 - t0, ease, immediateRender: false }, t0);
  }

  // copy
  tl.fromTo(intro, { autoAlpha: 1, y: 0 }, { autoAlpha: 0, y: -24, duration: 0.025, ease: 'power1.in', immediateRender: false }, 0.085);
  tl.fromTo('.scroll-cue', { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.03, immediateRender: false }, 0.01);
  chapters.forEach((ch, k) => {
    const [a, b] = WINDOWS[k];
    tl.fromTo(ch, { autoAlpha: 0, y: 28 }, { autoAlpha: 1, y: 0, duration: 0.03, ease: 'power2.out', immediateRender: false }, a);
    if (k < chapters.length - 1) tl.fromTo(ch, { autoAlpha: 1, y: 0 }, { autoAlpha: 0, y: -18, duration: 0.025, ease: 'power1.in', immediateRender: false }, b - 0.025);
  });
  tl.set({}, {}, 1);

  // Lenis already smooths the scroll, so the footage is tied straight to it (no second layer of lag)
  st = ScrollTrigger.create({
    trigger: hero,
    start: 'top top',
    end: 'bottom bottom',
    scrub: true,
    animation: tl,
    onUpdate: (self) => setState(self.progress),
  });
  setState(0);

  stepBtns.forEach((b, i) => {
    b.addEventListener('click', () => {
      const [a, e] = WINDOWS[i];
      const y = st.start + ((a + e) / 2 + (i === 3 ? 0.04 : 0)) * (st.end - st.start);
      lenis.scrollTo(y, { duration: reduced ? 0.01 : 2, easing: (t) => 1 - Math.pow(1 - t, 4) });
    });
  });

  ScrollTrigger.create({ trigger: hero, start: 'top bottom', end: 'bottom top', onToggle: (s) => hero.classList.toggle('is-live', s.isActive) });

  return {
    tick() {},
    get seq() {
      return seq; // handy in the console: __gss.film.seq.stats
    },
  };
}
