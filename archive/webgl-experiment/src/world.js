// The night-time world: forecourt, road, city, the control-room radar layer and the client premises.
import * as THREE from 'three';
import { state } from './state.js';

export const TOWER = new THREE.Vector3(-35, 0, -45);
export const PREMISES = new THREE.Vector3(17.5, 0, -90);
export const BASE = new THREE.Vector3(0, 0, 0);

/* ------------------------------------------------------------------ van route */

const routeXZ = [
  [0, 0],
  [0.9, 2.5],
  [-1.2, 6.2],
  [-5.0, 7.0],
  [-8.0, 3.6],
  [-6.2, -2.4],
  [-3.0, -9],
  [-2.5, -22],
  [-2.5, -45],
  [-2.5, -66],
  [-2.5, -76],
  [-2.4, -80],
  [-1.9, -83.4],
  [-0.9, -86.2],
  [0.5, -88.4],
  [2.1, -90.1],
];
export const ROUTE = new THREE.CatmullRomCurve3(routeXZ.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
ROUTE.arcLengthDivisions = 1500;
export const ROUTE_LEN = ROUTE.getLength();

// Speed profile along the timeline: ease out of the forecourt, cruise, then hard constant braking
// that ends abruptly - that sudden release is what makes the suspension rebound.
const LUT_N = 600;
const lut = new Float32Array(LUT_N + 1);
function speedAt(tau) {
  const a = 0.17;
  const b = 0.8;
  if (tau < a) {
    const s = tau / a;
    return s * s * (3 - 2 * s);
  }
  if (tau < b) return 1;
  return 1 - (tau - b) / (1 - b);
}
for (let i = 1; i <= LUT_N; i++) lut[i] = lut[i - 1] + speedAt((i - 0.5) / LUT_N) / LUT_N;
for (let i = 1; i <= LUT_N; i++) lut[i] /= lut[LUT_N];
export function routeU(tau) {
  const f = THREE.MathUtils.clamp(tau, 0, 1) * LUT_N;
  const i = Math.min(LUT_N - 1, Math.floor(f));
  return lut[i] + (lut[i + 1] - lut[i]) * (f - i);
}

/* ------------------------------------------------------------------ small helpers */

function mulberry32(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvasTex(w, h, draw, { repeat, aniso = 4, srgb = true } = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(...repeat);
  }
  return t;
}

const glowTex = () =>
  canvasTex(128, 128, (ctx) => {
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.45)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
  });

const ringTex = () =>
  canvasTex(128, 128, (ctx) => {
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(64, 64, 46, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 3;
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      ctx.beginPath();
      ctx.moveTo(64 + Math.cos(a) * 52, 64 + Math.sin(a) * 52);
      ctx.lineTo(64 + Math.cos(a) * 62, 64 + Math.sin(a) * 62);
      ctx.stroke();
    }
  });

const beamTex = () =>
  canvasTex(8, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, h, 0, 0);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.15, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });

const PINK = new THREE.Color('#ff3d9a');
const PINK_DEEP = new THREE.Color('#e4348a');

/* ------------------------------------------------------------------ world */

export function buildWorld(scene, { aniso = 4 } = {}) {
  const world = new THREE.Group();
  scene.add(world);
  const mapGroup = new THREE.Group();
  world.add(mapGroup);
  const fades = []; // { mat, base } - everything that belongs to the radar layer
  const fade = (mat, base = 1) => {
    mat.transparent = true;
    fades.push({ mat, base });
    return mat;
  };

  const glow = glowTex();
  const ring = ringTex();
  const beamT = beamTex();

  /* ---- sky dome */
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(700, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `varying vec3 vDir;
        void main(){
          float h = clamp(vDir.y, 0.0, 1.0);
          vec3 top = vec3(0.004,0.003,0.010);
          vec3 hor = vec3(0.040,0.016,0.046);
          vec3 col = mix(hor, top, pow(h, 0.45));
          col += vec3(0.20,0.05,0.13) * exp(-h*16.0) * 0.30;
          gl_FragColor = vec4(col, 1.0);
        }`,
    }),
  );
  world.add(sky);

  /* ---- ground, road, forecourt */
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(1400, 1400),
    new THREE.MeshStandardMaterial({ color: 0x0a0910, roughness: 0.9, metalness: 0 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.02;
  ground.receiveShadow = true;
  world.add(ground);

  const asphalt = canvasTex(
    240,
    480,
    (ctx, w, h) => {
      ctx.fillStyle = '#15141a';
      ctx.fillRect(0, 0, w, h);
      const r = mulberry32(7);
      for (let i = 0; i < 9000; i++) {
        const v = 14 + r() * 26;
        ctx.fillStyle = `rgba(${v},${v},${v + 4},${0.25 + r() * 0.4})`;
        ctx.fillRect(r() * w, r() * h, 1 + r() * 1.4, 1 + r() * 1.4);
      }
      ctx.fillStyle = 'rgba(236,236,240,0.78)';
      for (const x of [14, w - 14]) ctx.fillRect(x - 3, 0, 6, h); // edge lines
      for (let k = 0; k < 3; k++) ctx.fillRect(w / 2 - 3, k * 160 + 20, 6, 60); // centre dashes
    },
    { repeat: [1, 140 / 24], aniso },
  );
  const road = new THREE.Mesh(
    new THREE.PlaneGeometry(12, 140),
    new THREE.MeshStandardMaterial({ map: asphalt, roughness: 0.52, metalness: 0.1, envMapIntensity: 0.7 }),
  );
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0.006, -62);
  road.receiveShadow = true;
  world.add(road);

  const pavers = canvasTex(
    512,
    512,
    (ctx, w, h) => {
      ctx.fillStyle = '#17110f';
      ctx.fillRect(0, 0, w, h);
      const r = mulberry32(21);
      const cw = 24;
      const ch = 12;
      for (let y = 0; y < h / ch; y++) {
        for (let x = -1; x < w / cw; x++) {
          const off = (y % 2) * (cw / 2);
          const v = r();
          const R = 54 + v * 26;
          const G = 38 + v * 14;
          const B = 40 + v * 14;
          ctx.fillStyle = `rgb(${R | 0},${G | 0},${B | 0})`;
          ctx.fillRect(x * cw + off + 1, y * ch + 1, cw - 2, ch - 2);
        }
      }
    },
    { repeat: [28 / 6, 28 / 6], aniso },
  );
  const padAlpha = canvasTex(
    256,
    256,
    (ctx, w, h) => {
      const g = ctx.createRadialGradient(w / 2, h / 2, w * 0.18, w / 2, h / 2, w * 0.5);
      g.addColorStop(0, '#fff');
      g.addColorStop(0.8, '#fff');
      g.addColorStop(1, '#000');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    },
    { srgb: false },
  );
  const pad = new THREE.Mesh(
    new THREE.PlaneGeometry(36, 34),
    new THREE.MeshStandardMaterial({ map: pavers, alphaMap: padAlpha, transparent: true, roughness: 0.55, metalness: 0.15, envMapIntensity: 0.7 }),
  );
  pad.rotation.x = -Math.PI / 2;
  pad.position.set(0, 0.012, 5);
  pad.receiveShadow = true;
  world.add(pad);

  /* ---- street lamps (instanced) */
  const lampPos = [];
  for (let i = 0; i < 8; i++) lampPos.push({ z: 4 - i * 17, side: i % 2 ? 1 : -1 });
  const poleG = new THREE.CylinderGeometry(0.06, 0.09, 8.2, 8);
  poleG.translate(0, 4.1, 0);
  const lampDark = new THREE.MeshStandardMaterial({ color: 0x15141a, roughness: 0.6, metalness: 0.6 });
  const poles = new THREE.InstancedMesh(poleG, lampDark, lampPos.length);
  const arms = new THREE.InstancedMesh(new THREE.BoxGeometry(2.2, 0.08, 0.08), lampDark, lampPos.length);
  const headMat = new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(3.2, 3.3, 3.8) });
  const heads = new THREE.InstancedMesh(new THREE.BoxGeometry(0.95, 0.1, 0.34), headMat, lampPos.length);
  const groundGlow = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(13, 13),
    new THREE.MeshBasicMaterial({ map: glow, color: new THREE.Color(0.07, 0.09, 0.15), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
    lampPos.length,
  );
  const hp = [];
  const m4 = new THREE.Matrix4();
  lampPos.forEach((l, i) => {
    const x = l.side * 7.1;
    m4.makeTranslation(x, 0, l.z);
    poles.setMatrixAt(i, m4);
    m4.makeTranslation(x - l.side * 1.1, 8.15, l.z);
    arms.setMatrixAt(i, m4);
    m4.makeTranslation(x - l.side * 2.1, 8.08, l.z);
    heads.setMatrixAt(i, m4);
    hp.push(x - l.side * 2.1, 8.0, l.z);
    m4.makeRotationX(-Math.PI / 2);
    m4.setPosition(x - l.side * 2.1, 0.03, l.z);
    groundGlow.setMatrixAt(i, m4);
  });
  groundGlow.renderOrder = 2;
  world.add(poles, arms, heads, groundGlow);
  const halo = new THREE.Points(
    new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(hp, 3)),
    new THREE.PointsMaterial({ map: glow, size: 7, color: new THREE.Color(0.55, 0.62, 1.0), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true }),
  );
  world.add(halo);

  /* ---- city blocks with lit windows */
  let cityMesh = null;
  {
    const winTex = canvasTex(
      128,
      128,
      (ctx, w, h) => {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, w, h);
        const r = mulberry32(99);
        const cols = [
          [255, 208, 140],
          [255, 226, 180],
          [180, 210, 255],
          [255, 110, 180],
        ];
        for (let y = 0; y < 4; y++)
          for (let x = 0; x < 4; x++) {
            if (r() > 0.34) continue;
            const c = cols[r() < 0.08 ? 3 : r() < 0.3 ? 2 : r() < 0.6 ? 1 : 0];
            ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
            ctx.fillRect(x * 32 + 7, y * 32 + 9, 18, 14);
          }
      },
      { aniso: 2 },
    );
    winTex.wrapS = winTex.wrapT = THREE.RepeatWrapping;
    winTex.magFilter = THREE.NearestFilter;
    const rnd = mulberry32(2026);
    const pos = [];
    const nor = [];
    const uvs = [];
    const idx = [];
    const quad = (a, b, c, d, n, uva, uvb) => {
      const o = pos.length / 3;
      pos.push(...a, ...b, ...c, ...d);
      for (let i = 0; i < 4; i++) nor.push(...n);
      uvs.push(uva[0], uva[1], uvb[0], uva[1], uvb[0], uvb[1], uva[0], uvb[1]);
      idx.push(o, o + 1, o + 2, o, o + 2, o + 3);
    };
    const blocked = (x, z, w, d) => {
      const rect = (x0, x1, z0, z1, pad = 0) => x + w / 2 > x0 - pad && x - w / 2 < x1 + pad && z + d / 2 > z0 - pad && z - d / 2 < z1 + pad;
      return (
        rect(-30, 30, -140, 60) || // road corridor + forecourt, kept clear so the hero isn't boxed in
        rect(2, 34, -106, -74) || // premises
        rect(TOWER.x - 11, TOWER.x + 11, TOWER.z - 11, TOWER.z + 11) ||
        z > 40
      );
    };
    let placed = 0;
    for (let tries = 0; tries < 900 && placed < 200; tries++) {
      const w = 7 + rnd() * 16;
      const d = 7 + rnd() * 16;
      const x = (rnd() * 2 - 1) * 150;
      const z = 36 - rnd() * 210;
      if (blocked(x, z, w, d)) continue;
      const near = Math.hypot(x, z + 40) < 70;
      const h = (near ? 4 : 5) + Math.pow(rnd(), 2.2) * (near ? 11 : 22);
      const ou = rnd();
      const ov = rnd();
      const k = 1 / 12.8;
      const x0 = x - w / 2;
      const x1 = x + w / 2;
      const z0 = z - d / 2;
      const z1 = z + d / 2;
      quad([x0, 0, z1], [x1, 0, z1], [x1, h, z1], [x0, h, z1], [0, 0, 1], [ou, ov], [ou + w * k, ov + h * k]);
      quad([x1, 0, z0], [x0, 0, z0], [x0, h, z0], [x1, h, z0], [0, 0, -1], [ou + 0.3, ov], [ou + 0.3 + w * k, ov + h * k]);
      quad([x1, 0, z1], [x1, 0, z0], [x1, h, z0], [x1, h, z1], [1, 0, 0], [ou + 0.6, ov], [ou + 0.6 + d * k, ov + h * k]);
      quad([x0, 0, z0], [x0, 0, z1], [x0, h, z1], [x0, h, z0], [-1, 0, 0], [ou + 0.1, ov], [ou + 0.1 + d * k, ov + h * k]);
      quad([x0, h, z1], [x1, h, z1], [x1, h, z0], [x0, h, z0], [0, 1, 0], [0.02, 0.02], [0.03, 0.03]);
      placed++;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex(idx);
    const city = new THREE.Mesh(
      g,
      new THREE.MeshStandardMaterial({ color: 0x0c0b13, roughness: 0.85, metalness: 0.1, emissive: 0xffffff, emissiveMap: winTex, emissiveIntensity: 0.8 }),
    );
    world.add(city);
    cityMesh = city;
  }

  /* ---- control-room radar layer (ground overlay) */
  const overlayMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
    uniforms: {
      uMap: { value: 0 },
      uTime: { value: 0 },
      uTower: { value: new THREE.Vector2(TOWER.x, TOWER.z) },
      uPink: { value: PINK.clone() },
    },
    vertexShader: 'varying vec2 vXZ; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vXZ = w.xz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `varying vec2 vXZ; uniform float uMap, uTime; uniform vec2 uTower; uniform vec3 uPink;
      float gridLine(vec2 p, float size, float w){
        vec2 q = p / size;
        vec2 fw = max(fwidth(q), vec2(1e-5));
        vec2 g = abs(fract(q - 0.5) - 0.5) / fw;
        return 1.0 - smoothstep(0.0, w, min(g.x, g.y));
      }
      void main(){
        vec2 p = vXZ;
        float g = gridLine(p, 10.0, 1.0) * 0.12 + gridLine(p, 50.0, 1.3) * 0.34
                + gridLine(p + vec2(13.0, 7.0), 37.0, 1.1) * 0.10 + gridLine(p + vec2(-21.0, 31.0), 61.0, 1.1) * 0.12;
        vec2 d = p - uTower;
        float r = length(d);
        float fr = max(fwidth(r), 1e-4);
        float rings = 0.0;
        for (int i = 1; i <= 5; i++) { float R = float(i) * 45.0; rings += 1.0 - smoothstep(0.0, 1.6 * fr, abs(r - R)); }
        float ang = atan(d.y, d.x + 1e-5);
        float sw = fract(uTime * 0.22 - ang / 6.2831853);
        float reach = 1.0 - smoothstep(20.0, 300.0, r);
        float sweep = pow(max(1.0 - sw, 0.0), 7.0) * reach;
        float line = (1.0 - smoothstep(0.0, 0.006, sw)) * reach;
        // the main road, picked out in brighter pink
        float road = (1.0 - smoothstep(5.0, 6.2, abs(p.x))) * step(p.y, 10.0) * step(-135.0, p.y);
        float fade = 1.0 - smoothstep(40.0, 330.0, length(p - vec2(0.0, -45.0)));
        vec3 col = uPink * (g * 0.9 + rings * 0.5 + sweep * 0.5 + road * 0.08) + vec3(1.0, 0.7, 0.9) * line * 0.12;
        gl_FragColor = vec4(max(col, vec3(0.0)) * uMap * fade, 1.0);
      }`,
  });
  const overlay = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), overlayMat);
  overlay.rotation.x = -Math.PI / 2;
  overlay.position.y = 0.05;
  overlay.renderOrder = 3;
  mapGroup.add(overlay);

  /* ---- control room tower */
  const towerGroup = new THREE.Group();
  towerGroup.position.copy(TOWER);
  world.add(towerGroup);
  const towerMat = new THREE.MeshStandardMaterial({ color: 0x1a1621, roughness: 0.5, metalness: 0.5, emissive: PINK_DEEP, emissiveIntensity: 0.1 });
  const hall = new THREE.Mesh(new THREE.BoxGeometry(13, 3.4, 8), towerMat);
  hall.position.y = 1.7;
  const deskLight = new THREE.Mesh(
    new THREE.BoxGeometry(12.6, 0.9, 0.2),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 0.9, 1.8) }),
  );
  deskLight.position.set(0, 2.2, 4.02);
  const col = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.6, 12, 10), towerMat);
  col.position.set(0, 9.4, 0);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.18, 12, 6), towerMat);
  mast.position.y = 21;
  const beaconMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.4, 0.2, 0.7) });
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.75, 16, 12), beaconMat);
  beacon.position.y = 27.4;
  const haloRing = new THREE.Mesh(new THREE.TorusGeometry(4.2, 0.1, 8, 64), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 0.3, 0.8) }));
  haloRing.rotation.x = Math.PI / 2;
  haloRing.position.y = 16;
  towerGroup.add(hall, deskLight, col, mast, beacon, haloRing);
  const towerBeamMat = fade(new THREE.MeshBasicMaterial({ map: beamT, color: PINK, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }), 0.5);
  const towerBeam = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 2.4, 130, 16, 1, true), towerBeamMat);
  towerBeam.position.set(TOWER.x, 65, TOWER.z);
  mapGroup.add(towerBeam);

  /* ---- client premises */
  const prem = new THREE.Group();
  world.add(prem);
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x15131c, roughness: 0.8, metalness: 0.1 });
  const houseMat = new THREE.MeshStandardMaterial({ color: 0x1a1822, roughness: 0.85 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x0e0d14, roughness: 0.9 });
  const house = new THREE.Mesh(new THREE.BoxGeometry(11, 4.2, 12), houseMat);
  house.position.set(17.5, 2.1, -90);
  house.castShadow = house.receiveShadow = true;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(8.4, 2.4, 4), roofMat);
  roof.rotation.y = Math.PI / 4;
  roof.position.set(17.5, 5.4, -90);
  const winMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.7, 1.2, 0.65) });
  for (const z of [-94, -90, -86]) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.2), winMat);
    w.rotation.y = -Math.PI / 2;
    w.position.set(11.98, 2.1, z);
    prem.add(w);
  }
  const strobeMat = new THREE.MeshStandardMaterial({ color: 0x33000f, emissive: new THREE.Color(1, 0.1, 0.35), emissiveIntensity: 0 });
  const strobe = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.5, 0.5), strobeMat);
  strobe.position.set(11.85, 3.5, -92.6);
  const strobeGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: new THREE.Color(1, 0.15, 0.4), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
  strobeGlow.scale.setScalar(6);
  strobeGlow.position.copy(strobe.position).add(new THREE.Vector3(-0.3, 0, 0));
  prem.add(house, roof, strobe, strobeGlow);

  // frontage wall + gate
  const addWall = (z0, z1) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.5, Math.abs(z1 - z0)), wallMat);
    m.position.set(8.5, 0.75, (z0 + z1) / 2);
    m.castShadow = m.receiveShadow = true;
    prem.add(m);
  };
  addWall(-106, -93.4);
  addWall(-86.6, -72);
  const postMat = new THREE.MeshStandardMaterial({ color: 0x1d1a25, roughness: 0.6, metalness: 0.3 });
  const senseMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 1.2, 1.6) });
  for (const z of [-93.4, -86.6]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.55, 2.2, 0.55), postMat);
    p.position.set(8.5, 1.1, z);
    p.castShadow = true;
    const lens = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.12), senseMat);
    lens.position.set(8.2, 1.6, z);
    prem.add(p, lens);
  }
  const gate = new THREE.Group();
  const barMat = new THREE.MeshStandardMaterial({ color: 0x2a2733, roughness: 0.45, metalness: 0.8 });
  for (let i = 0; i <= 14; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.5, 0.05), barMat);
    b.position.set(0, 0.8, -2.9 + (i * 5.8) / 14);
    gate.add(b);
  }
  for (const y of [0.15, 1.5]) {
    const r = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.08, 5.9), barMat);
    r.position.set(0, y, 0);
    gate.add(r);
  }
  const gateStripe = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.1, 5.9), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 0.3, 0.9) }));
  gateStripe.position.set(0, 0.82, 0);
  gate.add(gateStripe);
  gate.position.set(8.2, 0, -90);
  prem.add(gate);

  // perimeter beams across the opening
  const laserMats = [];
  for (const y of [0.35, 0.85, 1.35]) {
    const mat = new THREE.MeshBasicMaterial({ color: PINK.clone(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 6.8), mat);
    b.position.set(8.18, y, -90);
    b.renderOrder = 5;
    prem.add(b);
    laserMats.push(mat);
  }

  // CCTV pole with a sweeping field of view
  const cctv = new THREE.Group();
  cctv.position.set(7.6, 0, -79);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 4.6, 8), lampDark);
  pole.position.y = 2.3;
  const head = new THREE.Group();
  head.position.y = 4.55;
  const camBody = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.22, 0.24), postMat);
  camBody.position.x = -0.2;
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.1, 0.1) }));
  led.position.set(-0.5, 0.06, 0.13);
  const fov = new THREE.Mesh(
    new THREE.ConeGeometry(2.4, 8, 24, 1, true),
    new THREE.MeshBasicMaterial({ color: PINK, transparent: true, opacity: 0.05, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
  );
  fov.geometry.translate(0, -4, 0);
  fov.geometry.rotateZ(Math.PI / 2 + 0.62);
  fov.geometry.rotateZ(Math.PI);
  fov.position.set(-0.45, -0.05, 0);
  head.add(camBody, led, fov);
  cctv.add(pole, head);
  prem.add(cctv);

  /* ---- radar-layer objects: node, rings, arcs, route, markers */
  const nodePos = new THREE.Vector3(PREMISES.x, 9, PREMISES.z);
  const nodeMat = fade(new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 0.35, 1.0), fog: false }), 1);
  const node = new THREE.Mesh(new THREE.OctahedronGeometry(1.5), nodeMat);
  node.position.copy(nodePos);
  mapGroup.add(node);
  const nodeBeamMat = fade(new THREE.MeshBasicMaterial({ map: beamT, color: PINK, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }), 0.9);
  const nodeBeam = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.2, 150, 14, 1, true), nodeBeamMat);
  nodeBeam.position.set(PREMISES.x, 75, PREMISES.z);
  mapGroup.add(nodeBeam);

  const makeRipple = (pos, mat) => {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 64), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.copy(pos).setY(0.2);
    m.renderOrder = 4;
    mapGroup.add(m);
    return m;
  };
  const rippleMatA = fade(new THREE.MeshBasicMaterial({ color: PINK, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }), 1);
  const rippleMatB = fade(new THREE.MeshBasicMaterial({ color: PINK, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }), 1);
  const rippleNode = makeRipple(PREMISES, rippleMatA);
  const rippleTower = makeRipple(TOWER, rippleMatB);

  const towerTop = new THREE.Vector3(TOWER.x, 27, TOWER.z);
  const baseTop = new THREE.Vector3(0.3, 3, 0);
  const arc = (a, b, lift) => {
    const mid = a.clone().lerp(b, 0.5);
    mid.y += lift;
    return new THREE.QuadraticBezierCurve3(a, mid, b);
  };
  const arcs = [arc(nodePos, towerTop, 48), arc(towerTop, baseTop, 52)];
  const arcMeshes = arcs.map((c) => {
    const g = new THREE.TubeGeometry(c, 80, 0.5, 5, false);
    const mat = fade(new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 0.35, 0.85), blending: THREE.AdditiveBlending, depthWrite: false, fog: false }), 1);
    const m = new THREE.Mesh(g, mat);
    m.geometry.setDrawRange(0, 0);
    mapGroup.add(m);
    return m;
  });
  const pulseMats = [0, 1].map(() =>
    fade(new THREE.SpriteMaterial({ map: glow, color: new THREE.Color(2, 1.4, 1.9), blending: THREE.AdditiveBlending, depthWrite: false, fog: false }), 1),
  );
  const pulses = pulseMats.map((m) => {
    const s = new THREE.Sprite(m);
    s.scale.setScalar(14);
    mapGroup.add(s);
    return s;
  });

  const routeGeo = new THREE.TubeGeometry(ROUTE, 420, 0.5, 5, false);
  const routeIdx = routeGeo.index.count;
  const routeDim = new THREE.Mesh(routeGeo, fade(new THREE.MeshBasicMaterial({ color: PINK, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }), 0.16));
  const routeLive = new THREE.Mesh(routeGeo.clone(), fade(new THREE.MeshBasicMaterial({ color: new THREE.Color(1.8, 0.4, 0.95), blending: THREE.AdditiveBlending, depthWrite: false, fog: false }), 0.95));
  routeLive.geometry.setDrawRange(0, 0);
  mapGroup.add(routeDim, routeLive);

  const markers = {};
  for (const [k, c] of [
    ['unit', new THREE.Color(2.2, 1.7, 2.0)],
    ['tower', new THREE.Color(1.8, 0.5, 1.2)],
    ['node', new THREE.Color(2, 0.3, 0.9)],
  ]) {
    const mat = fade(new THREE.SpriteMaterial({ map: ring, color: c, depthTest: false, depthWrite: false, sizeAttenuation: false, fog: false, blending: THREE.AdditiveBlending }), 1);
    const s = new THREE.Sprite(mat);
    s.renderOrder = 9;
    mapGroup.add(s);
    markers[k] = s;
  }
  markers.tower.position.set(TOWER.x, 1, TOWER.z);
  markers.node.position.set(PREMISES.x, 1, PREMISES.z);

  /* ---- per-frame update */
  const tmp = new THREE.Vector3();
  const laserHot = new THREE.Color(2.2, 0.35, 1.0);
  const laserCalm = new THREE.Color(0.25, 0.5, 1.0);
  const setDraw = (mesh, total, p, stride) => mesh.geometry.setDrawRange(0, Math.floor(THREE.MathUtils.clamp(p, 0, 1) * total) * stride);

  function update(t, carPos) {
    const m = state.mapMix;
    mapGroup.visible = m > 0.003;
    if (cityMesh) cityMesh.scale.y = 1 - 0.78 * m; // blocks sink into a flat map as we rise
    for (const f of fades) f.mat.opacity = f.base * m;
    overlayMat.uniforms.uMap.value = m;
    overlayMat.uniforms.uTime.value = t;

    // alarm node
    const alert = state.alarm * (1 - state.cleared);
    node.rotation.y = t * 1.2;
    node.scale.setScalar(0.35 + state.alarm * (1 + 0.15 * Math.sin(t * 9)));
    nodeBeam.scale.set(0.2 + state.alarm, state.alarm, 0.2 + state.alarm);
    nodeBeam.position.y = 75 * state.alarm;
    nodeBeam.visible = state.alarm > 0.01;

    // ripples loop while active
    const loop = (t * 0.55) % 1;
    const rn = state.alarm * (1 - state.cleared * 0.9);
    rippleNode.scale.setScalar(2 + loop * 46);
    rippleMatA.opacity = (1 - loop) * rn * m * 0.9;
    const lt = (t * 0.6 + 0.35) % 1;
    rippleTower.scale.setScalar(2 + lt * 55);
    rippleMatB.opacity = (1 - lt) * state.tower * m * 0.8;

    // arcs + travelling pulses
    const sigs = [state.sig1, state.sig2];
    arcMeshes.forEach((mesh, i) => {
      setDraw(mesh, 80, sigs[i], 5 * 6);
      const s = sigs[i];
      pulses[i].visible = s > 0.001 && s < 0.999;
      arcs[i].getPoint(THREE.MathUtils.clamp(s, 0, 1), tmp);
      pulses[i].position.copy(tmp);
      pulses[i].scale.setScalar(12 + Math.sin(t * 18) * 2.5);
    });

    // tower
    towerMat.emissiveIntensity = 0.12 + state.tower * (1.4 - 1.0 * state.cleared);
    beaconMat.color.setRGB(1.2 + state.tower * 2.2, 0.2 + state.tower * 0.5, 0.7 + state.tower * 0.6);
    beacon.scale.setScalar(1 + state.tower * 0.5 + Math.sin(t * 6) * 0.12 * state.tower);
    haloRing.rotation.z = t * 0.8;
    haloRing.scale.setScalar(1 + state.tower * 0.15);
    towerBeam.scale.set(1, 0.001 + state.tower, 1);
    towerBeam.position.y = 65 * state.tower;

    // route + markers
    setDraw(routeLive, 420, state.routeU ?? 0, 5 * 6);
    markers.unit.position.set(carPos.x, 1, carPos.z);
    markers.unit.scale.setScalar(0.05 + 0.006 * Math.sin(t * 6) + state.sig2 * 0.012);
    markers.tower.scale.setScalar(0.05);
    markers.node.scale.setScalar(0.05 + state.alarm * 0.012 * Math.sin(t * 8));

    // premises: strobe, lasers, gate, cctv
    const blink = alert * (0.5 + 0.5 * Math.sin(t * 14));
    strobeMat.emissiveIntensity = blink * 5;
    strobeGlow.material.opacity = blink * 0.9;
    strobeGlow.visible = blink > 0.02;
    const flick = 0.75 + 0.25 * Math.sin(t * 31) * Math.sin(t * 7.3);
    laserMats.forEach((mat, i) => {
      mat.color.copy(laserCalm).lerp(laserHot, alert).multiplyScalar(alert > 0.05 ? flick * (1.1 + i * 0.08) : 0.55);
    });
    gate.position.z = -90 + state.gate * 6.4;
    head.rotation.y = Math.sin(t * 0.7) * 0.55 + 0.3;
    led.visible = Math.sin(t * 4) > -0.3;
    senseMat.color.setRGB(0.2, 1.2, 1.6).lerp(new THREE.Color(2.2, 0.4, 0.9), alert * 0.8);
  }

  return {
    update,
    towerPos: towerTop,
    nodePos,
    setRouteU(u) {
      state.routeU = u;
    },
  };
}
