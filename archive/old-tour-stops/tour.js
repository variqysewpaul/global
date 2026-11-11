// Services tour: the camera moves from the wide house into the part of the property a service protects,
// holds while that service is explained, then returns to the same wide frame. Scrolling back up plays it in
// reverse, so one clip per stop is all the footage needed.
//
// Each stop = one <section class="tour" data-frames="tour-beam"> on the page. Frames are fetched only when
// the visitor scrolls near the section. Two kinds of stop:
//   • push-in clip   (data-frames only, optional data-push): the clip itself travels from wide to close-up.
//   • bridged macro  (data-zoom="ox,oy,tx,ty,scale" + a .tour__wide image): the clip is a close-up that starts
//     on the subject. A focus-pull zoom into the wide still carries the camera there, then dissolves into the clip.
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { createSequence } from './sequence.js';

const GRADE = 'contrast(1.05) saturate(1.08)';

export function initTour({ reduced }) {
  const conn = navigator.connection || {};
  const lowData = conn.saveData || /(^|-)2g$/.test(conn.effectiveType || '');
  const still = reduced || lowData || new URLSearchParams(location.search).has('still');
  const small = matchMedia('(max-width: 800px)').matches;
  const portrait = () => matchMedia('(max-aspect-ratio: 9/10)').matches;
  const stops = [];

  document.querySelectorAll('.tour').forEach((root) => {
    const canvas = root.querySelector('canvas');
    const copy = root.querySelector('.tour__copy');
    const wide = root.querySelector('.tour__wide');
    const name = root.dataset.frames + (small ? '-sm' : '');
    const stop = { p: 0, seq: null, active: false };
    stops.push(stop);

    const load = async () => {
      stop.seq = await createSequence(canvas, { name, ends: still });
      if (!stop.seq) {
        root.classList.add('tour--still', 'tour--nofootage');
        return;
      }
      await stop.seq.ready;
      if (still) {
        root.classList.add('tour--still');
        stop.seq.update(1);
        return;
      }
      stop.seq.update(0);

      const scrub = { trigger: root, start: 'top top', end: 'bottom bottom', scrub: true };
      const tl = gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: scrub });
      const zoom = (root.dataset.zoom || '').split(',').map(Number);
      const bridged = wide && zoom.length === 5 && !portrait();

      if (bridged) {
        // wide still zooms (with a focus-pull blur) onto the subject → dissolves into the macro clip, which plays
        // while the copy is read → dissolves back → the wide still zooms back out.
        const [ox, oy, tx, ty, S] = zoom;
        root.classList.add('tour--bridge');
        gsap.set(wide, { transformOrigin: `${ox * 100}% ${oy * 100}%` });
        tl.fromTo(wide, { scale: 1, xPercent: 0, yPercent: 0, filter: `${GRADE} blur(0px)` }, { scale: S, xPercent: tx * 100, yPercent: ty * 100, filter: `${GRADE} blur(7px)`, duration: 0.2, ease: 'power2.in', immediateRender: false }, 0);
        tl.fromTo(wide, { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.08, immediateRender: false }, 0.17);
        tl.fromTo(canvas, { autoAlpha: 0, filter: `${GRADE} blur(10px)` }, { autoAlpha: 1, filter: `${GRADE} blur(0px)`, duration: 0.08, immediateRender: false }, 0.17);
        tl.to(stop, { p: 1, duration: 0.4 }, 0.22);
        tl.fromTo(copy, { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.07, ease: 'power2.out', immediateRender: false }, 0.3);
        tl.fromTo(copy, { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.05, ease: 'power1.in', immediateRender: false }, 0.6);
        tl.to(stop, { p: 0, duration: 0.12 }, 0.62);
        tl.fromTo(canvas, { autoAlpha: 1, filter: `${GRADE} blur(0px)` }, { autoAlpha: 0, filter: `${GRADE} blur(10px)`, duration: 0.08, immediateRender: false }, 0.74);
        tl.fromTo(wide, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.08, immediateRender: false }, 0.74);
        tl.fromTo(wide, { scale: S, xPercent: tx * 100, yPercent: ty * 100, filter: `${GRADE} blur(7px)` }, { scale: 1, xPercent: 0, yPercent: 0, filter: `${GRADE} blur(0px)`, duration: 0.22, ease: 'power2.out', immediateRender: false }, 0.78);
      } else {
        // push in · hold while the copy is read · pull back out.
        // data-push = the fraction of the clip where the push-in ends. If the clip keeps moving after that (a gate
        // rolling, an LED blinking), those frames play during the hold so the close-up stays alive while it's read.
        const push = parseFloat(root.dataset.push || '1');
        const live = push < 1;
        if (live) {
          tl.to(stop, { p: push, duration: 0.3 }, 0);
          tl.to(stop, { p: 1, duration: 0.32 }, 0.3);
        } else {
          tl.to(stop, { p: 1, duration: 0.42 }, 0);
        }
        tl.to(stop, { p: 0, duration: 0.36 }, 0.64);
        tl.fromTo(copy, { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.07, ease: 'power2.out', immediateRender: false }, live ? 0.26 : 0.36);
        // desktop: the copy clears as the camera pulls back. portrait: the footage only fills the top of the screen, so the copy stays.
        if (!portrait()) tl.fromTo(copy, { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.05, ease: 'power1.in', immediateRender: false }, 0.6);
      }
      tl.set({}, {}, 1);
      ScrollTrigger.refresh();
    };

    if (still) load();
    else ScrollTrigger.create({ trigger: root, start: 'top bottom+=120%', once: true, onEnter: load });
    ScrollTrigger.create({ trigger: root, start: 'top bottom', end: 'bottom top', onToggle: (s) => (stop.active = s.isActive) });
  });

  return {
    tick() {
      for (const s of stops) if (s.active && s.seq) s.seq.update(s.p);
    },
  };
}
