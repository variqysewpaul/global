// The top of the page: a studio-lit 3D scene (see src/scene), with the page's copy following the scroll.
//
// Scrolling moves the camera between four stations: a CCTV camera, a gate motor, a pair of beam sensors and the control-room
// monitors (chapter time t = 0 intro, 1 CCTV, 2 gates, 3 beams, 4 control room). The scene smooths the camera itself, in real time,
// so the movement is continuous, with no frames to jump between.
//
// The 3D code (three.js and the scene, most of the page's JavaScript) loads after the copy. Devices that would draw it in software
// (no usable graphics chip), reduced motion, low data, or a failed build get the still poster instead and never download it.
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { fast3DContext } from './scene/context.js';

// Scroll progress (0-1 down the pinned hero) at which the camera is at the opening shot and at each station. The camera is
// still moving between them; the last station is held to the end, so its copy has time to be read before the page moves on.
const STOPS = [0, 0.22, 0.45, 0.68, 0.9];
const NEAR = 0.42; // a chapter's copy is on screen within this share of the distance to the neighbouring station

// scroll progress -> chapter time for the scene (0 opening shot, 1 CCTV, 2 gates, 3 beams, 4 control room)
function toTime(u) {
  for (let i = 0; i < STOPS.length - 1; i++) if (u < STOPS[i + 1]) return i + (u - STOPS[i]) / (STOPS[i + 1] - STOPS[i]);
  return STOPS.length - 1;
}

export function initHero3D({ reduced, lenis }) {
  const hero = document.getElementById('hero');
  const api = { scene: null };
  if (!hero) return api;

  const conn = navigator.connection || {};
  const lowData = conn.saveData || /(^|-)2g$/.test(conn.effectiveType || '');
  const still = reduced || lowData || new URLSearchParams(location.search).has('still');
  const canvas = document.getElementById('plate');
  const gl = still ? null : fast3DContext(canvas);
  if (!gl) {
    hero.classList.add('hero--still'); // the poster is the whole hero
    return api;
  }

  const lowPower = matchMedia('(max-width: 820px)').matches || (navigator.hardwareConcurrency ?? 8) <= 4;
  const intro = hero.querySelector('#hero-a');
  const chapters = [...hero.querySelectorAll('.chapter')];
  const stepBtns = [...hero.querySelectorAll('.steps button')];
  const n = chapters.length;
  let scene = null;
  let progress = 0;
  let active = -1;
  let st;

  const setState = (u) => {
    const t = toTime(u);
    let a = -1;
    chapters.forEach((_, i) => {
      if (Math.abs(t - (i + 1)) < 0.5) a = i;
    });
    if (a !== active) {
      active = a;
      hero.dataset.station = a < 0 ? 'intro' : String(a);
      stepBtns.forEach((b, i) => (i === a ? b.setAttribute('aria-current', 'step') : b.removeAttribute('aria-current')));
    }
  };

  // copy: the intro fades as the camera leaves the first station; each chapter shows while the camera is at its station
  const tl = gsap.timeline({ defaults: { ease: 'none' } });
  tl.fromTo(intro, { autoAlpha: 1, y: 0 }, { autoAlpha: 0, y: -24, duration: 0.03, ease: 'power1.in', immediateRender: false }, 0.1);
  tl.fromTo('.scroll-cue', { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.03, immediateRender: false }, 0.01);
  chapters.forEach((ch, i) => {
    const s = i + 1;
    const a = STOPS[s] - NEAR * (STOPS[s] - STOPS[s - 1]);
    tl.fromTo(ch, { autoAlpha: 0, y: 28 }, { autoAlpha: 1, y: 0, duration: 0.03, ease: 'power2.out', immediateRender: false }, a);
    if (i < n - 1) {
      const b = STOPS[s] + NEAR * (STOPS[s + 1] - STOPS[s]);
      tl.fromTo(ch, { autoAlpha: 1, y: 0 }, { autoAlpha: 0, y: -18, duration: 0.025, ease: 'power1.in', immediateRender: false }, b - 0.025);
    }
  });
  tl.set({}, {}, 1);

  // the scene smooths the camera itself, so the scroll drives it directly (no second layer of lag)
  st = ScrollTrigger.create({
    trigger: hero,
    start: 'top top',
    end: 'bottom bottom',
    scrub: true,
    animation: tl,
    onUpdate: (self) => {
      progress = self.progress;
      scene?.setProgress(toTime(progress));
      setState(progress);
    },
  });
  setState(0);

  stepBtns.forEach((b, i) => {
    b.addEventListener('click', () => {
      const y = st.start + STOPS[i + 1] * (st.end - st.start);
      lenis.scrollTo(y, { duration: reduced ? 0.01 : 2, easing: (t) => 1 - Math.pow(1 - t, 4) });
    });
  });

  // build the scene behind the poster, then fade it in; on any failure fall back to the poster
  const fallBack = () => {
    hero.classList.add('hero--still');
    st?.kill();
    tl.kill();
    gsap.set([intro, '.scroll-cue'], { clearProps: 'all' });
  };
  import('./scene/SecurityScene.js')
    .then(async ({ SecurityScene }) => {
      scene = new SecurityScene(canvas, lowPower, gl);
      api.scene = scene;
      scene.setProgress(toTime(progress));
      await scene.ready;
      scene.start();
      canvas.classList.add('is-ready');
    })
    .catch((err) => {
      console.error(err);
      fallBack();
    });

  // if the graphics driver drops the context, show the poster again until it is back
  canvas.addEventListener('webglcontextlost', () => canvas.classList.remove('is-ready'));
  canvas.addEventListener('webglcontextrestored', () => canvas.classList.add('is-ready'));

  // no drawing while the hero is off screen
  new IntersectionObserver(([e]) => scene?.setCovered(!e.isIntersecting), { threshold: 0 }).observe(hero);

  if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
    window.addEventListener('pointermove', (e) => scene?.setPointer((e.clientX / innerWidth) * 2 - 1, -((e.clientY / innerHeight) * 2 - 1)), { passive: true });
  }
  return api;
}
