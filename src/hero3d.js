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
import { splitWords } from './motion.js';
import { getMotion } from './spring.js';

// Scroll progress (0-1 down the pinned hero) at which the camera is at the opening shot and at each station. The camera is
// still moving between them; the last station is held to the end, so its copy has time to be read before the page moves on.
const STOPS = [0, 0.18, 0.36, 0.54, 0.72, 0.9];
const NEAR = 0.42; // a chapter's copy is on screen within this share of the distance to the neighbouring station

// scroll progress -> chapter time for the scene (0 opening shot, 1 CCTV, 2 gates, 3 beams, 4 control room)
function toTime(u) {
  for (let i = 0; i < STOPS.length - 1; i++) if (u < STOPS[i + 1]) return i + (u - STOPS[i]) / (STOPS[i + 1] - STOPS[i]);
  return STOPS.length - 1;
}

export function initHero3D({ reduced, lenis }) {
  const hero = document.getElementById('hero');
  // progress() is how far the page's 3D is (0-1); the loading curtain waits for it only when the scene is built up front
  let sceneP = 1;
  const api = { scene: null, progress: () => sceneP };
  if (!hero) return api;

  const conn = navigator.connection || {};
  const lowData = conn.saveData || /(^|-)2g$/.test(conn.effectiveType || '');
  // very small devices (2 cores or less, 2 GB of memory or less) get the poster: the scene would not run well enough to be worth it
  const weak = (navigator.hardwareConcurrency ?? 8) <= 2 || (navigator.deviceMemory ?? 8) <= 2;
  const still = reduced || lowData || weak || new URLSearchParams(location.search).has('still');
  const canvas = document.getElementById('plate');
  const gl = still ? null : fast3DContext(canvas);
  if (!gl) {
    hero.classList.add('hero--still'); // the poster is the whole hero
    return api;
  }

  const lowPower = matchMedia('(max-width: 820px), (pointer: coarse)').matches || (navigator.hardwareConcurrency ?? 8) <= 4;
  if (!lowPower) sceneP = 0; // phones load it later, behind the poster, so the curtain does not wait for it
  const intro = hero.querySelector('#hero-a');
  const chapters = [...hero.querySelectorAll('.chapter')];
  const stepBtns = [...hero.querySelectorAll('.steps button')];
  const n = chapters.length;
  let scene = null;
  let progress = 0;
  let active = -1;
  let st;

  // The chapters' copy is cued by the camera arriving, not scrubbed by the scroll: each chapter's lines rise out of a mask one after
  // another (Motion: staggered, with a spring on the buttons), and leave quickly when the camera moves on. Cued like this the copy
  // moves the same way however fast or slowly the visitor scrolls.
  const EASE = [0.16, 1, 0.3, 1];
  const parts = chapters.map((el) => {
    const words = splitWords(el.querySelector('.title')).map((w) => {
      const mask = document.createElement('span');
      mask.className = 'mask';
      w.replaceWith(mask);
      mask.append(w);
      return w;
    });
    return {
      el,
      eyebrow: el.querySelector('.eyebrow'),
      words,
      lede: el.querySelector('.lede'),
      checks: [...el.querySelectorAll('.checks li')],
      buttons: [...el.querySelectorAll('.cta-row .btn')],
      run: [],
    };
  });
  const hidden = (p) => [p.eyebrow, ...p.words, p.lede, ...p.checks, ...p.buttons].forEach((e) => e && (e.style.opacity = '0'));
  const stop = (p) => {
    p.run.forEach((c) => c.stop?.());
    p.run = [];
  };
  const enter = (p) => {
    stop(p);
    const M = getMotion();
    p.el.style.visibility = 'visible';
    p.el.style.opacity = '1';
    p.el.style.transform = 'none';
    if (!M) return; // (not loaded yet: the copy simply appears)
    const { animate, stagger } = M;
    hidden(p);
    p.run = [
      animate(p.eyebrow, { opacity: [0, 1], y: [14, 0] }, { duration: 0.7, ease: EASE }),
      animate(p.words, { opacity: [0, 1], y: ['115%', '0%'] }, { duration: 1.0, ease: EASE, delay: stagger(0.055, { startDelay: 0.1 }) }),
      animate(p.lede, { opacity: [0, 1], y: [18, 0] }, { duration: 0.9, ease: EASE, delay: 0.38 }),
      ...(p.checks.length ? [animate(p.checks, { opacity: [0, 1], x: [-16, 0] }, { duration: 0.7, ease: EASE, delay: stagger(0.08, { startDelay: 0.55 }) })] : []),
      animate(p.buttons, { opacity: [0, 1], y: [20, 0], scale: [0.9, 1] }, { type: 'spring', stiffness: 360, damping: 22, delay: stagger(0.09, { startDelay: 0.7 }) }),
    ];
  };
  const leave = (p) => {
    stop(p);
    const M = getMotion();
    if (!M) {
      p.el.style.opacity = '0';
      p.el.style.visibility = 'hidden';
      return;
    }
    const { animate } = M;
    p.run = [animate(p.el, { opacity: 0, y: -16 }, { duration: 0.32, ease: [0.4, 0, 1, 1] })];
    p.run[0].then?.(() => {
      if (p.el.style.opacity === '0') {
        p.el.style.visibility = 'hidden';
        p.el.style.transform = 'none';
      }
    });
  };
  let cue;
  const showChapter = (from, to) => {
    clearTimeout(cue);
    if (from >= 0) leave(parts[from]);
    // a beat after arriving, so scrolling quickly through a station does not flash its copy
    if (to >= 0) cue = setTimeout(() => enter(parts[to]), from >= 0 ? 160 : 70);
  };

  const setState = (u) => {
    const t = toTime(u);
    let a = -1;
    chapters.forEach((_, i) => {
      if (Math.abs(t - (i + 1)) < 0.5) a = i;
    });
    if (a !== active) {
      const from = active;
      active = a;
      showChapter(from, a);
      hero.dataset.station = a < 0 ? 'intro' : String(a);
      stepBtns.forEach((b, i) => (i === a ? b.setAttribute('aria-current', 'step') : b.removeAttribute('aria-current')));
    }
  };

  // the intro fades as the camera leaves the first station (scrubbed by the scroll); the chapters are cued, see above
  const tl = gsap.timeline({ defaults: { ease: 'none' } });
  tl.fromTo(intro, { autoAlpha: 1, y: 0 }, { autoAlpha: 0, y: -24, duration: 0.03, ease: 'power1.in', immediateRender: false }, 0.1);
  tl.fromTo('.scroll-cue', { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.03, immediateRender: false }, 0.01);
  // the last station is a push through the middle monitor (the scene whites out as the camera goes in); as it ends, the picture falls
  // away into the dark page behind it
  tl.fromTo('.hero__veil', { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.08, ease: 'power1.in', immediateRender: false }, 0.915);
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
    clearTimeout(cue);
    parts.forEach(stop);
    gsap.set([intro, '.scroll-cue'], { clearProps: 'all' });
  };
  let inView = true;
  const load = () =>
    import('./scene/SecurityScene.js')
      .then(async ({ SecurityScene }) => {
        scene = new SecurityScene(canvas, lowPower, gl);
        api.scene = scene;
        scene.setProgress(toTime(progress));
        scene.setCovered(!inView);
        scene.onProgress = (p) => (sceneP = lowPower ? 1 : p);
        await scene.ready;
        sceneP = 1;
        scene.start();
        canvas.classList.add('is-ready');
        hero.classList.toggle('hero--graded', !!scene.post); // the finishing pass has its own vignette
      })
      .catch((err) => {
        console.error(err);
        sceneP = 1;
        fallBack();
      });
  // On phones the 3D waits until the page itself has loaded and the browser is idle, so it never competes with first paint and
  // the first scroll; the poster is on screen meanwhile.
  if (lowPower) {
    const later = () => ('requestIdleCallback' in window ? requestIdleCallback(load, { timeout: 2500 }) : setTimeout(load, 800));
    if (document.readyState === 'complete') later();
    else addEventListener('load', later, { once: true });
  } else load();

  // if the graphics driver drops the context, show the poster again until it is back
  canvas.addEventListener('webglcontextlost', () => canvas.classList.remove('is-ready'));
  canvas.addEventListener('webglcontextrestored', () => canvas.classList.add('is-ready'));

  // no drawing while the hero is off screen
  new IntersectionObserver(([e]) => {
    inView = e.isIntersecting;
    scene?.setCovered(!inView);
  }, { threshold: 0 }).observe(hero);

  if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
    window.addEventListener('pointermove', (e) => scene?.setPointer((e.clientX / innerWidth) * 2 - 1, -((e.clientY / innerHeight) * 2 - 1)), { passive: true });
  }
  return api;
}
