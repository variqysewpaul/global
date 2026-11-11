// Everything below the hero: navigation, subtle reveals, enquiry pre-selection, click-to-load map, contact form.
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

export function initUI({ lenis, reduced }) {
  /* ---------------------------------------------------------------- navigation (smooth scroll + keyboard focus) */
  $$('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      const target = id.length > 1 ? $(id) : null;
      if (!target) return;
      e.preventDefault();
      // "Enquire about …" links pre-select the matching option in the enquiry form
      if (a.dataset.interest) {
        const sel = $('#interest');
        if (sel) sel.value = a.dataset.interest;
      }
      lenis.scrollTo(target, {
        duration: reduced ? 0.01 : 1.4,
        easing: (t) => 1 - Math.pow(1 - t, 4),
        offset: -72,
        onComplete: () => target.focus?.({ preventScroll: true }),
      });
    });
  });

  /* ---------------------------------------------------------------- menu (phones and tablets) */
  const menu = $('#menu');
  const menuBtn = $('.menu-btn');
  const setMenu = (open) => {
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Menu');
    menu.classList.toggle('is-open', open);
    menu.inert = !open;
    for (const el of [$('main'), $('.footer')]) if (el) el.inert = open;
    document.querySelector('.site-header').classList.toggle('menu-open', open);
    if (open) lenis.stop();
    else lenis.start();
  };
  menuBtn.addEventListener('click', () => setMenu(menuBtn.getAttribute('aria-expanded') !== 'true'));
  // capture: close (and let the page scroll again) before the link's own smooth-scroll handler runs
  menu.addEventListener('click', (e) => e.target.closest('a') && setMenu(false), true);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menu.classList.contains('is-open')) {
      setMenu(false);
      menuBtn.focus();
    }
  });
  matchMedia('(min-width: 1101px)').addEventListener('change', (e) => e.matches && setMenu(false));

  const header = $('.site-header');
  lenis.on('scroll', ({ scroll }) => header.classList.toggle('is-solid', scroll > 24));
  header.classList.toggle('is-solid', window.scrollY > 24);

  /* ---------------------------------------------------------------- reveals: a short fade-up, nothing more */
  ScrollTrigger.batch('.reveal', {
    start: 'top 90%',
    once: true,
    onEnter: (els) =>
      gsap.to(els, { opacity: 1, y: 0, duration: reduced ? 0.01 : 0.8, ease: 'power2.out', stagger: reduced ? 0 : 0.08, overwrite: true }),
  });

  /* ---------------------------------------------------------------- light and transitions: a process line that fills (headings and the rest of the motion are in motion.js) */
  if (!reduced) {
    // (the glows in the dark sections are static: tweening a CSS variable that feeds a big gradient repaints it on every scroll frame)
    // the process line fills once as each step comes into view (no per-scroll work)
    $$('.process li').forEach((li, i) => gsap.to(li, { '--fill': 1, duration: 0.9, delay: i * 0.12, ease: 'power2.out', scrollTrigger: { trigger: li, start: 'top 88%', once: true } }));
  }

  /* ---------------------------------------------------------------- map: loads from Google only when asked */
  {
    const btn = $('#map-load');
    const card = $('#map-card');
    const body = $('#map-body');
    btn?.addEventListener('click', () => {
      const f = document.createElement('iframe');
      f.title = 'Map showing Global Security Solutions, 89 Scott Street, Newcastle Central';
      f.loading = 'lazy';
      f.referrerPolicy = 'no-referrer-when-downgrade';
      f.src = 'https://maps.google.com/maps?q=' + encodeURIComponent('Global Security Solutions, 89 Scott Street, Newcastle, 2940') + '&output=embed';
      card.appendChild(f);
      body.hidden = true;
    });
  }

  /* ---------------------------------------------------------------- contact form (opens the visitor's email app) */
  {
    const form = $('#enquiry');
    const note = $('#form-note');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(form));
      let first = null;
      for (const n of ['name', 'phone']) {
        const el = form.elements[n];
        const bad = !String(d[n] || '').trim();
        el.classList.toggle('invalid', bad);
        el.setAttribute('aria-invalid', String(bad));
        if (bad && !first) first = el;
      }
      if (first) {
        note.textContent = 'Please add your name and a phone number so we can call you back.';
        first.focus();
        return;
      }
      const subject = `Website enquiry — ${d.interest}`;
      const body = `Name: ${d.name}\nPhone: ${d.phone}\nInterested in: ${d.interest}\n\n${d.message || ''}`;
      note.textContent = 'Opening your email app…';
      window.location.href = `mailto:globalsecurity@telkomsa.net?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    });
  }

  const yr = $('#year');
  if (yr) yr.textContent = new Date().getFullYear();
}
