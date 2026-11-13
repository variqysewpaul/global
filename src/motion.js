// Small behaviours shared across the page: the hero headline's line-by-line entrance, the section ticks, the pointer ring and the
// springy buttons. (The scroll choreography of the sections below the hero is in page.js.)
//
// Reduced motion: nothing is split or animated; the content is simply there.
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { motionReady } from './spring.js';

const $$ = (s, r = document) => [...r.querySelectorAll(s)];

// Wrap every word in a span (inline tags such as <a> keep working). Returns the new spans.
export function splitWords(el) {
  const out = [];
  const walk = (node) => {
    for (const n of [...node.childNodes]) {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        // (ordinary whitespace only, so a non-breaking space keeps "034 315 4237" together)
        for (const part of n.textContent.split(/([ \t\r\n\f]+)/)) {
          if (!part) continue;
          if (/^[ \t\r\n\f]+$/.test(part)) {
            frag.append(' ');
            continue;
          }
          const w = document.createElement('span');
          w.className = 'sw';
          w.textContent = part;
          frag.append(w);
          out.push(w);
        }
        n.replaceWith(frag);
      } else if (n.nodeType === 1 && !n.classList.contains('sr-only')) walk(n);
    }
  };
  walk(el);
  return out;
}

// Number the lines: words that sit at the same height share a line number (--l), which sets their delay.
function numberLines(words) {
  let line = -1;
  let top = -1e9;
  for (const w of words) {
    const t = w.offsetTop;
    if (Math.abs(t - top) > 3) {
      line++;
      top = t;
    }
    w.style.setProperty('--l', line);
  }
}

// The hero's headline is split into words and each word is given its line number (--l), which sets its delay when the curtain lifts.
function initIntro() {
  const blocks = $$('[data-intro]').map((el) => ({ el, words: splitWords(el) }));
  const measure = () => blocks.forEach((b) => numberLines(b.words));
  document.fonts?.ready.then(measure);
  measure();
  let timer;
  addEventListener('resize', () => {
    clearTimeout(timer);
    timer = setTimeout(measure, 200); // line breaks change with the width
  });
}

function initTicks() {
  const ticks = document.querySelector('.ticks');
  const hero = document.getElementById('hero');
  if (!ticks || !hero) return;
  const links = $$('a', ticks);
  new IntersectionObserver(([e]) => ticks.classList.toggle('is-on', !e.isIntersecting), { threshold: 0 }).observe(hero);
  links.forEach((a, i) => {
    const target = document.querySelector(a.getAttribute('href'));
    if (!target) return;
    ScrollTrigger.create({
      trigger: target,
      start: 'top 55%',
      end: 'bottom 55%',
      onToggle: (self) => {
        if (self.isActive) links.forEach((l, j) => l.classList.toggle('is-active', i === j));
      },
    });
  });
}

function initCursor() {
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  const ring = document.createElement('div');
  ring.className = 'cursor';
  ring.setAttribute('aria-hidden', 'true');
  const label = document.createElement('span');
  ring.append(label);
  document.body.append(ring);
  const xTo = gsap.quickTo(ring, 'x', { duration: 0.4, ease: 'power3' });
  const yTo = gsap.quickTo(ring, 'y', { duration: 0.4, ease: 'power3' });
  const read = (target) => {
    const link = target?.closest?.('a, button, summary');
    const text = !link && target?.closest?.('[data-cursor]')?.dataset.cursor;
    ring.classList.toggle('is-label', !!text);
    ring.classList.toggle('is-link', !text && !!link);
    if (text) label.textContent = text;
  };
  let px = -1;
  let py = -1;
  addEventListener(
    'pointermove',
    (e) => {
      px = e.clientX;
      py = e.clientY;
      xTo(px);
      yTo(py);
      ring.classList.add('is-on');
      read(e.target);
    },
    { passive: true },
  );
  // the page moves under a resting pointer: read what is there now (a frame after the scroll, not on every event)
  let wait = 0;
  addEventListener(
    'scroll',
    () => {
      if (wait || px < 0) return;
      wait = requestAnimationFrame(() => {
        wait = 0;
        read(document.elementFromPoint(px, py));
      });
    },
    { passive: true },
  );
  document.documentElement.addEventListener('pointerleave', () => ring.classList.remove('is-on'));
  // over the hero the ring says "Scroll" until the visitor has scrolled (as on the example)
  const pin = document.querySelector('.hero__pin');
  if (pin) addEventListener('scroll', () => (pin.dataset.cursor = scrollY > 60 ? '' : 'Scroll'), { passive: true });
}

// Buttons lean toward the pointer and press in, on springs (Motion): they have weight, and settle with a little give.
async function initMagnetic() {
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  const { animate } = await motionReady();
  for (const el of $$('.hero .btn, .theater .btn, .scard__cta')) {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      animate(el, { x: (e.clientX - (r.left + r.width / 2)) * 0.22, y: (e.clientY - (r.top + r.height / 2)) * 0.32 }, { type: 'spring', stiffness: 280, damping: 20, mass: 0.6 });
    });
    el.addEventListener('pointerleave', () => animate(el, { x: 0, y: 0, scale: 1 }, { type: 'spring', stiffness: 200, damping: 12, mass: 0.7 }));
    el.addEventListener('pointerdown', () => animate(el, { scale: 0.95 }, { type: 'spring', stiffness: 700, damping: 26 }));
    el.addEventListener('pointerup', () => animate(el, { scale: 1.02 }, { type: 'spring', stiffness: 420, damping: 11 }));
  }
}

export function initMotion({ reduced }) {
  initTicks();
  if (reduced) return;
  initIntro();
  initCursor();
  initMagnetic();
}
