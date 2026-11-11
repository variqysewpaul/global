// Image-sequence player: draws pre-extracted video frames (public/frames/<name>/, made by scripts/make-frames.mjs)
// onto a canvas, so scroll position can scrub the footage frame by frame in both directions.
//
// Crisp at rest, smooth in motion:
//  - The player always rests on ONE real frame, never on a blend of two. When the scroll position moves on to another frame, the
//    old frame dissolves into the new one over a short time (a little under the time since the last change, 16–100 ms). Scrolling slowly
//    gives gentle dissolves, so motion glides; scrolling fast gives near-instant swaps, so frames stay sharp; stopping always
//    ends on a single sharp frame within a tenth of a second.
//  - A small hysteresis stops the shown frame flickering back and forth when the scroll sits on the boundary between two frames.
//
// Loading and memory:
//  - Every frame is downloaded once and kept compressed; only the frames around the playhead are decoded (three at a time, nearest
//    first, in the direction of travel) and, on small screens, decoded at the size they will be drawn.
//  - Downloads start with a coarse skeleton (every 24th frame), then fill in nearest the playhead, so scrubbing works long before
//    every frame has arrived and a jump to another chapter loads that part first.
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (a) => a * a * (3 - 2 * a);
const BG = '#07060b';
const stores = new Map();
const MEMORY_BUDGET = 170e6; // bytes of decoded frames kept at once
const AHEAD = 16; // frames decoded ahead of the playhead, in the direction of travel
const BEHIND = 6;
const DECODERS = 3; // decodes in flight at once
const FETCHERS = 6; // downloads in flight at once
const SKELETON = 24;
const HOLD = 0.62; // the playhead must be this many frames from the shown frame before another frame is chosen
const FADE_MIN = 16; // ms (one display frame at 60 Hz: swaps are effectively instant when scrolling fast)
const FADE_MAX = 100;

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
  let targetWidth = 0;
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
  // on small screens frames are decoded at the size they are drawn: less memory, faster texture uploads
  const decodeOptions = () => (targetWidth && targetWidth < width * 0.8 ? { resizeWidth: Math.round(targetWidth), resizeQuality: 'medium' } : undefined);
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
      createImageBitmap(blobs[i], decodeOptions())
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
    // the width, in device pixels, that frames are drawn at; a big increase (a rotation, a resized window) re-decodes them
    setTarget(px) {
      const grew = targetWidth && px > targetWidth * 1.25;
      targetWidth = Math.max(targetWidth, Math.round(px));
      if (grew) {
        for (const b of bitmaps.values()) b.close?.();
        bitmaps.clear();
        pumpDecode();
      }
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
 * @returns {Promise<null | { count: number, ready: Promise<void>, loaded: number, stats: object, state(): object, update(p: number): void }>}
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
  const { count, focusX = 0.5, focusY = 0.5, width: fw = 1280, height: fh = 720 } = manifest;
  if (!count) return null;

  const store = getStore(name, manifest);
  const ctx = canvas.getContext('2d', { alpha: false });
  const stats = { draws: 0, exact: 0, stood_in: 0, fades: 0 };
  let W = 1;
  let H = 1;
  let x = 0; // the playhead, in frames (fractional)
  let cur = 0; // the frame being shown (or fading in)
  let prev = -1; // the frame fading out, or -1 when the player is resting on one sharp frame
  let fadeFrom = 0;
  let fadeDur = FADE_MAX;
  let lastChange = -1e9;
  let shown = { a: null, b: null, alpha: -1 };
  let dirty = true;
  let raf = 0;

  // Tall or square windows: the whole frame fits the width in the upper part of the screen (clear of the copy below), with
  // soft top and bottom edges into the page background, instead of cropping a 16:9 frame to a sliver.
  const stacked = () => W / H < 1;
  const nearest = (i) => {
    let b = store.get(i);
    for (let d = 1; d <= 60 && !b; d++) b = store.get(i - d) || store.get(i + d);
    return b;
  };

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

  function paint(a, b, alpha) {
    const tall = stacked();
    if (tall) {
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, W, H);
    }
    if (a) put(a, 1);
    put(b, a ? alpha : 1);
    if (tall) {
      const dh = b.height * (W / b.width);
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

  function render(t) {
    const f = prev >= 0 ? smooth(clamp((t - fadeFrom) / fadeDur, 0, 1)) : 1;
    const B = nearest(cur);
    if (!B) return;
    const A = f < 1 && prev >= 0 ? nearest(prev) : null;
    if (dirty || B !== shown.b || A !== shown.a || f !== shown.alpha) {
      paint(A, B, f);
      stats.draws++;
      if (store.get(cur) === B) stats.exact++;
      else stats.stood_in++;
      if (A) stats.fades++;
      shown = { a: A, b: B, alpha: f };
      dirty = false;
    }
    if (f >= 1) prev = -1;
    else schedule(); // keep drawing until the dissolve has finished, even if the scroll has stopped
  }
  function schedule() {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      render(performance.now());
    });
  }

  function update(p) {
    x = clamp(p, 0, 1) * (count - 1);
    const next = Math.round(x);
    let changed = false;
    if (next !== cur && Math.abs(x - cur) >= HOLD) {
      changed = true;
      const t = performance.now();
      // the frame that is mostly visible now becomes the one that fades out
      const visible = prev >= 0 ? smooth(clamp((t - fadeFrom) / fadeDur, 0, 1)) : 1;
      if (visible > 0.5 || prev < 0) prev = cur;
      cur = next;
      fadeDur = clamp((t - lastChange) * 0.85, FADE_MIN, FADE_MAX); // fast scrolling: near-instant swaps; slow scrolling: gentle dissolves
      fadeFrom = t;
      lastChange = t;
    }
    store.focus(cur);
    // a new frame starts its dissolve on the next animation frame (one paint per display frame, however many scroll events arrive)
    if (changed) schedule();
    else render(performance.now());
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
    ctx.imageSmoothingQuality = 'high';
    store.setTarget(stacked() ? W : Math.max(W, (H * fw) / fh));
    dirty = true;
    render(performance.now());
  }
  resize();
  window.addEventListener('resize', resize);

  store.listeners.add(() => render(performance.now()));
  store.load();

  return {
    count,
    name,
    stats,
    state: () => ({ x: +x.toFixed(2), cur, prev, resting: prev < 0 }),
    ready: store.ready,
    get loaded() {
      return store.loaded;
    },
    update,
  };
}
