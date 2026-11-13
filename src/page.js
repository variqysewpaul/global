// The page below the hero, as a film. Each section is a shot, and the scroll is the camera:
//
//   01 Statement   pinned; the words come into focus one after another (a focus pull), the block drifts forward
//   02 Approach    three cards stack up in depth: each one the next covers steps back, shrinks and dims
//   03 Services    pinned; a camera tracks along six cards, each turning to face you as it passes the middle
//   04 Response    pinned; a window opens onto the footage, which dollies back as it fills the screen, then pushes in again
//   05 Clients     big type; a picture follows the pointer between the rows
//   06 About       a radar sweeps the area we cover; a marquee that leans into the scroll
//   07 Contact     a curved panel rises; the number rolls in digit by digit
//
// Under all of it: soft light that drifts at three speeds, a progress line, headlines that lean a little with the scroll speed.
//
// GSAP + ScrollTrigger do the scroll-linked work, Lenis supplies the smooth scroll and its velocity, Motion (see spring.js) does the springs.
// Reduced motion: nothing here runs and the page is simply laid out (page.css has the still version).
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { splitWords } from './motion.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = gsap.utils.clamp;

// every word of a headline gets its own mask, so it can rise out of it
const split = new WeakMap();
function maskWords(el) {
  if (split.has(el)) return split.get(el);
  const words = splitWords(el).map((w) => {
    const mask = document.createElement('span');
    mask.className = 'mask';
    w.replaceWith(mask);
    mask.append(w);
    return w;
  });
  split.set(el, words);
  return words;
}
function maskChars(el) {
  if (split.has(el)) return split.get(el);
  const text = el.textContent;
  el.textContent = '';
  const chars = [...text].map((ch) => {
    const mask = document.createElement('span');
    mask.className = 'mask';
    const c = document.createElement('span');
    c.textContent = ch;
    mask.append(c);
    el.append(mask);
    return c;
  });
  split.set(el, chars);
  return chars;
}
// A label that decodes: its letters start as noise and settle into the text, left to right.
const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#/<>+';
const finals = new WeakMap();
function decode(el, delay = 0, duration = 0.9) {
  const node = [...el.childNodes].reverse().find((n) => n.nodeType === 3 && n.textContent.trim());
  if (!node) return;
  if (!finals.has(el)) finals.set(el, node.textContent);
  const text = finals.get(el);
  const chars = [...text];
  const state = { p: 0 };
  gsap.to(state, {
    p: 1,
    duration,
    delay,
    ease: 'power1.inOut',
    onUpdate: () => {
      const n = Math.floor(state.p * chars.length);
      node.textContent = chars.map((c, i) => (c === ' ' || i < n ? c : GLYPHS[(Math.random() * GLYPHS.length) | 0])).join('');
    },
    onComplete: () => (node.textContent = text),
  });
}
// things inside a pinned section are timed by the section, not by their own position
const triggerFor = (el) => el.closest('.statement, .services, .theater') || el;

export function initPage({ lenis, reduced }) {
  const bar = $('.progress i');
  if (bar) lenis.on('scroll', ({ progress }) => (bar.style.transform = `scaleX(${progress || 0})`));
  if (reduced) return;

  document.documentElement.classList.add('is-armed');
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const mm = gsap.matchMedia();

  mm.add({ wide: '(min-width: 901px)', narrow: '(max-width: 900px)' }, (ctx) => {
    const wide = !!ctx.conditions.wide;
    // the pinned sections first (every trigger made after a pin measures its position with the pin's spacing in it)
    statement();
    services(wide, lenis);
    theater(wide);
    // then everything else, in page order
    atmosphere(fine);
    headings();
    blocks();
    approach();
    clients(fine);
    coverage();
    const stops = [marquee(lenis), lean(lenis)];
    contact();
    return () => stops.forEach((stop) => stop?.());
  });
}

/* ---------------------------------------------------------------- 01 */
const plain = new WeakMap();
function maskStatement(el) {
  if (!plain.has(el)) plain.set(el, splitWords(el));
  return plain.get(el);
}
function statement() {
  const text = $('.statement__text');
  if (!text) return;
  const words = maskStatement(text);
  const leads = $$('.statement__after .lead');
  gsap.set(words, { opacity: 0.12, filter: 'blur(5px)' });
  gsap.set(leads, { opacity: 0, y: 40 });
  const each = 1.7 / Math.max(1, words.length);
  gsap
    .timeline({ defaults: { ease: 'none' }, scrollTrigger: { trigger: '.statement', start: 'top top', end: '+=180%', pin: '.statement__pin', scrub: 0.5, anticipatePin: 1 } })
    .to(words, { opacity: 1, filter: 'blur(0px)', duration: 0.4, stagger: each }, 0)
    .to(text, { scale: 1.025, yPercent: -3, duration: 2.4, transformOrigin: '0% 50%' }, 0)
    .to(leads, { opacity: 1, y: 0, duration: 0.5, stagger: 0.25, ease: 'power2.out' }, 1.75);
}

/* ---------------------------------------------------------------- 02 */
function approach() {
  const cards = $$('.stack .card');
  cards.forEach((card, i) => {
    ScrollTrigger.create({ trigger: card, start: 'top 78%', once: true, onEnter: () => card.classList.add('is-in') });
    ScrollTrigger.create({ trigger: card, start: 'top bottom', end: 'bottom top', onToggle: (s) => card.classList.toggle('is-live', s.isActive) });
    const next = cards[i + 1];
    if (!next) return;
    // the card steps back as the next one comes up over it
    gsap.set(card, { '--veil': 0 });
    gsap.to(card, { scale: 0.92, '--veil': 0.62, ease: 'none', scrollTrigger: { trigger: next, start: 'top 88%', end: 'top 24%', scrub: true } });
  });
}

/* ---------------------------------------------------------------- 03 */
function services(wide, lenis) {
  const pin = $('.services__pin');
  const track = $('.services__track');
  const cards = $$('.scard');
  if (!pin || !track) return;
  if (!wide) {
    // phones and tablets: the cards stack, and each one comes up out of the dark; its drawing runs while it is in the middle
    cards.forEach((c) => {
      gsap.from(c, { y: 70, opacity: 0, rotateX: 10, transformPerspective: 900, duration: 1.1, ease: 'expo.out', scrollTrigger: { trigger: c, start: 'top 90%', once: true } });
      ScrollTrigger.create({ trigger: c, start: 'top 70%', end: 'bottom 30%', onToggle: (s) => c.classList.toggle('is-active', s.isActive) });
    });
    return;
  }
  const count = $('.services__count i');
  const bar = $('.services__bar i');
  const dist = () => Math.max(0, track.scrollWidth - innerWidth);
  const set = cards.map((c) => ({ ry: gsap.quickSetter(c, 'rotationY', 'deg'), z: gsap.quickSetter(c, 'z', 'px'), s: gsap.quickSetter(c, 'scale'), o: gsap.quickSetter(c, 'opacity') }));
  gsap.set(cards, { transformPerspective: 1300 });
  let shown = -1;
  const update = () => {
    const mid = innerWidth / 2;
    let best = 0;
    let bestA = 9;
    cards.forEach((c, i) => {
      const r = c.getBoundingClientRect();
      const d = (r.left + r.width / 2 - mid) / (innerWidth * 0.5); // -1 at the left edge of the screen, 0 in the middle, 1 at the right edge
      const a = Math.min(1.4, Math.abs(d));
      set[i].ry(-d * 26); // each card turns to face the camera as it passes the middle
      set[i].z(-a * 240);
      set[i].s(1 - a * 0.1);
      set[i].o(1 - Math.min(1, a) * 0.55);
      if (a < bestA) {
        bestA = a;
        best = i;
      }
    });
    if (best !== shown) {
      shown = best;
      cards.forEach((c, i) => c.classList.toggle('is-active', i === best));
      if (count) count.textContent = String(best + 1).padStart(2, '0');
    }
  };
  const tween = gsap.to(track, {
    x: () => -dist(),
    ease: 'none',
    onUpdate: update,
    scrollTrigger: {
      trigger: pin,
      start: 'top top',
      end: () => '+=' + dist() * 1.2,
      pin: true,
      scrub: 0.7,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onUpdate: (self) => {
        if (bar) bar.style.transform = `scaleX(${self.progress})`;
        update();
      },
      onRefresh: update,
    },
  });
  update();
  // tabbing to a card that is off screen brings it to the middle
  cards.forEach((c, i) =>
    c.addEventListener('focusin', () => {
      const st = tween.scrollTrigger;
      if (st) lenis.scrollTo(st.start + (i / Math.max(1, cards.length - 1)) * (st.end - st.start), { duration: 1 });
    }),
  );
}

/* ---------------------------------------------------------------- 04 */
function theater(wide) {
  const sec = $('.theater');
  const frame = $('.theater__frame');
  const video = $('video', frame);
  if (!sec || !frame) return;
  const hud = $('.hud', frame);
  const copy = $('.theater__copy');
  const kicker = $('.kicker', copy);
  const title = $('.h1', copy);
  const lead = $('.lead', copy);
  const btn = $('.btn', copy);
  const words = maskWords(title);
  gsap.set(words, { yPercent: 118 });
  gsap.set([kicker, lead, btn], { opacity: 0, y: 30 });
  gsap.set(hud, { opacity: 0 });
  gsap.set(frame, { clipPath: wide ? 'inset(22% 31% 22% 31% round 26px)' : 'inset(20% 7% 26% 7% round 22px)' });
  gsap.set(video, { scale: 1.42 });
  gsap
    .timeline({ defaults: { ease: 'none' }, scrollTrigger: { trigger: sec, start: 'top top', end: '+=280%', pin: '.theater__stage', scrub: 0.6, anticipatePin: 1 } })
    .to(frame, { clipPath: 'inset(0% 0% 0% 0% round 0px)', duration: 1.3, ease: 'power2.inOut' }, 0)
    .to(video, { scale: 1.02, duration: 1.3, ease: 'power2.inOut' }, 0) // the window opens and the camera dollies back
    .to(hud, { opacity: 1, duration: 0.4 }, 1.0)
    .call(() => $$('.hud__l', hud).forEach((l, i) => !l.id && decode(l, i * 0.12, 0.8)), null, 1.0)
    .to(kicker, { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' }, 1.1)
    .to(words, { yPercent: 0, duration: 0.7, stagger: 0.12, ease: 'power3.out' }, 1.15)
    .to(lead, { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' }, 1.7)
    .to(btn, { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' }, 1.85)
    .to(video, { scale: 1.12, duration: 1.4 }, 1.3); // then a slow push-in while the copy is read
  if (video && matchMedia('(hover: hover) and (pointer: fine)').matches) {
    const px = gsap.quickTo(video, 'x', { duration: 1.6, ease: 'power3' });
    const py = gsap.quickTo(video, 'y', { duration: 1.6, ease: 'power3' });
    addEventListener(
      'pointermove',
      (e) => {
        const r = sec.getBoundingClientRect();
        if (r.bottom < 0 || r.top > innerHeight) return;
        px(-(e.clientX / innerWidth - 0.5) * 38);
        py(-(e.clientY / innerHeight - 0.5) * 24);
      },
      { passive: true },
    );
  }
  // the timecode on the footage follows the footage
  const tc = $('#hud-time');
  if (tc && video) {
    const pad = (n) => String(Math.floor(n)).padStart(2, '0');
    video.addEventListener('timeupdate', () => {
      const t = video.currentTime;
      tc.textContent = `${pad(t / 3600)}:${pad((t / 60) % 60)}:${pad(t % 60)}`;
    });
  }
}

/* ---------------------------------------------------------------- the air */
function atmosphere(fine) {
  const drift = (sel, to) => gsap.to(sel, { yPercent: to, ease: 'none', scrollTrigger: { trigger: document.body, start: 'top top', end: 'bottom bottom', scrub: true } });
  drift('.orb--a', -45);
  drift('.orb--b', 38);
  drift('.orb--c', -30);
  if (!fine) return;
  // the light leans away from the pointer, each layer by a different amount
  const moves = [
    ['.orb--a', 46],
    ['.orb--b', -34],
    ['.orb--c', 24],
  ].map(([sel, k]) => ({ k, x: gsap.quickTo(sel, 'x', { duration: 2.2, ease: 'power3' }), y: gsap.quickTo(sel, 'y', { duration: 2.2, ease: 'power3' }) }));
  addEventListener(
    'pointermove',
    (e) => {
      const nx = e.clientX / innerWidth - 0.5;
      const ny = e.clientY / innerHeight - 0.5;
      for (const m of moves) {
        m.x(nx * m.k);
        m.y(ny * m.k);
      }
    },
    { passive: true },
  );
}

// headlines rise out of their masks as they arrive
function headings() {
  for (const el of $$('[data-split]')) {
    if (el.closest('.theater')) continue; // timed by the section
    const words = maskWords(el);
    gsap.set(words, { yPercent: 118 });
    ScrollTrigger.create({ trigger: triggerFor(el), start: el.closest('.services, .statement') ? 'top 62%' : 'top 86%', once: true, onEnter: () => gsap.to(words, { yPercent: 0, duration: 1.2, ease: 'expo.out', stagger: 0.07 }) });
  }
}

// kickers, paragraphs and lists fade up
function blocks() {
  const groups = new Map();
  for (const el of $$('[data-reveal]')) {
    if (el.closest('.theater')) continue;
    const trigger = triggerFor(el);
    const n = groups.get(trigger) ?? 0;
    groups.set(trigger, n + 1);
    gsap.set(el, { opacity: 0, y: 34 });
    ScrollTrigger.create({
      trigger,
      start: trigger === el ? 'top 90%' : 'top 62%',
      once: true,
      onEnter: () => {
        el.classList.add('is-in');
        gsap.to(el, { opacity: 1, y: 0, duration: 1.2, delay: trigger === el ? 0 : n * 0.12, ease: 'expo.out' });
        if (el.classList.contains('kicker')) decode(el, 0.2 + (trigger === el ? 0 : n * 0.12));
      },
    });
  }
}

/* ---------------------------------------------------------------- 05 */
function clients(fine) {
  const list = $('.clients__list');
  const rows = $$('.client');
  if (!list) return;
  // the rows come up one after another; each title rises out of a mask
  rows.forEach((row, i) => {
    const t = $('.client__t', row);
    const words = maskWords(t);
    const rest = [$('.client__n', row), $('.client__p', row), $('.client__arrow', row)];
    gsap.set(words, { yPercent: 118 });
    gsap.set(rest, { opacity: 0, y: 18 });
    ScrollTrigger.create({
      trigger: row,
      start: 'top 90%',
      once: true,
      onEnter: () => {
        gsap.to(words, { yPercent: 0, duration: 1.2, ease: 'expo.out', stagger: 0.06 });
        gsap.to(rest, { opacity: 1, y: 0, duration: 1, ease: 'expo.out', stagger: 0.08, delay: 0.15 });
      },
    });
  });
  if (!fine) return;
  // a picture follows the pointer between the rows, leaning into its motion
  const preview = $('.preview');
  const imgs = $$('img', preview);
  gsap.set(preview, { xPercent: -50, yPercent: -50, scale: 0.85 });
  const xTo = gsap.quickTo(preview, 'x', { duration: 0.7, ease: 'power3' });
  const yTo = gsap.quickTo(preview, 'y', { duration: 0.7, ease: 'power3' });
  const rTo = gsap.quickTo(preview, 'rotation', { duration: 0.9, ease: 'power3' });
  let lastX = 0;
  list.addEventListener(
    'pointermove',
    (e) => {
      const w = preview.offsetWidth;
      xTo(Math.min(innerWidth - w / 2 - 24, e.clientX + w * 0.62));
      yTo(e.clientY);
      rTo(clamp(-12, 12, (e.clientX - lastX) * 0.5));
      lastX = e.clientX;
    },
    { passive: true },
  );
  rows.forEach((row, i) =>
    row.addEventListener('pointerenter', () => {
      imgs.forEach((im, j) => im.classList.toggle('is-on', i === j));
      gsap.to(preview, { opacity: 1, scale: 1, duration: 0.6, ease: 'expo.out', overwrite: 'auto' });
    }),
  );
  list.addEventListener('pointerleave', () => gsap.to(preview, { opacity: 0, scale: 0.85, rotation: 0, duration: 0.45, ease: 'power2.out', overwrite: 'auto' }));
}

/* ---------------------------------------------------------------- 06 */
function coverage() {
  const radar = $('.radar');
  if (!radar) return;
  const once = { trigger: radar, start: 'top 84%', once: true };
  gsap.from('.radar svg', { scale: 0.8, opacity: 0, rotate: -26, transformOrigin: '50% 50%', duration: 2, ease: 'expo.out', scrollTrigger: once });
  gsap.from('.r-rings .r', { scale: 0.35, opacity: 0, svgOrigin: '300 300', duration: 1.8, stagger: 0.18, ease: 'expo.out', scrollTrigger: once });
  gsap.from('.r-labels text', { opacity: 0, y: 10, duration: 1.2, stagger: 0.2, delay: 0.8, ease: 'power2.out', scrollTrigger: once });
}

// a line of the services, endlessly; it speeds up with the scroll, runs backwards when you scroll back, and leans into the speed
function marquee(lenis) {
  const row = $('.marquee__row');
  if (!row) return;
  if (!row.dataset.doubled) {
    row.innerHTML += row.innerHTML;
    row.dataset.doubled = '1';
  }
  const setX = gsap.quickSetter(row, 'x', 'px');
  const setSkew = gsap.quickSetter(row, 'skewX', 'deg');
  let x = 0;
  let boost = 0;
  let skew = 0;
  let seen = true;
  new IntersectionObserver(([e]) => (seen = e.isIntersecting), { rootMargin: '200px' }).observe(row.parentElement);
  const onScroll = ({ velocity }) => (boost = clamp(-40, 40, velocity));
  lenis.on('scroll', onScroll);
  const tick = (_, dt) => {
    if (!seen) return;
    const half = row.scrollWidth / 2;
    x -= (70 + boost * 14) * (dt / 1000);
    if (x <= -half) x += half;
    if (x > 0) x -= half;
    setX(x);
    skew += (clamp(-9, 9, boost * -0.3) - skew) * 0.12;
    setSkew(skew);
    boost *= 0.92;
  };
  gsap.ticker.add(tick);
  return () => {
    gsap.ticker.remove(tick);
    lenis.off?.('scroll', onScroll);
  };
}

/* ---------------------------------------------------------------- 07 */
function contact() {
  const el = $('.contact');
  if (!el) return;
  // the panel's top edge is a curve that flattens as it rises into place
  gsap.fromTo(el, { '--curve': 11 }, { '--curve': 0, ease: 'none', scrollTrigger: { trigger: el, start: 'top 100%', end: 'top 30%', scrub: true } });
  const phone = $('[data-digits]');
  if (phone) {
    const chars = maskChars(phone);
    gsap.set(chars, { yPercent: 112 });
    ScrollTrigger.create({ trigger: phone, start: 'top 92%', once: true, onEnter: () => gsap.to(chars, { yPercent: 0, duration: 1.3, ease: 'expo.out', stagger: 0.055 }) });
  }
  const items = $$('.contact__list li');
  gsap.set(items, { opacity: 0, y: 24 });
  ScrollTrigger.create({ trigger: '.contact__list', start: 'top 92%', once: true, onEnter: () => {
      gsap.to(items, { opacity: 1, y: 0, duration: 1, ease: 'expo.out', stagger: 0.1 });
      $$('.contact__list span').forEach((l, i) => decode(l, 0.15 + i * 0.1, 0.7));
    } });
}

// headlines lean a little into the speed of the scroll, like a camera that is being moved
function lean(lenis) {
  const els = $$('.h1, .h2, .statement__text, .contact__phone');
  const setters = els.map((el) => gsap.quickSetter(el, 'skewY', 'deg'));
  let v = 0;
  let cur = 0;
  const onScroll = ({ velocity }) => (v = velocity);
  lenis.on('scroll', onScroll);
  const tick = () => {
    const target = clamp(-2.4, 2.4, v * 0.05);
    cur += (target - cur) * 0.14;
    if (Math.abs(cur) < 0.01 && Math.abs(target) < 0.01) {
      if (cur !== 0) {
        cur = 0;
        setters.forEach((s) => s(0));
      }
      return;
    }
    setters.forEach((s) => s(cur));
    v *= 0.9;
  };
  gsap.ticker.add(tick);
  return () => {
    gsap.ticker.remove(tick);
    lenis.off?.('scroll', onScroll);
  };
}
