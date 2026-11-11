// Image-sequence player: draws pre-extracted video frames (public/frames/<name>/, made by scripts/make-frames.mjs)
// onto a canvas, so scroll position can scrub the footage frame by frame in both directions.
//
// Smoothness:
//  - Between two frames the player cross-fades by the fractional position, so a 24 fps clip scrubbed slowly moves continuously
//    instead of stepping (like the motion blur of a camera).
//  - Every frame is downloaded once and kept compressed; only the frames around the playhead are decoded, a few at a time, nearest
//    first and in the direction of travel, so stale work never blocks the frame that is needed now.
//  - Downloads start with a coarse skeleton (every 12th frame), then fill in nearest the playhead, so scrubbing works long before
//    every frame has arrived and a jump to another chapter loads that part first.
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const BG = '#07060b';
const stores = new Map();
const MEMORY_BUDGET = 170e6; // bytes of decoded frames kept at once
const AHEAD = 16; // frames decoded ahead of the playhead, in the direction of travel
const BEHIND = 6;
const DECODERS = 3; // decodes in flight at once
const FETCHERS = 6; // downloads in flight at once
const SKELETON = 12;

function getStore(name, manifest) {
  let s = stores.get(name);
  if (s) return s;
  const { count, ext = 'webp', pad = 4, width = 1280, height = 720 } = manifest;
  const url = (i) => `/frames/${name}/f${String(i + 1).padStart(pad, '0')}.${ext}`;
  const blobs = new Array(count).fill(null);
  const requested = new Set(); // frames fetched or being fetched
  const bitmaps = new Map(); // index -> decoded ImageBitmap
  const decoding = new Set();
  const bad = new Set();
  const listeners = new Set();
  const keep = Math.max(16, Math.min(90, Math.floor(MEMORY_BUDGET / (width * height * 4))));
  let want = 0;
  let dir = 1;
  let fetching = 0;
  let loaded = 0;
  let started = false;
  let resolveReady;
  const ready = new Promise((r) => (resolveReady = r));
  setTimeout(() => resolveReady(), 6000);

  /* ---- decoding */
  const evict = () => {
    if (bitmaps.size <= keep) return;
    const far = [...bitmaps.keys()].sort((a, b) => Math.abs(b - want) - Math.abs(a - want));
    for (const k of far) {
      if (bitmaps.size <= keep) break;
      bitmaps.get(k)?.close?.();
      bitmaps.delete(k);
    }
  };
  const canDecode = (j) => j >= 0 && j < count && blobs[j] && !bitmaps.has(j) && !decoding.has(j) && !bad.has(j);
  const nextToDecode = () => {
    for (let k = 0; k <= AHEAD; k++) if (canDecode(want + dir * k)) return want + dir * k;
    for (let k = 1; k <= BEHIND; k++) if (canDecode(want - dir * k)) return want - dir * k;
    return -1;
  };
  const pumpDecode = () => {
    while (decoding.size < DECODERS) {
      const i = nextToDecode();
      if (i < 0) return;
      decoding.add(i);
      createImageBitmap(blobs[i])
        .then(
          (b) => bitmaps.set(i, b),
          () => bad.add(i),
        )
        .finally(() => {
          decoding.delete(i);
          evict();
          if (i === 0) resolveReady();
          listeners.forEach((fn) => fn(i));
          pumpDecode();
        });
    }
  };

  /* ---- downloading */
  const nextToFetch = () => {
    for (let i = 0; i < count; i += SKELETON) if (!requested.has(i)) return i;
    if (!requested.has(count - 1)) return count - 1;
    for (let d = 0; d < count; d++) {
      const a = want + dir * d;
      const b = want - dir * d;
      if (a >= 0 && a < count && !requested.has(a)) return a;
      if (b >= 0 && b < count && !requested.has(b)) return b;
    }
    return -1;
  };
  const pumpFetch = () => {
    while (fetching < FETCHERS) {
      const i = nextToFetch();
      if (i < 0) return;
      requested.add(i);
      fetching++;
      fetch(url(i))
        .then((r) => {
          if (!r.ok) throw new Error(String(r.status));
          return r.blob();
        })
        .then((b) => {
          blobs[i] = b;
          loaded++;
          if (Math.abs(i - want) <= AHEAD + BEHIND) pumpDecode();
        })
        .catch(() => {
          /* a missing frame just falls back to its neighbour */
        })
        .finally(() => {
          fetching--;
          pumpFetch();
        });
    }
  };

  s = {
    count,
    ready,
    listeners,
    get: (i) => bitmaps.get(i),
    get loaded() {
      return loaded;
    },
    // tell the store where the playhead is, so it decodes and downloads the right frames first
    focus(i) {
      if (i !== want) dir = i > want ? 1 : -1;
      want = i;
      pumpDecode();
      pumpFetch();
    },
    load() {
      if (started) return;
      started = true;
      pumpFetch();
    },
  };
  stores.set(name, s);
  return s;
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{ name?: string }} opts  name of the frame set in public/frames/
 * @returns {Promise<null | { count: number, ready: Promise<void>, loaded: number, stats: object, update(p: number): void }>}
 */
export async function createSequence(canvas, { name = 'film' } = {}) {
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
  const ctx = canvas.getContext('2d', { alpha: false });
  const stats = { draws: 0, exact: 0, stood_in: 0, blended: 0 };
  let W = 1;
  let H = 1;
  let lastP = 0;
  let lastA = null;
  let lastB = null;
  let lastW = -1;
  let dirty = true;

  // Tall or square windows: the whole frame fits the width in the upper part of the screen (clear of the copy below), with
  // soft top and bottom edges into the page background, instead of cropping a 16:9 frame to a sliver.
  const stacked = () => W / H < 1;

  function put(bmp, alpha) {
    ctx.globalAlpha = alpha;
    if (stacked()) {
      ctx.drawImage(bmp, 0, H * 0.17, W, bmp.height * (W / bmp.width));
    } else {
      const s = Math.max(W / bmp.width, H / bmp.height); // cover-fit
      const dw = bmp.width * s;
      const dh = bmp.height * s;
      ctx.drawImage(bmp, (W - dw) * focusX, (H - dh) * focusY, dw, dh);
    }
    ctx.globalAlpha = 1;
  }

  function paint(a, b, w) {
    const tall = stacked();
    if (tall) {
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, W, H);
    }
    put(a, 1);
    if (b && w > 0) put(b, w);
    if (tall) {
      const dh = a.height * (W / a.width);
      const y = H * 0.17;
      const f = dh * 0.16;
      for (const [edge, dir] of [[y, 1], [y + dh, -1]]) {
        const g = ctx.createLinearGradient(0, edge, 0, edge + dir * f);
        g.addColorStop(0, 'rgba(7,6,11,1)');
        g.addColorStop(1, 'rgba(7,6,11,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, Math.min(edge, edge + dir * f), W, f);
      }
    }
  }

  function draw(p) {
    lastP = p;
    const x = clamp(p, 0, 1) * (count - 1);
    const i = Math.floor(x);
    store.focus(Math.round(x));
    let A = store.get(i);
    let B = null;
    let w = 0;
    if (A) {
      B = i + 1 < count ? store.get(i + 1) : null;
      // blend toward the next frame over the middle of the interval (a short hold at each end keeps frames crisp)
      w = B ? Math.round(clamp((x - i - 0.08) / 0.84, 0, 1) * 10) / 10 : 0;
    } else {
      // the exact frame is not decoded yet: the nearest one that is stands in
      for (let d = 1; d <= 60 && !A; d++) A = store.get(i - d) || store.get(i + d);
      if (!A) return;
    }
    if (A === lastA && (w > 0 ? B : null) === lastB && w === lastW && !dirty) return;
    paint(A, B, w);
    stats.draws++;
    if (store.get(i) === A) stats.exact++;
    else stats.stood_in++;
    if (w > 0 && B) stats.blended++;
    lastA = A;
    lastB = w > 0 ? B : null;
    lastW = w;
    dirty = false;
  }

  function resize() {
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cw = canvas.clientWidth || window.innerWidth;
    if (cw * dpr > 1920) dpr = 1920 / cw; // the source is 1280 px wide: more pixels than this add GPU work, not detail
    W = Math.round(cw * dpr);
    H = Math.round((canvas.clientHeight || window.innerHeight) * dpr);
    canvas.width = W;
    canvas.height = H;
    ctx.imageSmoothingEnabled = true; // resizing a canvas resets its state
    ctx.imageSmoothingQuality = 'medium';
    dirty = true;
    draw(lastP);
  }
  resize();
  window.addEventListener('resize', resize);

  store.listeners.add(() => draw(lastP));
  store.load();

  return {
    count,
    name,
    stats,
    ready: store.ready,
    get loaded() {
      return store.loaded;
    },
    update: draw,
  };
}
