// The scroll story. One GSAP timeline (length 100) is scrubbed by the page scroll (Lenis feeds
// ScrollTrigger). Every camera / world value is tweened on `state`; stage.js renders from it.
//
//   0 ─ 12   Standby      van parked on the forecourt, camera drifts in
//  12 ─ 30   Lift         crane up out of the street into the control-room radar view
//  28 ─ 42   Alarm        perimeter beam trips -> signal -> control room -> dispatch
//  46 ─ 92   Response     van leaves, camera swoops ahead, van drives forward and pulls up side-on
//  92 ─ 100  Hold         suspension settles, call to action
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { state } from './state.js';

export const CHAPTERS = {
  standby: 0,
  control: 27,
  response: 86,
};

export function buildStory() {
  const tl = gsap.timeline({ defaults: { ease: 'none' } });
  // Explicit from-values + no immediate render => safe to scrub in either direction from any scroll position.
  const K = (target, from, to, at, dur, ease = 'power2.inOut') =>
    tl.fromTo(target, from, { ...to, duration: dur, ease, immediateRender: false }, at);

  /* ---------------- camera */
  K(state.cam, { x: -6.4, y: 1.35, z: 7.4 }, { x: -5.5, y: 1.25, z: 6.3 }, 0, 12, 'sine.inOut');
  K(state.look, { x: 0.2, y: 0.8, z: 0.2 }, { x: 0.1, y: 0.78, z: 0.1 }, 0, 12, 'sine.inOut');

  K(state.cam, { x: -5.5, y: 1.25, z: 6.3 }, { x: -8, y: 150, z: 16 }, 12, 18, 'power3.inOut');
  K(state.look, { x: 0.1, y: 0.78, z: 0.1 }, { x: -6, y: 0, z: -45 }, 12, 18, 'power3.inOut');
  K(state, { fov: 34 }, { fov: 42 }, 12, 18);

  K(state.cam, { x: -8, y: 150, z: 16 }, { x: -4, y: 138, z: 8 }, 30, 16, 'sine.inOut');
  K(state.look, { x: -6, y: 0, z: -45 }, { x: -4, y: 0, z: -48 }, 30, 16, 'sine.inOut');

  K(state.cam, { x: -4, y: 138, z: 8 }, { x: -0.2, y: 1.35, z: -100.2 }, 46, 22, 'power2.inOut');
  K(state.look, { x: -4, y: 0, z: -48 }, { x: 2.0, y: 0.95, z: -88.5 }, 46, 22, 'power2.inOut');
  K(state, { fov: 42 }, { fov: 44 }, 46, 22);

  K(state.cam, { x: -0.2, y: 1.35, z: -100.2 }, { x: 0.4, y: 1.3, z: -99 }, 68, 24, 'sine.inOut');
  K(state.look, { x: 2.0, y: 0.95, z: -88.5 }, { x: 2.3, y: 0.9, z: -89.2 }, 68, 24, 'sine.inOut');
  K(state.cam, { x: 0.4, y: 1.3, z: -99 }, { x: 1.0, y: 1.4, z: -98.2 }, 92, 8, 'sine.inOut');

  K(state, { shiftX: 0.16 }, { shiftX: 0 }, 14, 14);
  K(state, { shiftX: 0 }, { shiftX: -0.15 }, 60, 18);

  /* ---------------- world mix */
  K(state, { mapMix: 0 }, { mapMix: 1 }, 14, 14);
  K(state, { mapMix: 1 }, { mapMix: 0 }, 56, 12);
  K(state, { fog: 0.0105 }, { fog: 0.0016 }, 12, 16);
  K(state, { fog: 0.0016 }, { fog: 0.0098 }, 54, 14);

  /* ---------------- control-room sequence */
  K(state, { alarm: 0 }, { alarm: 1 }, 28, 1.6, 'power2.out');
  K(state, { sig1: 0 }, { sig1: 1 }, 30.5, 4, 'power1.inOut');
  K(state, { tower: 0 }, { tower: 1 }, 34, 1.4, 'power2.out');
  K(state, { sig2: 0 }, { sig2: 1 }, 35.6, 4, 'power1.inOut');
  K(state, { headlights: 0 }, { headlights: 1 }, 39.6, 1.6, 'power2.out');
  K(state, { gate: 0 }, { gate: 1 }, 80, 8, 'power2.inOut');
  K(state, { cleared: 0 }, { cleared: 1 }, 90.5, 2, 'power2.out');

  /* ---------------- the van */
  K(state, { carT: 0 }, { carT: 1 }, 46, 46, 'none');

  /* ---------------- photoreal footage (no-op unless frames are installed): fades in over the radar -> street cut,
     then plays the arrival clip frame-by-frame until the van has stopped */
  K(state, { seqMix: 0 }, { seqMix: 1 }, 57, 7, 'power2.inOut');
  K(state, { seq: 0 }, { seq: 1 }, 57, 35, 'none');

  /* ---------------- copy beats */
  const beat = (sel, inAt, outAt) => {
    const el = document.querySelector(sel);
    if (!el) return;
    const kids = el.querySelectorAll('[data-s]');
    if (inAt !== null) {
      K(el, { autoAlpha: 0 }, { autoAlpha: 1 }, inAt, 2.2, 'power1.out');
      if (kids.length) K(kids, { y: 46, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.28 }, inAt, 3, 'power3.out');
    }
    if (outAt !== null) {
      K(el, { autoAlpha: 1 }, { autoAlpha: 0 }, outAt, 2.4, 'power1.in');
      if (kids.length) K(kids, { y: 0, opacity: 1 }, { y: -40, opacity: 0, stagger: 0.12 }, outAt, 2.4, 'power2.in');
    }
  };
  beat('#beat-hero', null, 8);
  beat('#beat-control', 20, 42);
  beat('#beat-feed', 21, 42);
  beat('#beat-dispatch', 46.5, 62);
  beat('#beat-response', 78, null);

  document.querySelectorAll('#feed li').forEach((li) => {
    K(li, { autoAlpha: 0, x: 26 }, { autoAlpha: 1, x: 0 }, parseFloat(li.dataset.at), 1.4, 'power2.out');
  });
  K('.shade--left', { opacity: 1 }, { opacity: 0 }, 60, 6, 'none');
  K('.shade--right', { opacity: 0 }, { opacity: 1 }, 70, 8, 'none');
  K('#scroll-cue', { autoAlpha: 1 }, { autoAlpha: 0 }, 0, 3, 'none');
  K('#status-unit', { autoAlpha: 0 }, { autoAlpha: 1 }, 47, 1.5, 'none');
  K('#status-unit', { autoAlpha: 1 }, { autoAlpha: 0 }, 62, 2, 'none');
  tl.set({}, {}, 100); // pad to exactly 100

  const st = ScrollTrigger.create({
    trigger: '#story',
    start: 'top top',
    end: 'bottom bottom',
    scrub: true,
    animation: tl,
    onUpdate: (self) => {
      state.T = self.progress * 100;
    },
  });

  return {
    tl,
    st,
    // scroll position (px) that lands on timeline time T
    yFor: (T) => st.start + (T / 100) * (st.end - st.start),
  };
}
