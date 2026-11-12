// How the page below the hero moves, after armadillo-gs.com. Everything is transform or opacity.
//
//  - Text reveals line by line: headings and paragraphs are split into words, each word knows which line it is on, and when the
//    block scrolls into view the lines rise and fade in one after another (the transitions are in sections.css).
//  - Numbered rows, service entries and groups rise in as they arrive.
//  - The videos drift slowly against the scroll (parallax).
//  - The ticks at the left show where you are and jump between sections.
//  - A ring follows the pointer on fine pointers; it swells over links and carries a label over the list of who we work for.
//
// Reduced motion: nothing is split or animated; the content is simply there.
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

const $$ = (s, r = document) => [...r.querySelectorAll(s)];

// Wrap every word in a span (inline tags such as <a> keep working). Returns the new spans.
function splitWords(el) {
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

function initReveals() {
  const blocks = $$('[data-lines]').map((el) => ({ el, words: splitWords(el) }));
  const measure = () => blocks.forEach((b) => numberLines(b.words));
  document.fonts?.ready.then(measure);
  measure();
  let timer;
  addEventListener('resize', () => {
    clearTimeout(timer);
    timer = setTimeout(measure, 200); // line breaks change with the width
  });

  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        if (e.target.matches('[data-lines]')) numberLines(blocks.find((b) => b.el === e.target).words); // fonts may have changed the breaks
        e.target.classList.add('is-inview');
        io.unobserve(e.target);
      }
    },
    { rootMargin: '0px 0px -12% 0px', threshold: 0.01 },
  );
  $$('[data-lines], .listItem, .service, .group').forEach((el) => io.observe(el));
}

function initParallax() {
  const drift = (sel, amount) =>
    $$(sel).forEach((img) =>
      gsap.fromTo(img, { yPercent: -amount }, { yPercent: amount, ease: 'none', scrollTrigger: { trigger: img.closest('.blk'), start: 'top bottom', end: 'bottom top', scrub: true } }),
    );
  drift('.phil__media video', 5);
  drift('.closing__media video', 7);
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
  addEventListener(
    'pointermove',
    (e) => {
      xTo(e.clientX);
      yTo(e.clientY);
      ring.classList.add('is-on');
      const lab = e.target.closest?.('[data-cursor]');
      const link = e.target.closest?.('a, button, summary');
      ring.classList.toggle('is-label', !!lab);
      ring.classList.toggle('is-link', !lab && !!link);
      if (lab) label.textContent = lab.dataset.cursor;
    },
    { passive: true },
  );
  document.documentElement.addEventListener('pointerleave', () => ring.classList.remove('is-on'));
}

export function initMotion({ reduced }) {
  initTicks();
  if (reduced) return;
  initReveals();
  initParallax();
  initCursor();
}
