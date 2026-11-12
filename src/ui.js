// Navigation and small behaviours: smooth in-page links, the header, the full-screen menu, and enquiry subjects on the email links.
// (How the sections move is in motion.js.)
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const MAIL = 'globalsecurity@telkomsa.net';

export function initUI({ lenis, reduced }) {
  const header = $('.site-header');

  /* ---------------------------------------------------------------- full-screen menu */
  const menu = $('#menu');
  const menuBtn = $('.menu-btn');
  const setMenu = (open) => {
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Menu');
    menu.classList.toggle('is-open', open);
    menu.inert = !open;
    for (const el of [$('main'), $('footer')]) if (el) el.inert = open;
    header.classList.toggle('menu-open', open);
    if (open) lenis.stop();
    else lenis.start();
  };
  menuBtn.addEventListener('click', () => setMenu(menuBtn.getAttribute('aria-expanded') !== 'true'));
  // capture: close the menu (and let the page scroll again) before the link's own smooth-scroll handler runs
  menu.addEventListener('click', (e) => e.target.closest('a') && setMenu(false), true);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menu.classList.contains('is-open')) {
      setMenu(false);
      menuBtn.focus();
    }
  });

  /* ---------------------------------------------------------------- in-page links (smooth scroll, then keyboard focus) */
  $$('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      const target = id.length > 1 ? $(id) : null;
      if (!target) return;
      e.preventDefault();
      // "Enquire about …" buttons put that subject on the email links in the contact section
      if (a.dataset.interest) {
        const subject = encodeURIComponent('Website enquiry — ' + a.dataset.interest);
        $$('a[data-mail]:not([data-interest])').forEach((m) => (m.href = `mailto:${MAIL}?subject=${subject}`));
      }
      lenis.scrollTo(target, {
        duration: reduced ? 0.01 : 1.4,
        easing: (t) => 1 - Math.pow(1 - t, 4),
        offset: id === '#hero' ? 0 : -72,
        onComplete: () => target.focus?.({ preventScroll: true }),
      });
    });
  });

  /* ---------------------------------------------------------------- header */
  lenis.on('scroll', ({ scroll }) => header.classList.toggle('is-solid', scroll > 24));
  header.classList.toggle('is-solid', window.scrollY > 24);

  const yr = $('#year');
  if (yr) yr.textContent = new Date().getFullYear();
}
