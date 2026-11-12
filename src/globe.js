// The small globes (the page's answer to the little turning moons on armadillo-gs.com): a pink sphere with meridians and parallels,
// like the globe in our logo, drawn on a 2D canvas and turned by the scroll. Cheap: about a thousand points per frame, only while
// the canvas is on screen.
import { ScrollTrigger } from 'gsap/ScrollTrigger';

const TILT = 0.42;

function draw(cv, turn) {
  const ctx = cv.getContext('2d');
  const s = cv.width;
  if (!s) return;
  const c = s / 2;
  const R = s * 0.46;
  ctx.clearRect(0, 0, s, s);

  // the ball
  const g = ctx.createRadialGradient(c - R * 0.35, c - R * 0.4, R * 0.05, c, c, R);
  g.addColorStop(0, '#ffd6ea');
  g.addColorStop(0.35, '#ff5fae');
  g.addColorStop(0.7, '#b0155f');
  g.addColorStop(1, '#3a0620');
  ctx.beginPath();
  ctx.arc(c, c, R, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();

  // lines of latitude and longitude, front half only
  const cr = Math.cos(turn);
  const sr = Math.sin(turn);
  const ct = Math.cos(TILT);
  const st = Math.sin(TILT);
  const project = (lat, lon) => {
    const x = Math.cos(lat) * Math.cos(lon);
    const y = Math.sin(lat);
    const z = Math.cos(lat) * Math.sin(lon);
    const x1 = x * cr + z * sr;
    const z1 = -x * sr + z * cr;
    const y2 = y * ct - z1 * st;
    const z2 = y * st + z1 * ct;
    return [c + R * x1, c - R * y2, z2];
  };
  ctx.lineWidth = Math.max(1, s / 120);
  ctx.strokeStyle = 'rgba(255,255,255,0.38)';
  ctx.beginPath();
  const line = (pts) => {
    let pen = false;
    for (const [x, y, z] of pts) {
      if (z > 0) {
        if (!pen) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        pen = true;
      } else pen = false;
    }
  };
  for (let lat = -60; lat <= 60; lat += 30) {
    const pts = [];
    for (let lon = 0; lon <= 360; lon += 6) pts.push(project((lat * Math.PI) / 180, (lon * Math.PI) / 180));
    line(pts);
  }
  for (let lon = 0; lon < 360; lon += 30) {
    const pts = [];
    for (let lat = -90; lat <= 90; lat += 6) pts.push(project((lat * Math.PI) / 180, (lon * Math.PI) / 180));
    line(pts);
  }
  ctx.stroke();

  // a soft rim
  ctx.beginPath();
  ctx.arc(c, c, R, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.28)';
  ctx.lineWidth = Math.max(1, s / 90);
  ctx.stroke();
}

export function initGlobes(reduced) {
  document.querySelectorAll('canvas[data-globe]').forEach((cv) => {
    let progress = 0;
    const fit = () => {
      const size = Math.round(cv.getBoundingClientRect().width * Math.min(window.devicePixelRatio || 1, 2));
      if (size && cv.width !== size) cv.width = cv.height = size;
      draw(cv, 0.6 + progress * Math.PI * 2.2);
    };
    fit();
    if (reduced) return;
    ScrollTrigger.create({
      trigger: cv,
      start: 'top bottom',
      end: 'bottom top',
      onRefresh: fit,
      onUpdate: (self) => {
        progress = self.progress;
        draw(cv, 0.6 + progress * Math.PI * 2.2);
      },
    });
  });
}
