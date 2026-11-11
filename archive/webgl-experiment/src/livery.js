// Livery: the vinyl graphics from the real vehicle, redrawn on canvases so they can be
// wrapped onto the 3D bakkie. All artwork is vector-drawn here - swap `drawGlobe`,
// `drawRunner` and `drawWordmark` for the client's real logo file when we get it.
import * as THREE from 'three';

export const PINK = '#e4348a';
export const PINK_HI = '#ff6db3';
export const PINK_LO = '#b01f70';
const INK = '#0b0b0f';
const FONT = '"Montserrat Variable", "Montserrat", system-ui, sans-serif';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.round(w);
  c.height = Math.round(h);
  return c;
}

function toTexture(c, aniso) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

/* ------------------------------------------------------------------ primitives */

export function drawGlobe(ctx, cx, cy, r) {
  ctx.save();
  const g = ctx.createRadialGradient(cx - r * 0.38, cy - r * 0.42, r * 0.08, cx, cy, r * 1.02);
  g.addColorStop(0, '#ff86c0');
  g.addColorStop(0.5, PINK);
  g.addColorStop(1, PINK_LO);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.clip();
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = Math.max(1.2, r * 0.05);
  for (const k of [0.3, 0.6, 0.88]) {
    ctx.beginPath();
    ctx.ellipse(cx, cy, r * k, r, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.lineTo(cx, cy + r);
  ctx.stroke();
  for (const f of [-0.66, -0.34, 0, 0.34, 0.66]) {
    const y = cy + r * f;
    const half = Math.sqrt(Math.max(0, r * r - (r * f) ** 2));
    ctx.beginPath();
    ctx.moveTo(cx - half, y);
    ctx.quadraticCurveTo(cx, y + r * 0.16, cx + half, y);
    ctx.stroke();
  }
  ctx.restore();
}

// A sprinting figure, drawn in a unit box (0..1) scaled by `s`, leaning to the right.
export function drawRunner(ctx, x, y, s, color = INK, flip = false) {
  ctx.save();
  ctx.translate(x, y);
  if (flip) {
    ctx.translate(s, 0);
    ctx.scale(-1, 1);
  }
  ctx.scale(s, s);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 0.085;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const line = (...p) => {
    ctx.beginPath();
    ctx.moveTo(p[0], p[1]);
    for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]);
    ctx.stroke();
  };
  ctx.beginPath();
  ctx.arc(0.66, 0.12, 0.095, 0, Math.PI * 2);
  ctx.fill();
  line(0.58, 0.25, 0.42, 0.55); // torso
  line(0.56, 0.3, 0.7, 0.4, 0.8, 0.31); // front arm
  line(0.54, 0.31, 0.4, 0.34, 0.3, 0.46); // back arm
  line(0.42, 0.55, 0.6, 0.64, 0.58, 0.92); // front leg
  line(0.42, 0.55, 0.28, 0.76, 0.08, 0.84); // trailing leg
  ctx.restore();
}

function fitSize(ctx, text, weight, targetW, style = '') {
  ctx.font = `${style} ${weight} 100px ${FONT}`;
  return (100 * targetW) / ctx.measureText(text).width;
}

// GLOBAL / SECURITY SOLUTIONS / 24 Hour Monitoring And Response
export function drawWordmark(ctx, x, y, w, { ink = INK, onDark = false } = {}) {
  const S = fitSize(ctx, 'GLOBAL', 800, w);
  ctx.textBaseline = 'alphabetic';
  ctx.font = `800 ${S}px ${FONT}`;
  ctx.fillStyle = onDark ? '#fff' : ink;
  ctx.fillText('GLOBAL', x, y + S * 0.72);

  const bh = S * 0.36;
  const by = y + S * 0.84;
  const sk = bh * 0.42;
  ctx.fillStyle = PINK;
  ctx.beginPath();
  ctx.moveTo(x + sk, by);
  ctx.lineTo(x + w, by);
  ctx.lineTo(x + w - sk, by + bh);
  ctx.lineTo(x, by + bh);
  ctx.closePath();
  ctx.fill();
  const t1 = fitSize(ctx, 'SECURITY SOLUTIONS', 800, (w - sk * 2) * 0.94);
  ctx.font = `800 ${t1}px ${FONT}`;
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.fillText('SECURITY SOLUTIONS', x + w / 2, by + bh / 2 + t1 * 0.36);

  const by2 = by + bh + S * 0.025;
  const bh2 = S * 0.27;
  ctx.fillStyle = PINK;
  ctx.beginPath();
  ctx.moveTo(x + sk * 0.7, by2);
  ctx.lineTo(x + w - sk * 0.3, by2);
  ctx.lineTo(x + w - sk * 0.9, by2 + bh2);
  ctx.lineTo(x, by2 + bh2);
  ctx.closePath();
  ctx.fill();
  const t2 = fitSize(ctx, '24 Hour Monitoring And Response', 600, (w - sk * 2) * 0.92, 'italic');
  ctx.font = `italic 600 ${t2}px ${FONT}`;
  ctx.fillStyle = '#fff';
  ctx.fillText('24 Hour Monitoring And Response', x + w / 2, by2 + bh2 / 2 + t2 * 0.35);
  ctx.textAlign = 'left';

  const sy = by2 + bh2 + S * 0.02;
  ctx.fillStyle = onDark ? '#fff' : ink;
  ctx.beginPath();
  ctx.moveTo(x + w * 0.46, sy);
  ctx.lineTo(x + w, sy);
  ctx.lineTo(x + w - sk * 0.6, sy + S * 0.05);
  ctx.lineTo(x + w * 0.46 - sk * 0.2, sy + S * 0.05);
  ctx.closePath();
  ctx.fill();
  return sy + S * 0.05 - y;
}

function drawHandset(ctx, x, y, h, color = INK) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = h * 0.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(x + h * 0.5, y + h * 0.52, h * 0.34, Math.PI * 1.06, Math.PI * 1.94, false);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x + h * 0.14, y + h * 0.55, h * 0.13, 0, Math.PI * 2);
  ctx.arc(x + h * 0.86, y + h * 0.55, h * 0.13, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPhone(ctx, x, y, h, color = INK) {
  drawHandset(ctx, x, y, h, color);
  ctx.fillStyle = color;
  ctx.font = `800 ${h * 0.9}px ${FONT}`;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('034 315 4237', x + h * 1.15, y + h * 0.82);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/* ------------------------------------------------------------------ decals */

function doorLogo(side) {
  const W = 1200;
  const H = 470;
  const c = canvas(W, H);
  const ctx = c.getContext('2d');
  const globeRight = side > 0; // globe always sits toward the front of the vehicle
  const gr = 150;
  const gcx = globeRight ? W - gr - 24 : gr + 24;
  const gcy = 175;
  drawGlobe(ctx, gcx, gcy, gr);
  drawRunner(ctx, globeRight ? gcx - gr * 1.1 : gcx - gr * 0.2, gcy + gr * 0.2, 250, INK, globeRight);
  const tw = W - (gr * 2 + 70);
  const tx = globeRight ? 8 : gr * 2 + 56;
  drawWordmark(ctx, tx, 84, tw);
  return c;
}

function quarterGlobe(side) {
  const c = canvas(420, 420);
  const ctx = c.getContext('2d');
  drawGlobe(ctx, 210, 150, 140);
  drawRunner(ctx, side > 0 ? 30 : 140, 190, 230, INK, side > 0);
  return c;
}

function phoneDecal() {
  const c = canvas(900, 170);
  drawPhone(c.getContext('2d'), 20, 18, 120);
  return c;
}

function canopyPanel(side) {
  const W = 1560;
  const H = 520;
  const c = canvas(W, H);
  const ctx = c.getContext('2d');
  const pinkW = W * 0.4;
  const pinkLeft = side > 0; // pink panel faces the rear of the vehicle
  const frame = 26;
  ctx.save();
  roundRect(ctx, 0, 0, W, H, 54);
  ctx.clip();
  // frosted film
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#f1f2f5');
  g.addColorStop(1, '#cfd2d9');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // pink panel
  const px = pinkLeft ? 0 : W - pinkW;
  ctx.fillStyle = '#dd3f8e';
  ctx.fillRect(px, 0, pinkW, H);
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const lines = ['24HR', 'MONITORING', '& ARMED', 'RESPONSE'];
  const fs = fitSize(ctx, 'MONITORING', 800, pinkW * 0.78);
  lines.forEach((t, i) => {
    ctx.font = `800 ${fs}px ${FONT}`;
    ctx.fillText(t, px + pinkW / 2, 118 + i * (fs * 1.28));
  });
  // logo panel
  const lw = W - pinkW;
  const lx = pinkLeft ? pinkW : 0;
  const gr = 82;
  const gx = pinkLeft ? lx + 40 + gr : lx + lw - 40 - gr;
  drawGlobe(ctx, gx, 150, gr);
  drawRunner(ctx, pinkLeft ? gx - gr * 0.7 : gx - gr * 0.9, 190, 150, INK, !pinkLeft);
  const tx = pinkLeft ? lx + 40 : lx + 40 + (gr * 2 + 30) * 0 + 0;
  const textX = pinkLeft ? lx + gr * 2 + 80 : lx + 50;
  const textW = lw - gr * 2 - 130;
  ctx.textAlign = 'left';
  const S = fitSize(ctx, 'GLOBAL', 800, textW);
  ctx.font = `800 ${S}px ${FONT}`;
  ctx.fillStyle = INK;
  ctx.fillText('GLOBAL', textX, 150);
  const s2 = fitSize(ctx, 'SECURITY SOLUTIONS', 700, textW * 0.97);
  ctx.font = `700 ${s2}px ${FONT}`;
  ctx.fillStyle = PINK;
  ctx.fillText('SECURITY SOLUTIONS', textX, 150 + s2 * 1.35);
  drawPhone(ctx, textX, 300, 92);
  void tx;
  ctx.restore();
  // frame
  ctx.lineWidth = frame;
  ctx.strokeStyle = '#0a0a0d';
  roundRect(ctx, frame / 2, frame / 2, W - frame, H - frame, 46);
  ctx.stroke();
  return c;
}

function canopyRearPanel() {
  const W = 1250;
  const H = 440;
  const c = canvas(W, H);
  const ctx = c.getContext('2d');
  ctx.save();
  roundRect(ctx, 0, 0, W, H, 50);
  ctx.clip();
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#f1f2f5');
  g.addColorStop(1, '#d2d5dc');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  drawGlobe(ctx, 250, 190, 120);
  drawRunner(ctx, 140, 230, 200, INK, false);
  const S = fitSize(ctx, 'GLOBAL', 800, 700);
  ctx.font = `800 ${S}px ${FONT}`;
  ctx.fillStyle = INK;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('GLOBAL', 420, 210);
  drawPhone(ctx, 420, 250, 96);
  ctx.restore();
  ctx.lineWidth = 28;
  ctx.strokeStyle = '#0a0a0d';
  roundRect(ctx, 14, 14, W - 28, H - 28, 44);
  ctx.stroke();
  return c;
}

function hoodDecal() {
  const W = 1000;
  const H = 640;
  const c = canvas(W, H);
  const ctx = c.getContext('2d');
  drawWordmark(ctx, 90, 30, 820);
  drawGlobe(ctx, 500, 470, 105);
  drawRunner(ctx, 560, 380, 170, INK, false);
  return c;
}

function rearDecal() {
  const W = 1500;
  const H = 600;
  const c = canvas(W, H);
  const ctx = c.getContext('2d');
  drawWordmark(ctx, 60, 30, 560);
  drawPhone(ctx, 800, 70, 130);
  // hazard chevrons on the bumper corners
  const stripes = (x0, x1, dir) => {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, 372, x1 - x0, 210);
    ctx.clip();
    for (let i = -6; i < 10; i++) {
      const o = x0 + i * 46;
      ctx.fillStyle = i % 2 ? INK : PINK;
      ctx.beginPath();
      ctx.moveTo(o, 372);
      ctx.lineTo(o + 28, 372);
      ctx.lineTo(o + 28 + dir * 210, 582);
      ctx.lineTo(o + dir * 210, 582);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  };
  stripes(30, 250, 1);
  stripes(W - 250, W - 30, -1);
  return c;
}

function plateTexture() {
  const c = canvas(512, 112);
  const ctx = c.getContext('2d');
  roundRect(ctx, 0, 0, 512, 112, 14);
  ctx.fillStyle = '#f4f3ee';
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#111';
  roundRect(ctx, 5, 5, 502, 102, 11);
  ctx.stroke();
  ctx.fillStyle = '#111';
  ctx.font = `800 70px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('GSS 034 KZN', 256, 60);
  return c;
}

// Panel gaps + door handle, for the cab door only. Car-space coordinates in metres.
function doorLines(side) {
  const pxm = 600;
  const x0 = -0.45;
  const x1 = 1.2;
  const y0 = 0.3;
  const y1 = 1.04;
  const c = canvas((x1 - x0) * pxm, (y1 - y0) * pxm);
  const ctx = c.getContext('2d');
  const X = (x) => (side > 0 ? (x - x0) * pxm : (x1 - x) * pxm);
  const Y = (y) => (y1 - y) * pxm;
  const gap = (fn) => {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 3;
    ctx.save();
    ctx.translate(2, 2);
    fn();
    ctx.restore();
    ctx.strokeStyle = 'rgba(6,6,10,0.7)';
    ctx.lineWidth = 3;
    fn();
  };
  gap(() => {
    ctx.beginPath();
    ctx.moveTo(X(0.97), Y(1.0));
    ctx.lineTo(X(0.97), Y(0.4));
    ctx.quadraticCurveTo(X(0.97), Y(0.36), X(0.93), Y(0.36));
    ctx.lineTo(X(-0.14), Y(0.36));
    ctx.quadraticCurveTo(X(-0.2), Y(0.36), X(-0.2), Y(0.42));
    ctx.lineTo(X(-0.2), Y(1.0));
    ctx.stroke();
  });
  // handle
  ctx.fillStyle = '#0b0b0f';
  const hx = side > 0 ? X(0.12) : X(-0.0);
  roundRect(ctx, Math.min(hx, side > 0 ? X(0.0) : X(0.12)), Y(0.86), 0.12 * pxm, 0.03 * pxm, 6);
  ctx.fill();
  return { canvas: c, x0, x1, y0, y1 };
}

function windowGlass(side) {
  const pxm = 600;
  const x0 = -0.4;
  const x1 = 0.95;
  const y0 = 1.0;
  const y1 = 1.47;
  const c = canvas((x1 - x0) * pxm, (y1 - y0) * pxm);
  const ctx = c.getContext('2d');
  const X = (x) => (side > 0 ? (x - x0) * pxm : (x1 - x) * pxm);
  const Y = (y) => (y1 - y) * pxm;
  const poly = [
    [0.82, 1.04],
    [0.24, 1.44],
    [-0.31, 1.44],
    [-0.31, 1.04],
  ];
  const path = (grow = 0) => {
    ctx.beginPath();
    poly.forEach(([x, y], i) => (i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y))));
    ctx.closePath();
    void grow;
  };
  ctx.lineJoin = 'round';
  path();
  ctx.lineWidth = 34;
  ctx.strokeStyle = '#0a0b0e';
  ctx.stroke();
  ctx.fillStyle = '#0a0b0e';
  ctx.fill();
  path();
  ctx.lineWidth = 20;
  ctx.strokeStyle = '#10141c';
  ctx.stroke();
  const g = ctx.createLinearGradient(0, 0, c.width, c.height);
  g.addColorStop(0, '#1c2536');
  g.addColorStop(0.55, '#0b0f17');
  g.addColorStop(1, '#141b29');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  path();
  ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  ctx.beginPath();
  ctx.moveTo(X(0.5), Y(1.5));
  ctx.lineTo(X(0.7), Y(1.5));
  ctx.lineTo(X(0.1), Y(0.95));
  ctx.lineTo(X(-0.1), Y(0.95));
  ctx.fill();
  ctx.restore();
  return { canvas: c, x0, x1, y0, y1 };
}

/* ------------------------------------------------------------------ public */

export async function makeLivery(aniso = 8) {
  try {
    await Promise.all([
      document.fonts.load(`800 80px ${FONT}`),
      document.fonts.load(`700 80px ${FONT}`),
      document.fonts.load(`italic 600 80px ${FONT}`),
    ]);
  } catch {
    /* fonts fall back to system-ui; livery still renders */
  }
  const T = (c) => toTexture(c, aniso);
  const dl = [doorLines(1), doorLines(-1)];
  const wg = [windowGlass(1), windowGlass(-1)];
  return {
    doorLogoR: T(doorLogo(1)),
    doorLogoL: T(doorLogo(-1)),
    quarterGlobeR: T(quarterGlobe(1)),
    quarterGlobeL: T(quarterGlobe(-1)),
    phone: T(phoneDecal()),
    canopyR: T(canopyPanel(1)),
    canopyL: T(canopyPanel(-1)),
    canopyRear: T(canopyRearPanel()),
    hood: T(hoodDecal()),
    rear: T(rearDecal()),
    plate: T(plateTexture()),
    linesR: { tex: T(dl[0].canvas), ...dl[0] },
    linesL: { tex: T(dl[1].canvas), ...dl[1] },
    glassR: { tex: T(wg[0].canvas), ...wg[0] },
    glassL: { tex: T(wg[1].canvas), ...wg[1] },
  };
}
