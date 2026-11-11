// The studio kit: everything that makes a scene read as a photograph of real objects rather than a render with default lighting.
//
//  - Lighting is the biggest factor: a dark studio with large softboxes, baked into an environment map (PMREMGenerator). Metal and
//    glass have something to reflect, and that is most of what reads as real. Key and rim lights add to it, and soft shadows are
//    drawn once, because nothing that casts a shadow moves. ACES filmic tone mapping rolls highlights off like a camera.
//  - Textures (brushed metal, grain, plaster relief, screens) are generated in code. Nothing is downloaded.
//  - The floor is polished dark stone: a blurred reflection that strengthens at grazing angles, faint mineral grain, and an edge
//    that dissolves into the dark.
//
// This follows the approach of the Ekhaya site's WaterScene, so the sites share one look.
import * as THREE from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';

export const smooth = (a, b, x) => {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return k * k * (3 - 2 * k);
};
export const lerp = THREE.MathUtils.lerp;

export const BG = new THREE.Color('#07060b');
export const DECALS = 1; // layer for floor dressing kept out of the mirror

/* ---------- context ---------- */

// (lives in its own file so the page can use it without loading three.js)
export { fast3DContext } from './context.js';

/* ---------- lighting ---------- */

// A dark studio with large softboxes. The panels are what the metal and glass reflect: tall strips down the sides draw the long
// highlights along a cylinder; the big overhead panel lights the tops; the low card in front is what the front faces mirror.
export function studioEnvironment() {
  const env = new THREE.Scene();
  env.add(new THREE.Mesh(new THREE.BoxGeometry(30, 18, 30), new THREE.MeshBasicMaterial({ color: '#0d0b14', side: THREE.BackSide })));
  const panel = (w, h, at, intensity, color) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide }));
    m.position.set(...at);
    m.lookAt(0, 0, 0);
    env.add(m);
  };
  panel(9, 4.5, [-1, 7.5, 2], 5.5, '#f1f3ff'); // overhead key
  panel(1.5, 9, [-8, 1.5, 4], 3.4, '#dce4ff'); // left strip, cool
  panel(1.5, 9, [8, 2, -3], 2.4, '#ffd9ee'); // right strip, a touch of the brand pink
  panel(12, 5, [0, -1.5, 10], 1.6, '#e8e4ff'); // low fill card in front: what the front faces mirror
  panel(6, 3, [4, 5, 9], 2.0, '#ffffff'); // high front fill
  panel(14, 3, [0, 1, -10], 0.7, '#8d5cff'); // violet back wall
  panel(16, 16, [0, -7, 0], 0.08, '#2a1840'); // floor bounce
  return env;
}

/* ---------- procedural textures ---------- */

// Seeded value noise, tileable with the given period (in lattice cells).
function noiseFn(seed, period) {
  const rnd = (i, j) => {
    let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(seed, 2147483647)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  };
  return (x, y) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);
    const m = (n) => ((n % period) + period) % period;
    const a = rnd(m(xi), m(yi));
    const b = rnd(m(xi + 1), m(yi));
    const c = rnd(m(xi), m(yi + 1));
    const d = rnd(m(xi + 1), m(yi + 1));
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}

export function dataTexture(size, data, srgb = false) {
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 8;
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

// Brushed metal: long streaks along x, as a roughness variation (three reads the green channel).
export function brushedTexture(size = 256) {
  const data = new Uint8Array(size * size * 4);
  const long = noiseFn(3, size / 64);
  const fine = noiseFn(9, size / 2);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const streak = long((x / size) * (size / 64) * 0.5, (y / size) * (size / 2) * 0.45);
      const speck = fine((x / size) * (size / 2) * 1.0, (y / size) * (size / 2) * 4.0);
      const v = Math.min(1, Math.max(0, 0.6 + (streak - 0.5) * 0.32 + (speck - 0.5) * 0.08));
      const o = (y * size + x) * 4;
      data[o] = data[o + 1] = data[o + 2] = Math.round(v * 255);
      data[o + 3] = 255;
    }
  }
  return dataTexture(size, data);
}

// Fine isotropic grain, for powder-coat and stone.
export function grainTexture(size = 256) {
  const data = new Uint8Array(size * size * 4);
  const n1 = noiseFn(5, size / 2);
  const n2 = noiseFn(11, size / 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const v = Math.min(1, Math.max(0, 0.6 + (n1(x / 2, y / 2) - 0.5) * 0.4 + (n2(x / 4, y / 4) - 0.5) * 0.25));
      const o = (y * size + x) * 4;
      data[o] = data[o + 1] = data[o + 2] = Math.round(v * 255);
      data[o + 3] = 255;
    }
  }
  return dataTexture(size, data);
}

// Plaster / concrete relief as a normal map, from fractal noise (tileable).
export function plasterNormalTexture(size = 256) {
  const octaves = [noiseFn(21, size / 8), noiseFn(22, size / 16), noiseFn(23, size / 32), noiseFn(24, size / 64)];
  const h = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let v = 0;
      let amp = 1;
      let f = 1;
      for (const n of octaves) {
        v += n((x / 8) * f, (y / 8) * f) * amp;
        amp *= 0.5;
        f *= 2;
      }
      h[y * size + x] = v;
    }
  }
  const data = new Uint8Array(size * size * 4);
  const at = (x, y) => h[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * 2.2;
      const dy = (at(x, y + 1) - at(x, y - 1)) * 2.2;
      const l = Math.hypot(dx, dy, 1);
      const o = (y * size + x) * 4;
      data[o] = Math.round(((-dx / l) * 0.5 + 0.5) * 255);
      data[o + 1] = Math.round(((-dy / l) * 0.5 + 0.5) * 255);
      data[o + 2] = Math.round(((1 / l) * 0.5 + 0.5) * 255);
      data[o + 3] = 255;
    }
  }
  return dataTexture(size, data);
}

export function radialTexture(stops) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  for (const [at, color] of stops) grad.addColorStop(at, color);
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* ---------- the polished stone floor ---------- */

const NOISE2 = /* glsl */ `
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }
`;

// Polished dark stone: a softly blurred reflection that strengthens at grazing angles (Fresnel), faint mineral grain, and an edge
// that dissolves into the dark around uFocus (the point the camera is looking at).
export const FLOOR_SHADER = {
  name: 'PolishedStone',
  uniforms: {
    color: { value: null },
    tDiffuse: { value: null },
    textureMatrix: { value: null },
    uTexel: { value: new THREE.Vector2(1 / 1024, 1 / 1024) },
    uFocus: { value: new THREE.Vector2() },
    uReflect: { value: 0.95 },
  },
  vertexShader: /* glsl */ `
    uniform mat4 textureMatrix;
    varying vec4 vUv;
    varying vec3 vWorld;
    void main() {
      vUv = textureMatrix * vec4(position, 1.0);
      vec4 w = modelMatrix * vec4(position, 1.0);
      vWorld = w.xyz;
      gl_Position = projectionMatrix * viewMatrix * w;
    }
  `,
  fragmentShader: /* glsl */ `
    uniform vec3 color;
    uniform sampler2D tDiffuse;
    uniform vec2 uTexel;
    uniform vec2 uFocus;
    uniform float uReflect;
    varying vec4 vUv;
    varying vec3 vWorld;
    ${NOISE2}
    const vec2 TAPS[5] = vec2[5](vec2(0.0), vec2(1.0, 0.3), vec2(-0.3, 1.0), vec2(-1.0, -0.3), vec2(0.3, -1.0));
    void main() {
      vec2 uv = vUv.xy / vUv.w;
      float grain = noise(vWorld.xz * 7.0) * 0.55 + noise(vWorld.xz * 31.0) * 0.45;
      // Glossy, not mirror: read the reflection from blurred mip levels.
      // (the five taps sit well inside the blur of the mip they read, so they smooth it rather than draw five copies)
      float blur = 2.7 + 1.0 * noise(vWorld.xz * 1.3);
      vec3 refl = vec3(0.0);
      for (int i = 0; i < 5; i++) refl += texture2D(tDiffuse, uv + TAPS[i] * uTexel * 2.6, blur).rgb;
      refl = min(refl / 5.0, vec3(1.0));
      vec3 V = normalize(cameraPosition - vWorld);
      float fres = 0.05 + 0.95 * pow(1.0 - clamp(V.y, 0.0, 1.0), 4.0);
      vec3 c = color * (0.75 + 0.5 * grain) + refl * mix(0.06, uReflect, fres);
      float d = length(vWorld.xz - uFocus);
      gl_FragColor = vec4(c, 1.0 - smoothstep(7.0, 24.0, d));
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `,
};

// size: [width, height] of the floor in scene units; the mirror is drawn at a fraction of the screen's resolution
// (the reflection is blurred, so a low-resolution mirror is enough).
export function makeFloor(size, mirrorSize) {
  const [tw, th] = mirrorSize;
  const floor = new Reflector(new THREE.PlaneGeometry(size[0], size[1]), { color: 0x0e0c14, textureWidth: tw, textureHeight: th, clipBias: 0.003, shader: FLOOR_SHADER, multisample: 0 });
  floor.rotation.x = -Math.PI / 2;
  floor.material.transparent = true;
  const tex = floor.getRenderTarget().texture;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  floor.material.uniforms.uTexel.value.set(1 / tw, 1 / th);
  return floor;
}

// A soft contact shadow / light pool as a flat decal on the floor, kept out of the mirror (DECALS layer).
export function decal({ size, color = '#000000', opacity = 0.6, stops, additive = false, y = 0.004, order = 3 }) {
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    ...(additive ? { map: radialTexture(stops), blending: THREE.AdditiveBlending } : { alphaMap: radialTexture(stops) }),
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size[0], size[1]), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = y;
  mesh.renderOrder = order;
  mesh.layers.set(DECALS);
  return mesh;
}

/* ---------- renderer ---------- */

export function createRenderer(canvas, context, lowPower) {
  const renderer = new THREE.WebGLRenderer({ canvas, context, antialias: true, powerPreference: 'high-performance', failIfMajorPerformanceCaveat: true });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  // Nothing that casts a shadow moves, so the soft shadow map is drawn once.
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  return { renderer, maxPixelRatio: Math.min(window.devicePixelRatio || 1, lowPower ? 1.25 : 1.75) };
}
