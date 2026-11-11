// The top of the page: one pinned stage, one camera. The camera trucks sideways along the boundary of a property at
// night (layers slide at different speeds for depth), pushes in on each service, and the grade shifts colour as the
// subject changes: beams (violet) -> CCTV (blue) -> gate (amber) -> control room (magenta). Everything is drawn as
// vector art in scene.js; there is no video.
//
// Reduced motion / low data (?still): the stage is a single still frame of the opening shot, no pinning.
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { buildScene, SUBJECT, WIDTH, H } from './scene.js';

const STATIONS = ['A', 'B', 'C', 'D'];
// scroll windows (0–1 across the whole hero) in which each chapter's copy is on screen
const WINDOWS = [
  [0.135, 0.255],
  [0.375, 0.495],
  [0.615, 0.735],
  [0.865, 1.0],
];
const GRADE = { intro: '#7a2cff', A: '#8f3cff', B: '#2f6bff', C: '#ff9a3c', D: '#e4348a' };
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export function initJourney({ reduced, lenis }) {
  const hero = document.getElementById('hero');
  const none = { tick() {} };
  if (!hero) return none;

  const conn = navigator.connection || {};
  const lowData = conn.saveData || /(^|-)2g$/.test(conn.effectiveType || '');
  const still = reduced || lowData || new URLSearchParams(location.search).has('still');

  // ---- draw the scene
  const art = buildScene();
  hero.querySelector('.scene__defs-host').innerHTML = art.defs;
  const layerEls = {};
  hero.querySelectorAll('.scene__layer').forEach((el) => {
    el.innerHTML = art[el.dataset.layer];
    el.firstElementChild.style.aspectRatio = `${WIDTH[el.dataset.layer]} / ${H}`;
    layerEls[el.dataset.layer] = el;
  });
  const camEl = hero.querySelector('.scene__cam');
  const gateEl = hero.querySelector('#sc-gate');
  const signalEl = hero.querySelector('#sc-signal-on');
  const nodes = [...hero.querySelectorAll('.node')];
  const sceneEl = hero.querySelector('.scene');

  if (still) {
    hero.classList.add('hero--still');
    sceneEl.dataset.active = 'A';
    nodes.forEach((n) => n.classList.add('on'));
    signalEl?.setAttribute('stroke-dashoffset', '0');
    return none;
  }

  // drifting dust and insects in the light, a few dozen specks
  const dust = hero.querySelector('.journey__dust');
  if (dust) {
    let specks = '';
    for (let i = 0; i < 34; i++) {
      const s = (1 + Math.random() * 2.4).toFixed(1);
      specks += `<i style="--x:${(Math.random() * 100).toFixed(1)}%;--y:${(25 + Math.random() * 60).toFixed(1)}%;--s:${s}px;--o:${(0.25 + Math.random() * 0.55).toFixed(2)};--d:${(9 + Math.random() * 14).toFixed(1)}s;--l:-${(Math.random() * 20).toFixed(1)}s;--dx:${(Math.random() * 90 - 45).toFixed(0)}px"></i>`;
    }
    dust.innerHTML = specks;
  }

  const portrait = () => matchMedia('(max-aspect-ratio: 9/10)').matches;
  const intro = hero.querySelector('#hero-a');
  const chapters = [...hero.querySelectorAll('.chapter')];
  const stepBtns = [...hero.querySelectorAll('.steps button')];
  const grade = hero.querySelector('.journey__grade');
  const cam = { pan: 0, dolly: 1, roll: 0, gateX: 0, sig: 1 };

  let vw = 0;
  let widths = {};
  const measure = () => {
    vw = hero.clientWidth;
    widths = {};
    for (const k in layerEls) widths[k] = layerEls[k].firstElementChild.getBoundingClientRect().width;
  };
  const apply = () => {
    for (const k in layerEls) {
      const max = Math.max(0, widths[k] - vw);
      layerEls[k].style.transform = `translate3d(${(-cam.pan * max).toFixed(1)}px,0,0)`;
    }
    camEl.style.transform = `scale(${cam.dolly.toFixed(4)}) rotate(${cam.roll.toFixed(3)}deg)`;
    gateEl?.setAttribute('transform', `translate(${cam.gateX.toFixed(1)} 0)`);
    signalEl?.setAttribute('stroke-dashoffset', cam.sig.toFixed(4));
  };

  // where the camera has to be (0–1 along the main layer) to frame each station
  const panFor = (st) => {
    const max = Math.max(0, widths.main - vw);
    if (!max) return 0;
    const scale = widths.main / WIDTH.main;
    const anchor = portrait() ? 0.5 : 0.64;
    return clamp((SUBJECT[st].x * scale - vw * anchor) / max, 0, 1);
  };

  let tl;
  let st;
  let active = -1;
  let reached = -1;

  const setState = (u) => {
    let a = -1;
    WINDOWS.forEach(([s0], i) => {
      if (u >= s0 - 0.03) a = i;
    });
    if (a !== active) {
      active = a;
      sceneEl.dataset.active = a < 0 ? 'A' : STATIONS[a];
      hero.dataset.station = a < 0 ? 'intro' : STATIONS[a];
      stepBtns.forEach((b, i) => (i === a ? b.setAttribute('aria-current', 'step') : b.removeAttribute('aria-current')));
    }
    // each device lights up on the trace as the camera reaches it
    const r = u < 0.12 ? 0 : u < 0.36 ? 1 : u < 0.6 ? 2 : u < 0.84 ? 3 : 4;
    if (r !== reached) {
      reached = r;
      nodes.forEach((n, i) => n.classList.toggle('on', i < r));
    }
  };

  const build = () => {
    measure();
    const P = Object.fromEntries(STATIONS.map((s) => [s, panFor(s)]));
    const d = 0.012;
    const drift = (p) => clamp(p + d, 0, 1);
    tl = gsap.timeline({ defaults: { ease: 'none' }, onUpdate: apply });

    // one keyframe track per property: [time, value, ease-into-this-key]
    const track = (prop, keys) => {
      tl.set(cam, { [prop]: keys[0][1] }, 0);
      for (let i = 1; i < keys.length; i++) {
        const [t0, v0] = keys[i - 1];
        const [t1, v1, ease = 'none'] = keys[i];
        tl.fromTo(cam, { [prop]: v0 }, { [prop]: v1, duration: t1 - t0, ease, immediateRender: false }, t0);
      }
    };
    // truck along the boundary, settling on each subject with a slow drift
    track('pan', [[0, P.A], [0.26, drift(P.A)], [0.36, P.B, 'power2.inOut'], [0.5, drift(P.B)], [0.6, P.C, 'power2.inOut'], [0.74, drift(P.C)], [0.84, P.D, 'power2.inOut'], [1, drift(P.D)]]);
    // dolly: a slow push at the start, then a push-in on each subject and a pull back before moving on
    track('dolly', [[0, 1], [0.105, 1.03], [0.15, 1.12, 'power2.inOut'], [0.255, 1.12], [0.3, 1, 'power2.inOut'], [0.395, 1], [0.43, 1.12, 'power2.inOut'], [0.495, 1.12], [0.54, 1, 'power2.inOut'], [0.635, 1], [0.67, 1.13, 'power2.inOut'], [0.735, 1.13], [0.78, 1, 'power2.inOut'], [0.875, 1], [0.91, 1.1, 'power2.inOut'], [1, 1.1]]);
    // a touch of bank on every move, like a gimbal
    track('roll', [[0, 0], [0.27, 0], [0.31, -0.7, 'sine.inOut'], [0.36, 0, 'sine.inOut'], [0.5, 0], [0.55, -0.7, 'sine.inOut'], [0.6, 0, 'sine.inOut'], [0.74, 0], [0.79, -0.7, 'sine.inOut'], [0.84, 0, 'sine.inOut'], [1, 0]]);
    // the gate slides open while it is being explained
    track('gateX', [[0, 0], [0.63, 0], [0.73, 640, 'power2.inOut'], [1, 640]]);
    // the signal trace draws from the first sensor to the control room
    track('sig', [[0, 1], [0.12, 1], [0.84, 0], [1, 0]]);

    // grade: the colour cast follows the subject
    const gradeKeys = [[0, 'intro'], [0.13, 'A'], [0.36, 'B'], [0.6, 'C'], [0.84, 'D']];
    gradeKeys.forEach(([t, name], i) => {
      if (i === 0) {
        gsap.set(grade, { backgroundColor: GRADE[name] });
        return;
      }
      const [t0, n0] = gradeKeys[i - 1];
      tl.fromTo(grade, { backgroundColor: GRADE[n0] }, { backgroundColor: GRADE[name], duration: 0.07, ease: 'none', immediateRender: false }, Math.max(t0 + 0.02, t - 0.05));
    });

    // copy
    tl.fromTo(intro, { autoAlpha: 1, y: 0 }, { autoAlpha: 0, y: -24, duration: 0.025, ease: 'power1.in', immediateRender: false }, 0.085);
    tl.fromTo('.scroll-cue', { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.03, immediateRender: false }, 0.01);
    chapters.forEach((ch, k) => {
      const [a, b] = WINDOWS[k];
      tl.fromTo(ch, { autoAlpha: 0, y: 28 }, { autoAlpha: 1, y: 0, duration: 0.03, ease: 'power2.out', immediateRender: false }, a);
      if (k < chapters.length - 1) tl.fromTo(ch, { autoAlpha: 1, y: 0 }, { autoAlpha: 0, y: -18, duration: 0.025, ease: 'power1.in', immediateRender: false }, b - 0.025);
    });
    tl.set({}, {}, 1);

    st = ScrollTrigger.create({
      trigger: hero,
      start: 'top top',
      end: 'bottom bottom',
      scrub: 0.6,
      animation: tl,
      onUpdate: (self) => setState(self.progress),
    });
    setState(0);
    apply();
  };
  build();

  // rebuild when the width changes (layer sizes, anchor positions)
  let lastW = innerWidth;
  let timer;
  addEventListener('resize', () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (innerWidth === lastW) return;
      lastW = innerWidth;
      const prog = st ? st.progress : 0;
      st?.kill();
      tl?.kill();
      build();
      ScrollTrigger.refresh();
      st.scroll(st.start + prog * (st.end - st.start));
    }, 250);
  });

  stepBtns.forEach((b, i) => {
    b.addEventListener('click', () => {
      const [a, e] = WINDOWS[i];
      const y = st.start + ((a + e) / 2 + (i === 3 ? 0.04 : 0)) * (st.end - st.start);
      lenis.scrollTo(y, { duration: reduced ? 0.01 : 2, easing: (t) => 1 - Math.pow(1 - t, 4) });
    });
  });

  // a soft pointer light across the stage (fine pointers only)
  if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
    const spot = hero.querySelector('.journey__spot');
    const qx = gsap.quickTo(spot, 'x', { duration: 0.9, ease: 'power3' });
    const qy = gsap.quickTo(spot, 'y', { duration: 0.9, ease: 'power3' });
    hero.addEventListener('pointermove', (e) => {
      const r = hero.getBoundingClientRect();
      qx(e.clientX - r.left);
      qy(e.clientY - r.top);
    });
  }

  ScrollTrigger.create({ trigger: hero, start: 'top bottom', end: 'bottom top', onToggle: (s) => hero.classList.toggle('is-live', s.isActive) });

  return { tick() {} };
}
