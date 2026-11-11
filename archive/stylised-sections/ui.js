// Everything below the hero: navigation, reveals, step cards, tilt, service widgets, coverage radar, contact form.
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
      lenis.scrollTo(target, {
        duration: reduced ? 0.01 : 1.6,
        easing: (t) => 1 - Math.pow(1 - t, 4),
        offset: -72,
        onComplete: () => target.focus?.({ preventScroll: true }),
      });
    });
  });

  const header = $('.site-header');
  const hero = $('#hero');
  lenis.on('scroll', ({ scroll }) => header.classList.toggle('is-solid', scroll > 24));
  header.classList.toggle('is-solid', window.scrollY > 24);
  void hero;

  /* ---------------------------------------------------------------- reveals + 3D step cards */
  ScrollTrigger.batch('.reveal', {
    start: 'top 88%',
    once: true,
    onEnter: (els) => gsap.to(els, { opacity: 1, y: 0, duration: reduced ? 0.01 : 1, ease: 'power3.out', stagger: 0.1, overwrite: true }),
  });

  if (!reduced) {
    $$('.step').forEach((el) => {
      gsap.fromTo(
        el,
        { opacity: 0, rotationY: -16, z: -90, transformPerspective: 1000, transformOrigin: '0% 50%' },
        { opacity: 1, rotationY: 0, z: 0, duration: 1.1, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 86%', once: true } },
      );
    });
    gsap.fromTo('.steps__line', { scaleY: 0 }, { scaleY: 1, ease: 'none', scrollTrigger: { trigger: '.steps', start: 'top 70%', end: 'bottom 62%', scrub: true } });
    gsap.fromTo(
      '.log',
      { opacity: 0, rotationX: 16, y: 40, transformPerspective: 1100, transformOrigin: '50% 100%' },
      { opacity: 1, rotationX: 0, y: 0, duration: 1.2, ease: 'power3.out', scrollTrigger: { trigger: '.log', start: 'top 88%', once: true } },
    );
    $$('.log li').forEach((li, i) => {
      gsap.from(li, { opacity: 0, x: 18, duration: 0.6, delay: 0.5 + i * 0.35, ease: 'power2.out', scrollTrigger: { trigger: '.log', start: 'top 85%', once: true } });
    });
  }

  /* ---------------------------------------------------------------- pointer tilt on cards (fine pointers only) */
  if (!reduced && matchMedia('(hover: hover) and (pointer: fine)').matches) {
    $$('[data-tilt]').forEach((el) => {
      gsap.set(el, { transformPerspective: 900 });
      const rx = gsap.quickTo(el, 'rotationX', { duration: 0.6, ease: 'power3' });
      const ry = gsap.quickTo(el, 'rotationY', { duration: 0.6, ease: 'power3' });
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        ry(((e.clientX - r.left) / r.width - 0.5) * 6);
        rx(-((e.clientY - r.top) / r.height - 0.5) * 6);
      });
      el.addEventListener('pointerleave', () => {
        rx(0);
        ry(0);
      });
    });
  }

  /* ---------------------------------------------------------------- alarm floor plan */
  {
    const wrap = $('#viz-alarm');
    const svg = $('svg', wrap);
    const dot = $('#intruder');
    const perimeter = $('.perimeter', svg);
    const readout = $('#alarm-readout');
    const text = $('span', readout);
    const zones = $$('.zone', svg).map((el) => {
      const c = $('circle', el);
      return { el, name: el.dataset.name, cx: +c.getAttribute('cx'), cy: +c.getAttribute('cy'), r: +c.getAttribute('r') };
    });
    const pt = svg.createSVGPoint();
    let lastMsg = '';
    const evaluate = (x, y) => {
      dot.setAttribute('cx', x);
      dot.setAttribute('cy', y);
      let hit = null;
      for (const z of zones) {
        const on = Math.hypot(x - z.cx, y - z.cy) < z.r;
        z.el.classList.toggle('on', on);
        if (on && !hit) hit = z.name;
      }
      const outside = (x < 14 || x > 406 || y < 14 || y > 256) && x > -2 && x < 422 && y > -2 && y < 272;
      perimeter.classList.toggle('on', outside);
      let msg = 'All zones armed. Move your cursor through the house.';
      if (outside) msg = 'Perimeter beam broken — signal sent to control room';
      else if (hit) msg = `Motion in the ${hit.toLowerCase()} — signal sent to control room`;
      if (msg !== lastMsg) {
        text.textContent = msg;
        readout.classList.toggle('is-hot', outside || !!hit);
        lastMsg = msg;
      }
    };
    const P = [[-12, 236], [40, 236], [112, 198], [120, 150], [105, 80], [210, 100], [312, 80], [330, 150], [342, 196], [330, 236], [430, 236]];
    const pos = { x: P[0][0], y: P[0][1] };
    const walk = gsap.timeline({ repeat: -1, repeatDelay: 1.2, paused: true });
    for (let i = 1; i < P.length; i++) {
      const d = Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]) / 85;
      walk.to(pos, { x: P[i][0], y: P[i][1], duration: d, ease: 'none', onUpdate: () => evaluate(pos.x, pos.y) });
    }
    let hover = false;
    let visible = false;
    const sync = () => (visible && !hover && !reduced ? walk.play() : walk.pause());
    ScrollTrigger.create({ trigger: wrap, start: 'top bottom', end: 'bottom top', onToggle: (s) => { visible = s.isActive; sync(); } });
    const toSvg = (e) => {
      pt.x = e.clientX;
      pt.y = e.clientY;
      return pt.matrixTransform(svg.getScreenCTM().inverse());
    };
    wrap.addEventListener('pointermove', (e) => {
      hover = true;
      sync();
      const p = toSvg(e);
      evaluate(p.x, p.y);
    });
    wrap.addEventListener('pointerleave', () => {
      hover = false;
      sync();
    });
    svg.style.touchAction = 'pan-y';
    evaluate(reduced ? 105 : -30, reduced ? 80 : -30);
  }

  /* ---------------------------------------------------------------- gate */
  {
    const leaf = $('#gate-leaf');
    const rect = $('rect', leaf);
    const bars = $('.bars', leaf);
    const btn = $('#gate-toggle');
    const beam = $('#gate-beam');
    rect.setAttribute('width', 276);
    for (let x = 66; x < 330; x += 13) {
      const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      l.setAttribute('x1', x);
      l.setAttribute('x2', x);
      l.setAttribute('y1', 108);
      l.setAttribute('y2', 174);
      bars.appendChild(l);
    }
    const amount = { v: 0 };
    let open = false;
    const apply = () => {
      leaf.setAttribute('transform', `translate(${amount.v * 232} 0)`);
      beam.style.opacity = 0.25 + 0.5 * amount.v;
    };
    const go = (to) => {
      open = to;
      btn.textContent = open ? 'Close gate' : 'Open gate';
      btn.setAttribute('aria-pressed', String(open));
      gsap.to(amount, { v: open ? 1 : 0, duration: reduced ? 0.01 : 1.8, ease: 'power2.inOut', onUpdate: apply });
    };
    btn.addEventListener('click', () => go(!open));
    apply();
    if (!reduced)
      ScrollTrigger.create({
        trigger: '#viz-gate',
        start: 'top 75%',
        once: true,
        onEnter: () => {
          go(true);
          gsap.delayedCall(3.2, () => open && go(false));
        },
      });
  }

  /* ---------------------------------------------------------------- CCTV */
  {
    const cv = $('#cctv');
    const ctx = cv.getContext('2d');
    const W = cv.width;
    const H = cv.height;
    const timeEl = $('#cam-time');
    const noise = document.createElement('canvas');
    noise.width = noise.height = 128;
    {
      const n = noise.getContext('2d');
      const img = n.createImageData(128, 128);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = Math.random() * 255;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = 22;
      }
      n.putImageData(img, 0, 0);
    }
    const pattern = ctx.createPattern(noise, 'repeat');
    const scan = document.createElement('canvas');
    scan.width = 4;
    scan.height = 4;
    {
      const s = scan.getContext('2d');
      s.fillStyle = 'rgba(0,0,0,0.22)';
      s.fillRect(0, 0, 4, 1);
    }
    const scanPattern = ctx.createPattern(scan, 'repeat');
    const people = [
      { x: -60, y: 0.62, v: 38, s: 1.0, phase: 0 },
      { x: 700, y: 0.78, v: -52, s: 1.45, phase: 2 },
    ];
    const horizon = H * 0.42;

    function person(p, t) {
      const y = horizon + (H - horizon) * p.y;
      const s = p.s * 0.9;
      const swing = Math.sin(t * 6 + p.phase) * 10 * s;
      ctx.strokeStyle = 'rgba(205,224,240,0.9)';
      ctx.fillStyle = 'rgba(205,224,240,0.9)';
      ctx.lineWidth = 7 * s;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(p.x, y - 78 * s, 9 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(p.x, y - 66 * s);
      ctx.lineTo(p.x, y - 30 * s);
      ctx.moveTo(p.x, y - 30 * s);
      ctx.lineTo(p.x - swing, y);
      ctx.moveTo(p.x, y - 30 * s);
      ctx.lineTo(p.x + swing, y);
      ctx.moveTo(p.x, y - 60 * s);
      ctx.lineTo(p.x + swing * 0.8, y - 38 * s);
      ctx.moveTo(p.x, y - 60 * s);
      ctx.lineTo(p.x - swing * 0.8, y - 38 * s);
      ctx.stroke();
      const bw = 56 * s;
      const bh = 96 * s;
      ctx.strokeStyle = '#ff5fae';
      ctx.lineWidth = 2;
      ctx.strokeRect(p.x - bw / 2, y - bh - 6 * s, bw, bh + 8 * s);
      ctx.fillStyle = '#ff5fae';
      ctx.font = '600 11px "JetBrains Mono", monospace';
      ctx.fillText('MOTION', p.x - bw / 2, y - bh - 12 * s);
    }

    function frame(t, dt) {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#0b0f17');
      g.addColorStop(0.42, '#10151f');
      g.addColorStop(0.42, '#141922');
      g.addColorStop(1, '#07080c');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#0a0d13';
      ctx.fillRect(0, horizon - 60, W, 60);
      ctx.fillStyle = '#1b2230';
      ctx.fillRect(110, horizon - 82, 18, 82);
      ctx.fillRect(W - 128, horizon - 82, 18, 82);
      ctx.strokeStyle = 'rgba(160,180,210,0.28)';
      ctx.lineWidth = 2;
      for (let x = 132; x < W - 128; x += 22) {
        ctx.beginPath();
        ctx.moveTo(x, horizon - 68);
        ctx.lineTo(x, horizon);
        ctx.stroke();
      }
      const cone = ctx.createRadialGradient(W * 0.72, horizon + 10, 6, W * 0.72, horizon + 80, 220);
      cone.addColorStop(0, 'rgba(200,220,255,0.22)');
      cone.addColorStop(1, 'rgba(200,220,255,0)');
      ctx.fillStyle = cone;
      ctx.fillRect(0, horizon - 30, W, H);
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 2;
      for (let i = -4; i <= 4; i++) {
        ctx.beginPath();
        ctx.moveTo(W / 2 + i * 26, horizon);
        ctx.lineTo(W / 2 + i * 150, H);
        ctx.stroke();
      }
      for (const p of people) {
        p.x += p.v * dt * (p.s * 0.8);
        if (p.v > 0 && p.x > W + 80) p.x = -80;
        if (p.v < 0 && p.x < -80) p.x = W + 80;
        person(p, t);
      }
      ctx.save();
      ctx.translate(Math.random() * 128, Math.random() * 128);
      ctx.fillStyle = pattern;
      ctx.fillRect(-128, -128, W + 256, H + 256);
      ctx.restore();
      ctx.fillStyle = scanPattern;
      ctx.fillRect(0, 0, W, H);
      const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.85);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, 'rgba(0,0,0,0.55)');
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, W, H);
    }

    let visible = false;
    let acc = 0;
    let sec = 0;
    const base = 14 * 3600 + 14 * 60 + 7;
    const fmt = (n) => String(n).padStart(2, '0');
    const tick = (time, dtMs) => {
      if (!visible || reduced) return;
      acc += dtMs;
      if (acc < 1000 / 24) return;
      const dt = Math.min(acc / 1000, 0.1);
      acc = 0;
      frame(time, dt);
      const s = Math.floor(time) + base;
      if (s !== sec) {
        sec = s;
        timeEl.textContent = `${fmt(Math.floor(s / 3600) % 24)}:${fmt(Math.floor(s / 60) % 60)}:${fmt(s % 60)}`;
      }
    };
    gsap.ticker.add(tick);
    ScrollTrigger.create({ trigger: cv, start: 'top bottom', end: 'bottom top', onToggle: (s) => (visible = s.isActive) });
    frame(0, 0.016);
  }

  /* ---------------------------------------------------------------- coverage radar */
  if (!reduced) {
    gsap.to('.radar .sweep', { rotation: 360, svgOrigin: '0 0', duration: 9, ease: 'none', repeat: -1 });
    $$('.radar .pulse circle').forEach((c, i) => {
      gsap.fromTo(c, { scale: 1, svgOrigin: '0 0', opacity: 0.9 }, { scale: 30, opacity: 0, duration: 4.2, ease: 'power1.out', repeat: -1, delay: i * 2.1 });
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
