#!/usr/bin/env node
// Redraws the Global Security Solutions logo as clean vector artwork, from the vinyl on the vehicle:
// flat pink wireframe globe (grid cut out so the background shows through), an Atlas-style figure holding it up,
// the wide squared GLOBAL wordmark, the pink SECURITY SOLUTIONS band and the 24 Hour Monitoring And Response band.
// The lettering is converted to outlines (no font needed to display it). Typefaces used as stand-ins for the vinyl
// lettering: Michroma (wordmark and band) and Montserrat Bold Italic (tagline). Replace with the client's real
// vector logo file when available.
//
//   node scripts/build-logo.mjs
//
// Writes: public/logo.svg, public/logo-reverse.svg, public/logo-mark.svg, public/favicon.svg
// and refreshes the logo symbols inside index.html (between the logo:start / logo:end markers).
import { readFileSync, writeFileSync } from 'node:fs';
import opentype from 'opentype.js';

const load = (p) => {
  const b = readFileSync(p);
  return opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
};
const michroma = load('node_modules/@fontsource/michroma/files/michroma-latin-400-normal.woff');
const montBoldItalic = load('node_modules/@fontsource/montserrat/files/montserrat-latin-700-normal.woff');

montBoldItalic.__native = true; // this font shapes fine natively
const PINK = '#e0368c';
const f = (n) => +n.toFixed(2);

// text → outline path data, fitted to a target width, with its left edge at x and baseline at y.
// Glyphs are placed one by one (no OpenType shaping needed for these capital-letter and simple lines).
function layout(font, text, size, spacing) {
  if (font.__native) return font.getPath(text, 0, 0, size, { kerning: true, features: { liga: false, rlig: false, ccmp: false }, letterSpacing: spacing });
  const path = new opentype.Path();
  let pen = 0;
  for (const ch of text) {
    const g = font.charToGlyph(ch);
    path.commands.push(...g.getPath(pen, 0, size).commands);
    pen += (g.advanceWidth * size) / font.unitsPerEm + spacing * size;
  }
  return path;
}
function textPath(font, text, { x, y, width, spacing = 0 }) {
  const probe = layout(font, text, 100, spacing).getBoundingBox();
  const size = (100 * width) / (probe.x2 - probe.x1);
  const path = layout(font, text, size, spacing);
  const bb = path.getBoundingBox();
  path.commands.forEach((c) => {
    for (const k of ['x', 'x1', 'x2']) if (k in c) c[k] += x - bb.x1;
    for (const k of ['y', 'y1', 'y2']) if (k in c) c[k] += y;
  });
  const out = path.getBoundingBox();
  return { d: path.toPathData({ decimalPlaces: 2, optimize: false, flipY: false }), capTop: out.y1, right: out.x2, size };
}

// --- globe -----------------------------------------------------------------------------------------------
const cx = 70;
const cy = 62;
const r = 52;
const lineW = 4.6;
const parallels = [-0.62, -0.2, 0.22, 0.58].map((k) => {
  const y = cy + r * k;
  const half = Math.sqrt(r * r - (r * k) ** 2) + 2;
  return `M${f(cx - half)} ${f(y)}Q${cx} ${f(y + 15)} ${f(cx + half)} ${f(y)}`;
});
const gridLines = `
    <path d="M${cx} ${cy - r - 2}V${cy + r + 2}"/>
    <ellipse cx="${cx}" cy="${cy}" rx="${f(r * 0.4)}" ry="${r + 1}"/>
    <ellipse cx="${cx}" cy="${cy}" rx="${f(r * 0.76)}" ry="${r + 1}"/>
    <path d="${parallels.join('')}"/>`;
const globe = (id) => `
    <mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="150" height="130">
      <rect x="0" y="0" width="150" height="130" fill="#fff"/>
      <g fill="none" stroke="#000" stroke-width="${lineW}" stroke-linecap="round">${gridLines}
      </g>
    </mask>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="${PINK}" mask="url(#${id})"/>`;

// --- Atlas figure (kneeling, arms up, holding the globe; trailing leg sweeps away from the wordmark) -------
const figure = `
    <g fill="currentColor">
      <path d="M72.5 107.5L84.5 105.5L88.5 112L92 130L83 131.5L77 121Z"/>
      <circle cx="76.5" cy="101.5" r="5.2"/>
    </g>
    <g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
      <path d="M73.5 108L65.5 97" stroke-width="5.6"/>
      <path d="M85 107L101.5 103.5" stroke-width="5.6"/>
      <path d="M89 129L109.5 126.5L107 146" stroke-width="8"/>
      <path d="M107 146L113.5 147.5" stroke-width="4.4"/>
      <path d="M86 132L66.5 142L45.5 158" stroke-width="7"/>
    </g>`;

// --- wordmark + bands --------------------------------------------------------------------------------------
const glob = textPath(michroma, 'GLOBAL', { x: 150, y: 66, width: 326, spacing: 0.015 });
const sec = textPath(michroma, 'SECURITY SOLUTIONS', { x: 160, y: 91.5, width: 296, spacing: 0.06 });
const tag = textPath(montBoldItalic, '24 Hour Monitoring And Response ', { x: 182, y: 116.5, width: 236 });

const bands = `
    <path d="M147 74H480L474 100.5H141Z" fill="${PINK}"/>
    <path d="${sec.d}" fill="#fff" stroke="#fff" stroke-width="0.9" stroke-linejoin="round"/>
    <path d="M176 104H441L437 121H172Z" fill="${PINK}"/>
    <path d="M172 123H437L433 129.5H168Z" fill="currentColor"/>
    <text x="182" y="116.4" font-family="'Montserrat Variable',Montserrat,Arial,sans-serif" font-weight="700" font-style="italic" font-size="11.4" textLength="236" lengthAdjust="spacingAndGlyphs" fill="currentColor">24 Hour Monitoring And Response</text>`;

const markInner = (id) => `${globe(id)}${figure}`;
const lockupInner = (id) => `${markInner(id)}
    <path d="${glob.d}" fill="currentColor" stroke="currentColor" stroke-width="3.4" stroke-linejoin="round"/>${bands}`;

// --- symbols for index.html --------------------------------------------------------------------------------
const symbols = `<!-- logo:start (generated by scripts/build-logo.mjs) -->
        <symbol id="gss-mark" viewBox="10 6 120 158">${markInner('gss-gm')}
        </symbol>
        <symbol id="gss-lockup-full" viewBox="0 0 480 165">${lockupInner('gss-gl')}
        </symbol>
        <!-- logo:end -->`;

let html = readFileSync('index.html', 'utf8');
const a = html.indexOf('<!-- logo:start');
const b = html.indexOf('<!-- logo:end -->');
if (a < 0 || b < 0) throw new Error('logo markers missing in index.html');
html = html.slice(0, a) + symbols + html.slice(b + '<!-- logo:end -->'.length);
writeFileSync('index.html', html);

// --- standalone files --------------------------------------------------------------------------------------
const svg = (viewBox, body, ink, extra = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" color="${ink}" ${extra}role="img" aria-label="Global Security Solutions — 24 Hour Monitoring And Response">${body}\n</svg>\n`;
writeFileSync('public/logo.svg', svg('0 0 480 165', lockupInner('g1'), '#231f20'));
writeFileSync('public/logo-reverse.svg', svg('0 0 480 165', lockupInner('g1'), '#ffffff'));
writeFileSync('public/logo-mark.svg', svg('10 6 120 158', markInner('g1'), '#231f20'));
writeFileSync(
  'public/favicon.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="22" fill="#07060b"/><svg x="14" y="8" width="72" height="84" viewBox="10 6 120 158" color="#ffffff">${markInner('f1')}</svg></svg>\n`,
);
console.log('logo built: GLOBAL cap-top', f(glob.capTop), 'right edge', f(glob.right), '| band text right edge', f(sec.right));
