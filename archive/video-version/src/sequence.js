// Image-sequence player: draws pre-extracted video frames (public/frames/<name>/, made by scripts/make-frames.mjs)
// onto a canvas, so scroll position can scrub the footage frame-by-frame in both directions.
// Several canvases can play the same frame set (the hero and the tour share one clip): the decoded frames are
// stored once per name.
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const BG = '#07060b';
const stores = new Map();

function getStore(name, manifest) {
  let s = stores.get(name);
  if (s) return s;
  const { count, ext = 'webp', pad = 4 } = manifest;
  const url = (i) => `/frames/${name}/f${String(i + 1).padStart(pad, '0')}.${ext}`;
  const bitmaps = new Array(count).fill(null);
  const listeners = new Set();
  let loaded = 0;
  let full = false;
  let started = false;
  let resolveReady;
  const ready = new Promise((r) => (resolveReady = r));
  setTimeout(() => resolveReady(), 5000);

  async function run(order, workers) {
    let cursor = 0;
    async function worker() {
      while (cursor < order.length) {
        const i = order[cursor++];
        if (bitmaps[i]) continue;
        try {
          const blob = await (await fetch(url(i))).blob();
          bitmaps[i] = await createImageBitmap(blob);
          listeners.forEach((fn) => fn(i));
        } catch {
          /* a missing frame just falls back to its neighbour */
        }
        loaded++;
        if (bitmaps[0] && bitmaps[count - 1]) resolveReady();
      }
    }
    await Promise.all(Array.from({ length: workers }, worker));
  }

  s = {
    count,
    bitmaps,
    ready,
    listeners,
    get loaded() {
      return loaded;
    },
    // ends: only the first and last frame (static / low-data mode). Otherwise first + last, then coarse-to-fine,
    // so scrubbing works long before every frame has arrived.
    load(ends) {
      if (ends) {
        if (!started) (started = true, run([0, count - 1], 2));
        return;
      }
      if (full) return;
      full = started = true;
      const order = [0, count - 1];
      const seen = new Set(order);
      for (let step = 32; step >= 1; step >>= 1) for (let i = 0; i < count; i += step) if (!seen.has(i)) (seen.add(i), order.push(i));
      run(order, 6);
    },
  };
  stores.set(name, s);
  return s;
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{ name?: string, ends?: boolean }} opts  ends: only fetch the first and last frame (static / low-data mode)
 * @returns {Promise<null | { count: number, ready: Promise<void>, loaded: number, update(p: number): void }>}
 */
export async function createSequence(canvas, { name = 'van', ends = false } = {}) {
  let manifest;
  try {
    const r = await fetch(`/frames/${name}/manifest.json`, { cache: 'no-cache' });
    if (!r.ok || !(r.headers.get('content-type') || '').includes('json')) return null;
    manifest = await r.json();
  } catch {
    return null;
  }
  const { count, focusX = 0.5, focusY = 0.5 } = manifest;
  if (!count) return null;

  const store = getStore(name, manifest);
  const bitmaps = store.bitmaps;
  const ctx = canvas.getContext('2d', { alpha: false });
  let W = 1;
  let H = 1;
  let lastP = 0;
  let lastDrawn = -1;
  let lastBmp = null;
  let dirty = true;

  const nearest = (i) => {
    for (let d = 0; d < count; d++) {
      if (bitmaps[i - d]) return bitmaps[i - d];
      if (bitmaps[i + d]) return bitmaps[i + d];
    }
    return null;
  };

  function draw(p) {
    lastP = p;
    const i = Math.round(clamp(p, 0, 1) * (count - 1));
    const bmp = nearest(i);
    if (!bmp) return;
    if (i === lastDrawn && bmp === lastBmp && !dirty) return;
    if (W / H < 0.9) {
      // portrait: a cropped 16:9 hides most of the scene, so fit the whole frame to the width in the upper part of
      // the screen (clear of the copy below) with soft top/bottom edges into the page background
      const dh = bmp.height * (W / bmp.width);
      const y = H * 0.17;
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, W, H);
      ctx.drawImage(bmp, 0, y, W, dh);
      const f = dh * 0.16;
      for (const [edge, dir] of [[y, 1], [y + dh, -1]]) {
        const g = ctx.createLinearGradient(0, edge, 0, edge + dir * f);
        g.addColorStop(0, 'rgba(7,6,11,1)');
        g.addColorStop(1, 'rgba(7,6,11,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, Math.min(edge, edge + dir * f), W, f);
      }
    } else {
      const s = Math.max(W / bmp.width, H / bmp.height); // cover-fit
      const dw = bmp.width * s;
      const dh = bmp.height * s;
      ctx.drawImage(bmp, (W - dw) * focusX, (H - dh) * focusY, dw, dh);
    }
    lastDrawn = i;
    lastBmp = bmp;
    dirty = false;
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.round(canvas.clientWidth * dpr) || Math.round(window.innerWidth * dpr);
    H = Math.round(canvas.clientHeight * dpr) || Math.round(window.innerHeight * dpr);
    canvas.width = W;
    canvas.height = H;
    dirty = true;
    draw(lastP);
  }
  resize();
  window.addEventListener('resize', resize);

  store.listeners.add((i) => {
    if (i === 0 || i === count - 1) draw(lastP);
  });
  store.load(ends);

  return {
    count,
    name,
    ready: store.ready,
    get loaded() {
      return store.loaded;
    },
    update: draw,
  };
}
