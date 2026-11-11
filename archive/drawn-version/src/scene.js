// The night-time property, drawn as layered vector art with lit materials (no video, no photos). Five layers slide at
// different speeds so a scroll-driven "camera" trucks along the boundary, with depth. All coordinates are in a
// 900-unit-high space; the ground line is at y = 730.
//
// Realism comes from: bump-mapped plaster and brick (SVG lighting filters), metal with specular edges, light sources
// with bloom and volumetric cones, a wet paved ground that mirrors the lights, atmospheric haze between layers,
// depth of field (blurred far/near layers) and anamorphic lens streaks.
//
// Layers, far to near: sky (stars), far (treeline, masts), mid (the house), main (beams, camera, gate, control room),
// fore (out-of-focus grass and light).
export const H = 900;
export const G = 730; // ground line
export const WIDTH = { sky: 1800, far: 2600, mid: 3600, main: 4800, fore: 5600 };
// where each service's subject sits in the main layer (x, y)
export const SUBJECT = {
  A: { x: 880, y: G - 165 }, // perimeter beam
  B: { x: 1930, y: G - 250 }, // CCTV camera
  C: { x: 2760, y: G - 110 }, // gate + motor
  D: { x: 4260, y: G - 150 }, // control room
};

function rng(seed) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}
const f = (n) => Math.round(n * 10) / 10;
const svg = (w, body) => `<svg viewBox="0 0 ${w} ${H}" preserveAspectRatio="xMinYMax slice" aria-hidden="true" focusable="false">${body}</svg>`;
// a light source: soft halo + hot core, added with "screen" so overlapping lights build up like real exposure
const light = (x, y, r, glow, core = '#fff', op = 1) =>
  `<g style="mix-blend-mode:screen"><circle cx="${x}" cy="${y}" r="${f(r * 5)}" fill="url(#${glow})" opacity="${op}"/><circle cx="${x}" cy="${y}" r="${r}" fill="${core}"/></g>`;
// anamorphic lens streak through a bright point
const streak = (x, y, w, glow = '#c46bff', op = 0.55) =>
  `<g style="mix-blend-mode:screen" opacity="${op}"><ellipse cx="${x}" cy="${y}" rx="${w}" ry="2.2" fill="${glow}" filter="url(#sc-blur3)"/><ellipse cx="${x}" cy="${y}" rx="${w * 0.35}" ry="1.2" fill="#fff"/></g>`;

const defs = `
<svg class="scene__defs" width="0" height="0" aria-hidden="true" focusable="false"><defs>
  <!-- surfaces -->
  <linearGradient id="sc-ground-mid" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1a1424"/><stop offset=".4" stop-color="#0e0a15"/><stop offset="1" stop-color="#05040a"/></linearGradient>
  <linearGradient id="sc-ground-main" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b1526" stop-opacity=".35"/><stop offset=".25" stop-color="#120d1a" stop-opacity=".72"/><stop offset="1" stop-color="#05040a" stop-opacity=".96"/></linearGradient>
  <linearGradient id="sc-ground-far" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#150e20"/><stop offset="1" stop-color="#07050b"/></linearGradient>
  <linearGradient id="sc-wallg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2d2639"/><stop offset=".6" stop-color="#1c1627"/><stop offset="1" stop-color="#0f0b16"/></linearGradient>
  <linearGradient id="sc-metal" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#3a3447"/><stop offset=".18" stop-color="#1a1623"/><stop offset=".55" stop-color="#0a0810"/><stop offset=".9" stop-color="#14101c"/><stop offset="1" stop-color="#2c2639"/></linearGradient>
  <linearGradient id="sc-pillar" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#3a3146"/><stop offset=".3" stop-color="#262033"/><stop offset=".78" stop-color="#14101c"/><stop offset="1" stop-color="#0c0912"/></linearGradient>
  <linearGradient id="sc-slat" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#4b3f61"/><stop offset=".25" stop-color="#171220"/><stop offset="1" stop-color="#07060b"/></linearGradient>
  <linearGradient id="sc-camwhite" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fbfcff"/><stop offset=".5" stop-color="#d5d9e4"/><stop offset="1" stop-color="#8a90a2"/></linearGradient>
  <linearGradient id="sc-face-lit" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd9a0" stop-opacity="0"/><stop offset="1" stop-color="#ffd9a0" stop-opacity=".24"/></linearGradient>
  <linearGradient id="sc-facade-up" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1a2038"/><stop offset="1" stop-color="#2a2231"/></linearGradient>
  <linearGradient id="sc-render" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b2a3e"/><stop offset=".7" stop-color="#3a313b"/><stop offset="1" stop-color="#4a3a38"/></linearGradient>
  <linearGradient id="sc-stone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a2330"/><stop offset="1" stop-color="#4d3d3a"/></linearGradient>
  <linearGradient id="sc-ao" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".7"/></linearGradient>
  <linearGradient id="sc-glassglare" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#cfe0ff" stop-opacity="0"/><stop offset=".45" stop-color="#cfe0ff" stop-opacity=".22"/><stop offset=".55" stop-color="#cfe0ff" stop-opacity="0"/></linearGradient>
  <!-- lit glass / interiors -->
  <linearGradient id="sc-win" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff0d0"/><stop offset=".45" stop-color="#ffcb86"/><stop offset="1" stop-color="#e98f45"/></linearGradient>
  <linearGradient id="sc-win-dim" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c7a98a"/><stop offset="1" stop-color="#6e4a37"/></linearGradient>
  <linearGradient id="sc-screen" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a6cdff"/><stop offset="1" stop-color="#3a63c4"/></linearGradient>
  <!-- light -->
  <linearGradient id="sc-cone" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#c8a0ff" stop-opacity=".7"/><stop offset=".55" stop-color="#b57cff" stop-opacity=".2"/><stop offset="1" stop-color="#b57cff" stop-opacity="0"/></linearGradient>
  <linearGradient id="sc-conew" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe2b0" stop-opacity=".7"/><stop offset=".5" stop-color="#ffd9a0" stop-opacity=".2"/><stop offset="1" stop-color="#ffd9a0" stop-opacity="0"/></linearGradient>
  <radialGradient id="sc-glow-warm"><stop offset="0" stop-color="#ffc47a" stop-opacity=".55"/><stop offset=".4" stop-color="#ffb05a" stop-opacity=".16"/><stop offset="1" stop-color="#ffc47a" stop-opacity="0"/></radialGradient>
  <radialGradient id="sc-glow-violet"><stop offset="0" stop-color="#d49bff" stop-opacity=".6"/><stop offset=".4" stop-color="#b06bff" stop-opacity=".18"/><stop offset="1" stop-color="#c46bff" stop-opacity="0"/></radialGradient>
  <radialGradient id="sc-glow-pink"><stop offset="0" stop-color="#ff7fbd" stop-opacity=".6"/><stop offset=".4" stop-color="#ff5fae" stop-opacity=".18"/><stop offset="1" stop-color="#ff5fae" stop-opacity="0"/></radialGradient>
  <radialGradient id="sc-glow-red"><stop offset="0" stop-color="#ff5a5a" stop-opacity=".7"/><stop offset="1" stop-color="#ff3d3d" stop-opacity="0"/></radialGradient>
  <radialGradient id="sc-glow-green"><stop offset="0" stop-color="#7dffb0" stop-opacity=".6"/><stop offset="1" stop-color="#5dff9b" stop-opacity="0"/></radialGradient>
  <radialGradient id="sc-glow-blue"><stop offset="0" stop-color="#8fb8ff" stop-opacity=".6"/><stop offset="1" stop-color="#6fa0ff" stop-opacity="0"/></radialGradient>
  <linearGradient id="sc-haze" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6a3a8c" stop-opacity="0"/><stop offset="1" stop-color="#5a3a86" stop-opacity=".2"/></linearGradient>
  <linearGradient id="sc-reflfade" gradientUnits="userSpaceOnUse" x1="0" y1="${G}" x2="0" y2="${G + 170}"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
  <mask id="sc-refl" maskUnits="userSpaceOnUse" x="0" y="${G}" width="6000" height="190"><rect x="0" y="${G}" width="6000" height="190" fill="url(#sc-reflfade)"/></mask>
  <!-- materials -->
  <pattern id="sc-brick" width="44" height="20" patternUnits="userSpaceOnUse"><rect width="44" height="20" fill="#2d2530"/><path d="M0 .5H44M0 10.5H44M22 .5V10.5M0 10.5V20.5M44 10.5V20.5" stroke="#0a070d" stroke-width="1.6" fill="none"/><rect x="1" y="1" width="20" height="8.4" fill="#4a3b3f" opacity=".35"/><rect x="23" y="11" width="20" height="8.4" fill="#4a3b3f" opacity=".25"/></pattern>
  <filter id="sc-plaster" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
    <feTurbulence type="fractalNoise" baseFrequency=".42" numOctaves="3" seed="5" result="n"/>
    <feDiffuseLighting in="n" surfaceScale="2.4" diffuseConstant=".9" lighting-color="#fff" result="d"><feDistantLight azimuth="235" elevation="58"/></feDiffuseLighting>
    <feComponentTransfer in="d" result="dc"><feFuncR type="linear" slope="1.5" intercept="-.75"/><feFuncG type="linear" slope="1.5" intercept="-.75"/><feFuncB type="linear" slope="1.5" intercept="-.75"/></feComponentTransfer>
    <feComposite in="dc" in2="SourceAlpha" operator="in" result="dl"/>
    <feBlend in="SourceGraphic" in2="dl" mode="overlay"/>
  </filter>
  <filter id="sc-leaf" x="-10%" y="-10%" width="120%" height="120%">
    <feTurbulence type="fractalNoise" baseFrequency=".06" numOctaves="3" seed="8" result="t"/>
    <feDisplacementMap in="SourceGraphic" in2="t" scale="34" xChannelSelector="R" yChannelSelector="G"/>
  </filter>
  <filter id="sc-blur2" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2"/></filter>
  <filter id="sc-blur3" x="-50%" y="-200%" width="200%" height="500%"><feGaussianBlur stdDeviation="3"/></filter>
  <filter id="sc-blur6" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6"/></filter>
  <filter id="sc-blur14" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="14"/></filter>
</defs></svg>`;

/* ------------------------------------------------------------------ sky */
function sky() {
  const r = rng(11);
  let s = '';
  for (let i = 0; i < 140; i++) {
    const x = r() * WIDTH.sky;
    const y = r() * 480;
    const rad = 0.5 + r() * 1.3;
    const tint = ['#fff', '#d7e3ff', '#ffe9d0'][i % 3];
    s += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(rad)}" fill="${tint}" opacity="${f(0.2 + r() * 0.6)}"${i % 9 === 0 ? ` class="twinkle" style="animation-delay:${f(r() * 4)}s"` : ''}/>`;
  }
  // thin high cloud lit by the town glow
  s += `<ellipse cx="520" cy="330" rx="520" ry="30" fill="#7d4f9c" opacity=".12" filter="url(#sc-blur14)"/><ellipse cx="1320" cy="250" rx="420" ry="22" fill="#7d4f9c" opacity=".1" filter="url(#sc-blur14)"/>`;
  return svg(WIDTH.sky, s);
}

/* ------------------------------------------------------------------ far: treeline, masts, town glow */
function far() {
  const r = rng(23);
  const ridge = (base, amp, fill, seed, jag) => {
    const q = rng(seed);
    let d = `M0 ${H}V${base}`;
    for (let x = 0; x <= WIDTH.far; x += jag) d += `L${x} ${f(base - q() * amp - Math.sin(x / 190) * amp * 0.5)}`;
    return `<path d="${d}V${H}Z" fill="${fill}"/>`;
  };
  let lights = '';
  for (let i = 0; i < 40; i++) {
    const x = 60 + r() * (WIDTH.far - 120);
    const y = 592 + r() * 44;
    lights += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(1.2 + r() * 1.4)}" fill="#ffd9a0" opacity="${f(0.35 + r() * 0.5)}"/>`;
  }
  const mast = (x, h) => `
    <g stroke="#241a33" stroke-width="2" fill="none">
      <path d="M${x - 14} 600L${x} ${600 - h}L${x + 14} 600"/>
      <path d="M${x - 10} ${600 - h * 0.25}H${x + 10}M${x - 7} ${600 - h * 0.5}H${x + 7}M${x - 4} ${600 - h * 0.75}H${x + 4}"/>
    </g>
    <g class="blink">${light(x, 600 - h - 4, 3, 'sc-glow-red', '#ff6a6a')}</g>`;
  return svg(
    WIDTH.far,
    `<ellipse cx="1300" cy="640" rx="1400" ry="120" fill="url(#sc-glow-pink)" opacity=".35"/>
     ${ridge(610, 80, '#21152f', 5, 40)}
     ${mast(1480, 230)}${mast(2260, 150)}
     ${ridge(650, 60, '#150e22', 9, 30)}
     <rect x="0" y="560" width="${WIDTH.far}" height="${H - 560}" fill="url(#sc-haze)"/>
     ${lights}
     <rect x="0" y="640" width="${WIDTH.far}" height="${H - 640}" fill="url(#sc-ground-far)"/>`,
  );
}

/* ------------------------------------------------------------------ mid: the house */
function mid() {
  const r = rng(41);
  const tree = (x, y, s, seed) => {
    const q = rng(seed);
    let t = '';
    for (let i = 0; i < 16; i++) t += `<ellipse cx="${f(x + (q() - 0.5) * 140 * s)}" cy="${f(y - 40 * s - q() * 150 * s)}" rx="${f((26 + q() * 38) * s)}" ry="${f((22 + q() * 32) * s)}" fill="#0d0b14"/>`;
    return `<g><rect x="${x - 6 * s}" y="${y - 70 * s}" width="${12 * s}" height="${70 * s}" fill="#0b0910"/><g filter="url(#sc-leaf)">${t}</g>
      <ellipse cx="${x}" cy="${y - 40 * s}" rx="${70 * s}" ry="${42 * s}" fill="url(#sc-glow-warm)" opacity=".5"/></g>`;
  };
  // room interiors for the lit glass: warm back wall, downlights, a sofa or pendant silhouette
  const room = (x, y, w, h, i, dim = false) => {
    const lit = dim ? 'url(#sc-win-dim)' : 'url(#sc-win)';
    const furn =
      i % 2
        ? `<rect x="${f(x + w * 0.12)}" y="${f(y + h * 0.62)}" width="${f(w * 0.5)}" height="${f(h * 0.22)}" rx="5" fill="#2a1710" opacity=".55"/><rect x="${f(x + w * 0.12)}" y="${f(y + h * 0.52)}" width="${f(w * 0.5)}" height="${f(h * 0.12)}" rx="4" fill="#3a2217" opacity=".5"/>`
        : `<circle cx="${f(x + w * 0.62)}" cy="${f(y + h * 0.34)}" r="${f(h * 0.1)}" fill="#fff6e0" opacity=".9"/><path d="M${f(x + w * 0.62)} ${y}V${f(y + h * 0.24)}" stroke="#3a2a22" stroke-width="1.5"/><rect x="${f(x + w * 0.55)}" y="${f(y + h * 0.7)}" width="${f(w * 0.32)}" height="${f(h * 0.3)}" fill="#2a1710" opacity=".45"/>`;
    return `<g class="win" style="--i:${i}">
      <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${lit}" opacity="${f(0.8 + r() * 0.2)}"/>
      ${furn}
      <circle cx="${f(x + w * 0.22)}" cy="${y + 7}" r="2.4" fill="#fff"/><circle cx="${f(x + w * 0.52)}" cy="${y + 7}" r="2.4" fill="#fff"/><circle cx="${f(x + w * 0.82)}" cy="${y + 7}" r="2.4" fill="#fff"/>
      <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#sc-glassglare)"/>
      <rect x="${x - 3}" y="${y - 3}" width="${w + 6}" height="${h + 6}" fill="none" stroke="#0a0810" stroke-width="5"/>
      <path d="M${f(x + w / 2)} ${y}V${y + h}" stroke="#0a0810" stroke-width="4"/>
    </g>`;
  };
  let ribbon = '';
  const segW = 78;
  for (let i = 0; i < 12; i++) ribbon += room(770 + i * segW, 388, segW - 6, 78, i + 6, i % 5 === 3);
  const downlights = Array.from({ length: 9 }, (_, i) => light(700 + i * 130, 336, 2.6, 'sc-glow-warm', '#fff2d2', 0.95)).join('');
  const house = `
    <ellipse cx="1050" cy="${G}" rx="780" ry="70" fill="url(#sc-glow-warm)" opacity=".38"/>
    <!-- ground floor: render + stone return -->
    <rect x="430" y="520" width="1160" height="${G - 520}" fill="url(#sc-render)" filter="url(#sc-plaster)"/>
    <rect x="430" y="380" width="230" height="140" fill="url(#sc-stone)" filter="url(#sc-plaster)"/>
    <rect x="1380" y="560" width="170" height="${G - 560}" fill="#1b1522" filter="url(#sc-plaster)"/>
    <path d="M1380 596H1550M1380 636H1550M1380 676H1550" stroke="#05040a" stroke-opacity=".6" stroke-width="2.4"/>
    <path d="M1380 599H1550M1380 639H1550M1380 679H1550" stroke="#fff" stroke-opacity=".06" stroke-width="1"/>
    <!-- upper volume + slab -->
    <rect x="690" y="330" width="1110" height="190" fill="url(#sc-facade-up)" filter="url(#sc-plaster)"/>
    <rect x="650" y="316" width="1190" height="18" fill="#2a2234"/>
    <path d="M650 334H1840" stroke="#ffcf8c" stroke-opacity=".5" stroke-width="2"/>
    <path d="M650 316H1840" stroke="#fff" stroke-opacity=".12" stroke-width="1.5"/>
    <!-- lit rooms -->
    <rect x="770" y="378" width="936" height="98" fill="#ffb867" opacity=".34" filter="url(#sc-blur14)"/>
    <rect x="490" y="560" width="830" height="120" fill="#ffb867" opacity=".12" filter="url(#sc-blur14)"/>
    ${ribbon}
    ${room(490, 548, 190, 150, 1, true)}${room(740, 548, 220, 150, 3, true)}${room(1020, 548, 300, 150, 5, true)}
    ${downlights}
    <!-- warm light washing the facade from the uplights, contact shadow at the foot -->
    <rect x="430" y="520" width="1160" height="${G - 520}" fill="url(#sc-face-lit)"/>
    <rect x="430" y="${G - 60}" width="1160" height="60" fill="url(#sc-ao)"/>
    <!-- glass balustrade -->
    <rect x="690" y="470" width="1110" height="40" fill="#bcd2ff" opacity=".05"/>
    <path d="M690 470H1800" stroke="#cfe0ff" stroke-opacity=".35" stroke-width="1.5"/>
    <!-- plant beds + uplights -->
    <rect x="420" y="${G - 34}" width="1180" height="34" rx="12" fill="#07060b"/>
    ${[560, 880, 1200, 1500].map((x) => `<path d="M${x} ${G - 30}L${x - 70} ${G - 260}L${x + 70} ${G - 260}Z" fill="url(#sc-conew)" opacity=".5" filter="url(#sc-blur6)"/>${light(x, G - 30, 4, 'sc-glow-warm', '#fff2d2')}`).join('')}`;
  const houseRefl = `<rect x="430" y="380" width="230" height="140" fill="#2a2330"/><rect x="430" y="520" width="1160" height="${G - 520}" fill="#2a2430"/><rect x="690" y="330" width="1110" height="190" fill="#1f2236"/><rect x="770" y="388" width="936" height="78" fill="#ffc27a"/><rect x="490" y="548" width="830" height="150" fill="#ffc27a" opacity=".85"/>${downlights}`;
  const nb = `
    <path d="M2420 ${G}V560L2640 520L2980 548V${G}Z" fill="#14101c" filter="url(#sc-plaster)"/>
    <rect x="2500" y="600" width="70" height="46" fill="url(#sc-win-dim)" opacity=".7"/>`;
  return svg(
    WIDTH.mid,
    `<rect x="0" y="${G}" width="${WIDTH.mid}" height="${H - G}" fill="url(#sc-ground-mid)"/>
     ${tree(250, G, 1.15, 3)}${tree(2050, G, 1.3, 4)}${tree(2300, G, 0.9, 5)}${tree(2850, G, 1.2, 6)}${tree(3250, G, 1, 7)}
     ${nb}
     ${house}
     <g mask="url(#sc-refl)" opacity=".42" filter="url(#sc-blur3)"><g transform="translate(0 ${2 * G}) scale(1 -1)">${houseRefl}</g></g>
     <rect x="0" y="470" width="${WIDTH.mid}" height="${G - 470}" fill="url(#sc-haze)" opacity=".55"/>`,
  );
}

/* ------------------------------------------------------------------ main: the boundary */
function main() {
  const r = rng(77);
  const W = WIDTH.main;
  const wall = (x1, x2) => `
    <rect x="${x1}" y="${G - 112}" width="${x2 - x1}" height="112" fill="url(#sc-wallg)" filter="url(#sc-plaster)"/>
    <rect x="${x1}" y="${G - 122}" width="${x2 - x1}" height="11" fill="#3a3148"/>
    <path d="M${x1} ${G - 122}H${x2}" stroke="#d6b3ff" stroke-opacity=".34" stroke-width="1.6"/>
    <rect x="${x1}" y="${G - 52}" width="${x2 - x1}" height="52" fill="url(#sc-ao)"/>`;
  const post = (x, recv) => `
    <g>
      <rect x="${x - 21}" y="${G - 246}" width="42" height="246" rx="4" fill="url(#sc-metal)" stroke="#40384f" stroke-width="1.2"/>
      <rect x="${x - 25}" y="${G - 254}" width="50" height="11" rx="4" fill="#1d1827" stroke="#4a4160"/>
      <path d="M${x - 15} ${G - 236}V${G - 8}" stroke="#fff" stroke-opacity=".13" stroke-width="2"/>
      <rect x="${x - 15}" y="${G - 216}" width="30" height="112" rx="6" fill="#05040a" stroke="#4a4160" stroke-width="1.2"/>
      <circle cx="${x}" cy="${G - 182}" r="10" fill="#0f0d18" stroke="#8a7ba8" stroke-width="2.2"/><circle cx="${x}" cy="${G - 182}" r="5" fill="#d6a6ff"/><circle cx="${x - 2.2}" cy="${G - 184}" r="1.6" fill="#fff"/>
      <circle cx="${x}" cy="${G - 148}" r="10" fill="#0f0d18" stroke="#8a7ba8" stroke-width="2.2"/><circle cx="${x}" cy="${G - 148}" r="5" fill="#d6a6ff"/><circle cx="${x - 2.2}" cy="${G - 150}" r="1.6" fill="#fff"/>
      <g class="blink">${light(x, G - 120, 3, recv ? 'sc-glow-green' : 'sc-glow-pink', recv ? '#a8ffc9' : '#ffc2e0')}</g>
      <rect x="${x - 21}" y="${G - 40}" width="42" height="40" fill="url(#sc-ao)" opacity=".8"/>
    </g>`;
  const beam = (y) => `
    <g class="beam">
      <path d="M508 ${y}H1252" stroke="#c46bff" stroke-width="40" stroke-opacity=".34" filter="url(#sc-blur14)"/>
      <path d="M508 ${y}H1252" stroke="#c46bff" stroke-width="14" stroke-opacity=".38" filter="url(#sc-blur6)"/>
      <path d="M508 ${y}H1252" stroke="#e2b8ff" stroke-width="4.2" stroke-opacity=".9"/>
      <path d="M508 ${y}H1252" stroke="#fff" stroke-width="1.6"/>
    </g>`;
  // gate panel: rails + slats + rack teeth, one group so it can slide
  let slats = '';
  for (let x = 2442; x < 3140; x += 24) slats += `<rect x="${x}" y="${G - 236}" width="11" height="212" fill="url(#sc-slat)"/>`;
  let teeth = '';
  for (let x = 2436; x < 3140; x += 11) teeth += `<rect x="${x}" y="${G - 14}" width="6" height="8" fill="#3a3148"/>`;
  const gate = `
    <g id="sc-gate">
      <rect x="2432" y="${G - 252}" width="716" height="17" rx="3" fill="url(#sc-metal)" stroke="#4a4160"/>
      <rect x="2432" y="${G - 140}" width="716" height="9" fill="#1d1827"/>
      <rect x="2432" y="${G - 32}" width="716" height="15" rx="3" fill="url(#sc-metal)" stroke="#4a4160"/>
      ${slats}${teeth}
      <rect x="2432" y="${G - 252}" width="716" height="3" fill="#fff" opacity=".16"/>
    </g>`;
  const pillar = (x, w, h) => `
    <rect x="${x}" y="${G - h}" width="${w}" height="${h}" fill="url(#sc-brick)"/>
    <rect x="${x}" y="${G - h}" width="${w}" height="${h}" fill="url(#sc-pillar)" opacity=".86" filter="url(#sc-plaster)"/>
    <rect x="${x - 9}" y="${G - h - 12}" width="${w + 18}" height="13" rx="2" fill="#40364f"/>
    <path d="M${x - 9} ${G - h - 12}H${x + w + 9}" stroke="#fff" stroke-opacity=".2" stroke-width="1.4"/>
    <rect x="${x}" y="${G - 70}" width="${w}" height="70" fill="url(#sc-ao)"/>`;
  // control room feeds: each screen is a tiny scene (sky band, ground band, a bright subject)
  let screens = '';
  let n = 0;
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 6; col++) {
      const alert = row === 0 && col === 3;
      const x = 4010 + col * 84;
      const y = G - 212 + row * 52;
      screens += `<g class="screen${alert ? ' screen--alert' : ''}" style="--i:${n++}">
        <rect x="${x}" y="${y}" width="76" height="42" rx="3" fill="${alert ? '#ff5fae' : 'url(#sc-screen)'}" opacity="${f(0.62 + r() * 0.3)}"/>
        <rect x="${x}" y="${y + 26}" width="76" height="16" fill="#08101f" opacity=".5"/>
        <circle cx="${f(x + 18 + r() * 40)}" cy="${y + 24}" r="3" fill="#fff" opacity=".8"/>
        <path d="M${x} ${y + 12}H${x + 76}" stroke="#fff" stroke-opacity=".12"/>
        <rect x="${x + 3}" y="${y + 3}" width="14" height="3" fill="#fff" opacity=".55"/>
      </g>`;
    }
  }
  const signal = `M1260 ${G}V${G + 26}H3990V${G - 6}`;
  const ripples = (x, y, cls) => [0, 1, 2].map((i) => `<circle class="ripple ${cls}" style="animation-delay:${i * 0.9}s" cx="${x}" cy="${y}" r="10" fill="none" stroke="#ff9fd0" stroke-width="2"/>`).join('');
  // things bright enough to mirror in the wet ground
  const reflA = `${beam(G - 182)}${beam(G - 148)}${light(490, G - 182, 4, 'sc-glow-violet', '#fff')}${light(1260, G - 182, 4, 'sc-glow-violet', '#fff')}`;
  const reflB = `${light(1955, G - 322, 5, 'sc-glow-warm', '#fff6e8')}<rect x="1900" y="${G - 330}" width="110" height="330" fill="#241d30"/>`;
  const reflC = `<path d="M2488 ${G - 40}L2522 ${G - 52}H2548" stroke="#d49bff" stroke-width="6" fill="none"/>`;
  const reflD = `<rect x="3990" y="${G - 226}" width="540" height="124" fill="#5b8bff" opacity=".7"/><circle cx="4670" cy="${G - 446}" r="5" fill="#ff6a6a"/>`;
  const refl = `<g mask="url(#sc-refl)" opacity=".5" filter="url(#sc-blur2)"><g transform="translate(0 ${2 * G}) scale(1 -1)">${reflA}${reflB}${reflC}${reflD}</g></g>`;
  // pavers: rows get wider with distance from the horizon line, to suggest perspective
  let joints = '';
  const rows = [14, 32, 56, 88, 130];
  rows.forEach((y, i) => {
    joints += `<path d="M0 ${G + y}H${W}" stroke="#000" stroke-opacity=".28" stroke-width="${f(1 + i * 0.3)}"/>`;
    const step = 46 + i * 26;
    let d = '';
    const y0 = i === 0 ? G : G + rows[i - 1];
    for (let x = (i % 2) * (step / 2); x < W; x += step) d += `M${x} ${y0}V${G + y}`;
    joints += `<path d="${d}" stroke="#000" stroke-opacity=".22" stroke-width="1"/>`;
  });
  return svg(
    W,
    `<!-- ground: wet pavers that mirror the lights -->
    ${refl}
    <rect x="0" y="${G}" width="${W}" height="${H - G}" fill="url(#sc-ground-main)"/>
    ${joints}
    <path d="M0 ${G}H${W}" stroke="#a46bb0" stroke-opacity=".4" stroke-width="2"/>
    <ellipse cx="1950" cy="${G + 8}" rx="360" ry="24" fill="url(#sc-glow-warm)" opacity=".7"/>
    <ellipse cx="880" cy="${G + 12}" rx="520" ry="22" fill="url(#sc-glow-violet)" opacity=".5"/>
    <ellipse cx="2700" cy="${G + 10}" rx="440" ry="22" fill="url(#sc-glow-violet)" opacity=".38"/>
    <ellipse cx="4250" cy="${G + 10}" rx="560" ry="26" fill="url(#sc-glow-pink)" opacity=".55"/>

    ${wall(0, 2340)}${wall(3240, 3940)}

    <!-- A · perimeter beams -->
    <g class="stn stn--a">
      ${post(490, false)}${post(1260, true)}
      ${beam(G - 182)}${beam(G - 148)}
      ${streak(880, G - 182, 420, '#c46bff', 0.5)}
      ${light(490, G - 182, 4, 'sc-glow-violet', '#fff')}${light(1260, G - 182, 4, 'sc-glow-violet', '#fff')}
      ${ripples(1260, G - 165, 'ripple--a')}
    </g>

    <!-- B · CCTV -->
    <g class="stn stn--b">
      ${pillar(1900, 110, 330)}
      <path d="M1955 ${G - 322}L1830 ${G}L2080 ${G}Z" fill="url(#sc-conew)" opacity=".7" filter="url(#sc-blur6)"/>
      <rect x="1930" y="${G - 338}" width="50" height="12" rx="3" fill="#fff6e8"/>
      ${light(1955, G - 324, 5, 'sc-glow-warm', '#fffaf0')}
      ${streak(1955, G - 324, 200, '#ffd9a0', 0.4)}
      <g class="cone"><path d="M1784 ${G - 246}L1250 ${G + 6}L1640 ${G + 6}Z" fill="url(#sc-cone)" filter="url(#sc-blur2)"/></g>
      <g transform="rotate(8 1862 ${G - 246})">
        <path d="M1904 ${G - 250}H1858" stroke="#a0a6b6" stroke-width="8" stroke-linecap="round"/>
        <rect x="1790" y="${G - 262}" width="76" height="31" rx="10" fill="url(#sc-camwhite)"/>
        <rect x="1782" y="${G - 271}" width="54" height="9" rx="3" fill="#c3c9d6"/>
        <path d="M1796 ${G - 261}H1850" stroke="#fff" stroke-width="2" opacity=".8"/>
        <circle cx="1790" cy="${G - 247}" r="14" fill="#0b0a11" stroke="#6b748c" stroke-width="3"/>
        <circle cx="1790" cy="${G - 247}" r="8" fill="#10182b" stroke="#3a4260" stroke-width="1.5"/>
        <circle cx="1790" cy="${G - 247}" r="4" fill="#7b8dff"/><circle cx="1787" cy="${G - 250}" r="1.6" fill="#fff"/>
        ${[0, 1, 2, 3, 4, 5].map((k) => `<circle cx="${f(1790 + Math.cos(k * 1.047) * 11)}" cy="${f(G - 247 + Math.sin(k * 1.047) * 11)}" r="1.1" fill="#ff7a7a"/>`).join('')}
        <g class="rec">${light(1850, G - 252, 3, 'sc-glow-red', '#ff7a7a')}</g>
      </g>
    </g>

    <!-- C · gate + motor -->
    <g class="stn stn--c">
      ${pillar(2340, 90, 300)}
      <ellipse cx="2800" cy="${G + 4}" rx="420" ry="9" fill="#000" opacity=".5"/>
      ${gate}
      ${pillar(3150, 90, 300)}
      <rect x="2470" y="${G - 98}" width="90" height="88" rx="12" fill="url(#sc-metal)" stroke="#4a4160" stroke-width="1.6"/>
      <path d="M2480 ${G - 90}H2550" stroke="#fff" stroke-opacity=".18" stroke-width="2"/>
      <path d="M2482 ${G - 84}H2548M2482 ${G - 79}H2548M2482 ${G - 74}H2548" stroke="#000" stroke-opacity=".5" stroke-width="1.4"/>
      <g class="motor-led"><path d="M2488 ${G - 40}L2522 ${G - 52}H2548" stroke="#c46bff" stroke-width="12" stroke-opacity=".5" fill="none" filter="url(#sc-blur6)"/><path d="M2488 ${G - 40}L2522 ${G - 52}H2548" stroke="#e8c4ff" stroke-width="4.5" stroke-linecap="round" fill="none"/></g>
      <rect x="3166" y="${G - 214}" width="22" height="36" rx="4" fill="#0a0910" stroke="#6a5f86"/>${light(3177, G - 198, 3, 'sc-glow-green', '#a8ffc9')}
    </g>

    <!-- signal trace: every device reports to the control room -->
    <g class="trace">
      <path d="${signal}" fill="none" stroke="#3a2a4a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M1955 ${G}V${G + 26}M2512 ${G}V${G + 26}" fill="none" stroke="#3a2a4a" stroke-width="3"/>
      <path id="sc-signal-on" d="${signal}" pathLength="1" fill="none" stroke="#ff8cc6" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="1" stroke-dashoffset="1"/>
      <circle class="node" data-at="0" cx="1260" cy="${G + 26}" r="6" fill="#ff5fae"/>
      <circle class="node" data-at="1" cx="1955" cy="${G + 26}" r="6" fill="#ff5fae"/>
      <circle class="node" data-at="2" cx="2512" cy="${G + 26}" r="6" fill="#ff5fae"/>
      <circle class="node" data-at="3" cx="3990" cy="${G + 26}" r="7" fill="#ff5fae"/>
    </g>

    <!-- D · control room -->
    <g class="stn stn--d">
      <rect x="3950" y="${G - 262}" width="620" height="262" fill="url(#sc-pillar)" filter="url(#sc-plaster)"/>
      <rect x="3934" y="${G - 276}" width="652" height="16" rx="3" fill="#2c2438"/>
      <path d="M3934 ${G - 260}H4586" stroke="#ff9fd0" stroke-opacity=".6" stroke-width="2"/>
      <rect x="3990" y="${G - 226}" width="540" height="124" rx="6" fill="#06050a" stroke="#4a4160" stroke-width="1.6"/>
      <ellipse cx="4260" cy="${G - 160}" rx="320" ry="100" fill="url(#sc-glow-blue)" opacity=".55" filter="url(#sc-blur14)"/>
      ${screens}
      <rect x="3990" y="${G - 226}" width="540" height="124" rx="6" fill="url(#sc-glassglare)"/>
      <g fill="#05040a"><circle cx="4150" cy="${G - 76}" r="12"/><path d="M4128 ${G - 14}V${G - 44}Q4128 ${G - 64} 4150 ${G - 64}Q4172 ${G - 64} 4172 ${G - 44}V${G - 14}Z"/><circle cx="4300" cy="${G - 76}" r="12"/><path d="M4278 ${G - 14}V${G - 44}Q4278 ${G - 64} 4300 ${G - 64}Q4322 ${G - 64} 4322 ${G - 44}V${G - 14}Z"/></g>
      <path d="M4140 ${G - 86}Q4150 ${G - 92} 4160 ${G - 86}M4290 ${G - 86}Q4300 ${G - 92} 4310 ${G - 86}" stroke="#7aa8ff" stroke-opacity=".6" stroke-width="2" fill="none"/>
      <rect x="4080" y="${G - 30}" width="300" height="12" rx="3" fill="#1d1827"/>
      <rect x="4430" y="${G - 140}" width="70" height="140" rx="4" fill="#06050a" stroke="#4a4160"/>
      ${streak(4260, G - 160, 360, '#7fa8ff', 0.35)}
      <!-- mast -->
      <g stroke="#3a2e4c" stroke-width="3" fill="none">
        <path d="M4642 ${G}L4670 ${G - 440}L4698 ${G}M4650 ${G - 110}H4690M4655 ${G - 220}H4685M4660 ${G - 330}H4680"/>
        <path d="M4642 ${G}L4690 ${G - 110}L4650 ${G - 220}L4685 ${G - 330}"/>
      </g>
      <g class="blink">${light(4670, G - 446, 5, 'sc-glow-red', '#ff8a8a')}</g>
      ${ripples(4670, G - 446, 'ripple--d')}
    </g>
    <rect x="0" y="${G - 360}" width="${W}" height="360" fill="url(#sc-haze)" opacity=".4"/>`,
  );
}

/* ------------------------------------------------------------------ fore: out-of-focus grass + light */
function fore() {
  const r = rng(99);
  let blades = '';
  for (let i = 0; i < 230; i++) {
    const x = r() * WIDTH.fore;
    const h = 70 + r() * 210;
    const lean = (r() - 0.5) * 70;
    const shade = ['#040308', '#07050c', '#0a0712'][i % 3];
    blades += `<path d="M${f(x)} ${H}Q${f(x + lean * 0.3)} ${f(H - h * 0.6)} ${f(x + lean)} ${f(H - h)}Q${f(x + lean * 0.3 + 7)} ${f(H - h * 0.55)} ${f(x + 9)} ${H}Z" fill="${shade}"/>`;
  }
  let bokeh = '';
  const cols = ['#ffd9a0', '#c46bff', '#ff5fae', '#ffd9a0'];
  for (let i = 0; i < 12; i++) {
    const rad = 16 + r() * 40;
    const x = f(r() * WIDTH.fore);
    const y = f(740 + r() * 120);
    bokeh += `<circle cx="${x}" cy="${y}" r="${f(rad)}" fill="${cols[i % 4]}" opacity=".13" filter="url(#sc-blur2)"/><circle cx="${x}" cy="${y}" r="${f(rad)}" fill="none" stroke="${cols[i % 4]}" stroke-opacity=".22" stroke-width="1.5"/>`;
  }
  return svg(
    WIDTH.fore,
    `${bokeh}
    <rect x="0" y="${H - 36}" width="${WIDTH.fore}" height="36" fill="#040308"/>
    ${blades}`,
  );
}

export function buildScene() {
  return {
    defs,
    sky: sky(),
    far: far(),
    mid: mid(),
    main: main(),
    fore: fore(),
  };
}
