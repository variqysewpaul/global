// How the page below the hero moves. Everything here is transform or opacity (nothing that repaints a large area), and each effect
// either runs once as its block arrives or is tied to scroll with `scrub`.
//
//  - Headlines: each word rises out of its own mask, skewing flat as it lands, in a quick cascade.
//  - The approach statement: words light up one after another as you scroll through the paragraph.
//  - Numbered rows: a hairline draws across the top, then the number, title and text rise in.
//  - Rings: concentric rings spread out behind the armed-response section as it passes, like a signal going out.
//  - The promise marquee: a line of large type that drifts on its own, speeds up and leans into the direction you scroll.
//  - A ring that follows the pointer and swells over links (fine pointers only).
//
// Reduced motion: no splitting, no marquee drift, no cursor; the content is simply there.
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

const $$ = (s, r = document) => [...r.querySelectorAll(s)];

// Wrap every word of an element's text (inline tags such as <em> keep working) and return the new spans.
// `mask` puts each word in a clipping box so it can rise out of it.
function splitWords(el, mask) {
  el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
  const out = [];
  const walk = (node) => {
    for (const n of [...node.childNodes]) {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        for (const part of n.textContent.split(/(\s+)/)) {
          if (!part) continue;
          if (/^\s+$/.test(part)) {
            frag.append(' ');
            continue;
          }
          const inner = document.createElement('span');
          inner.className = mask ? 'wi' : 'sw';
          inner.textContent = part;
          inner.setAttribute('aria-hidden', 'true');
          if (mask) {
            const box = document.createElement('span');
            box.className = 'w';
            box.append(inner);
            frag.append(box);
          } else frag.append(inner);
          out.push(inner);
        }
        n.replaceWith(frag);
      } else if (n.nodeType === 1) walk(n);
    }
  };
  walk(el);
  return out;
}

export function initMotion({ lenis, reduced }) {
  if (reduced) return;

  /* ---------------------------------------------------------------- headlines */
  $$('.section__head .title, .approach .title, [data-lines]').forEach((el) => {
    const words = splitWords(el, true);
    gsap.set(words, { yPercent: 115, skewY: 6 });
    ScrollTrigger.create({
      trigger: el,
      start: 'top 88%',
      once: true,
      onEnter: () => gsap.to(words, { yPercent: 0, skewY: 0, duration: 1, ease: 'power3.out', stagger: 0.045 }),
    });
  });

  /* ---------------------------------------------------------------- statement: words light up with the scroll */
  $$('[data-scrub]').forEach((el) => {
    const words = splitWords(el, false);
    gsap.set(words, { opacity: 0.16 });
    gsap.to(words, {
      opacity: 1,
      ease: 'none',
      stagger: 0.12,
      duration: 0.3,
      scrollTrigger: { trigger: el, start: 'top 82%', end: 'bottom 52%', scrub: true },
    });
  });

  /* ---------------------------------------------------------------- numbered rows */
  $$('.rows .row, .values .row').forEach((row) => {
    gsap.to(row, { '--fill': 1, duration: 1.2, ease: 'power2.out', scrollTrigger: { trigger: row, start: 'top 90%', once: true } });
    gsap.from(row.children, { y: 26, opacity: 0, duration: 0.85, ease: 'power2.out', stagger: 0.09, scrollTrigger: { trigger: row, start: 'top 90%', once: true } });
  });

  /* ---------------------------------------------------------------- rings behind the armed-response section */
  const rings = $$('#response .rings i');
  if (rings.length) {
    gsap
      .timeline({ defaults: { ease: 'none' }, scrollTrigger: { trigger: '#response', start: 'top bottom', end: 'bottom top', scrub: true } })
      .fromTo(rings, { scale: 0.35 }, { scale: 1.45, stagger: 0.09, duration: 1 }, 0)
      .fromTo(rings, { opacity: 0 }, { opacity: 1, stagger: 0.09, duration: 0.3 }, 0)
      .to(rings, { opacity: 0, stagger: 0.09, duration: 0.3 }, 0.7);
  }

  /* ---------------------------------------------------------------- promise marquee */
  const marquee = document.querySelector('.marquee');
  if (marquee) {
    const track = marquee.querySelector('.marquee__track');
    const group = track.firstElementChild;
    for (let i = 0; i < 2; i++) track.append(group.cloneNode(true));
    let x = 0;
    let dir = -1;
    let skew = 0;
    let visible = false;
    new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(marquee);
    gsap.ticker.add((_, dtMs) => {
      if (!visible) return;
      const v = lenis.velocity || 0;
      if (Math.abs(v) > 0.4) dir = v > 0 ? -1 : 1; // follows the direction of scrolling
      const w = group.offsetWidth || 1;
      x += dir * (70 + Math.abs(v) * 28) * (dtMs / 1000);
      x = ((x % w) - w) % w;
      skew += (Math.max(-9, Math.min(9, -v * 0.35)) - skew) * 0.12;
      track.style.transform = `translate3d(${x}px,0,0) skewX(${skew}deg)`;
    });
  }

  /* ---------------------------------------------------------------- pointer ring */
  if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
    const ring = document.createElement('div');
    ring.className = 'cursor';
    ring.setAttribute('aria-hidden', 'true');
    document.body.append(ring);
    const xTo = gsap.quickTo(ring, 'x', { duration: 0.4, ease: 'power3' });
    const yTo = gsap.quickTo(ring, 'y', { duration: 0.4, ease: 'power3' });
    window.addEventListener(
      'pointermove',
      (e) => {
        xTo(e.clientX);
        yTo(e.clientY);
        ring.classList.add('is-on');
        ring.classList.toggle('is-link', !!e.target.closest?.('a, button, summary, .row, .audience__card'));
      },
      { passive: true },
    );
    document.documentElement.addEventListener('pointerleave', () => ring.classList.remove('is-on'));
  }
}
