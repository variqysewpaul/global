// The Global Security Solutions bakkie, built procedurally.
// Car space: +X forward, +Y up, +Z = driver's (right) side. Units are metres.
// Wheels live outside the `body` group so the body can pitch/roll/heave on its springs
// while the tyres stay planted, and the front wheels sit on steering pivots.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';

export const WHEELBASE = 2.66;
const AX = WHEELBASE / 2;
const WR = 0.31; // wheel radius
const TRACK = 0.71;
const PIVOT_Y = 0.55;

/* ------------------------------------------------------------------ geometry helpers */

// Polygon with optional per-corner rounding: pts = [x, y, radius?]
function roundedShape(pts) {
  const n = pts.length;
  const items = pts.map((p, i) => {
    const r = p[2] || 0;
    if (!r) return { pt: [p[0], p[1]] };
    const prev = pts[(i - 1 + n) % n];
    const next = pts[(i + 1) % n];
    const v1 = [prev[0] - p[0], prev[1] - p[1]];
    const v2 = [next[0] - p[0], next[1] - p[1]];
    const l1 = Math.hypot(...v1);
    const l2 = Math.hypot(...v2);
    const d1 = Math.min(r, l1 * 0.48);
    const d2 = Math.min(r, l2 * 0.48);
    return {
      a: [p[0] + (v1[0] / l1) * d1, p[1] + (v1[1] / l1) * d1],
      c: [p[0], p[1]],
      b: [p[0] + (v2[0] / l2) * d2, p[1] + (v2[1] / l2) * d2],
    };
  });
  const s = new THREE.Shape();
  const first = items[0];
  const start = first.pt || first.b;
  s.moveTo(start[0], start[1]);
  for (let i = 1; i < n; i++) {
    const it = items[i];
    if (it.pt) s.lineTo(it.pt[0], it.pt[1]);
    else {
      s.lineTo(it.a[0], it.a[1]);
      s.quadraticCurveTo(it.c[0], it.c[1], it.b[0], it.b[1]);
    }
  }
  if (!first.pt) {
    s.lineTo(first.a[0], first.a[1]);
    s.quadraticCurveTo(first.c[0], first.c[1], first.b[0], first.b[1]);
  }
  s.closePath();
  return s;
}

// Extrude a side profile across the vehicle width, with soft edges and a linear tumblehome.
function extrudeProfile(pts, { depth, bt = 0.08, bs = 0.045, y0, k }) {
  let g = new THREE.ExtrudeGeometry(roundedShape(pts), {
    depth,
    bevelEnabled: true,
    bevelThickness: bt,
    bevelSize: bs,
    bevelOffset: -bs,
    bevelSegments: 4,
    curveSegments: 10,
  });
  g.translate(0, 0, -depth / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) * (1 - k * (p.getY(i) - y0)));
  g = toCreasedNormals(g, 0.65);
  return g;
}

function arch(cx, r, n = 18) {
  const out = [];
  const a0 = -0.315;
  const a1 = Math.PI + 0.315;
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    out.push([cx + r * Math.cos(a), 0.31 + r * Math.sin(a), 0]);
  }
  return out;
}

// Flat decal on a (possibly tilted) side plane: z is linear in y so one quad is exact.
function sideDecal({ x0, x1, y0, y1, side, w0, y0ref, k, eps = 0.004 }) {
  const zAt = (y) => side * (w0 * (1 - k * (y - y0ref)) + eps);
  const pos = [x0, y0, zAt(y0), x1, y0, zAt(y0), x1, y1, zAt(y1), x0, y1, zAt(y1)];
  // u runs toward the front on the +Z side, toward the rear on the -Z side (reads left-to-right either way)
  const uv = side > 0 ? [0, 0, 1, 0, 1, 1, 0, 1] : [1, 0, 0, 0, 0, 1, 1, 1];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  g.computeVertexNormals();
  return g;
}

function quadGeo(p, uv) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p.flat(), 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv.flat(), 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  g.computeVertexNormals();
  return g;
}

/* ------------------------------------------------------------------ wheels */

function buildWheel(mats) {
  const spin = new THREE.Group();
  const prof = [
    [0.19, -0.095],
    [0.215, -0.098],
    [0.268, -0.092],
    [0.3, -0.07],
    [0.311, -0.03],
    [0.313, 0],
    [0.311, 0.03],
    [0.3, 0.07],
    [0.268, 0.092],
    [0.215, 0.098],
    [0.19, 0.095],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const tg = new THREE.LatheGeometry(prof, 56);
  tg.rotateX(Math.PI / 2);
  const tire = new THREE.Mesh(tg, mats.rubber);
  tire.castShadow = true;
  spin.add(tire);

  const disc = new THREE.Mesh(new THREE.CircleGeometry(0.195, 32), mats.rimDark);
  disc.material.side = THREE.DoubleSide;
  spin.add(disc);

  const brake = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.014, 32), mats.steel);
  brake.rotation.x = Math.PI / 2;
  brake.position.z = 0.04;
  spin.add(brake);
  const brake2 = brake.clone();
  brake2.position.z = -0.04;
  spin.add(brake2);

  const spokeGeo = new RoundedBoxGeometry(0.155, 0.036, 0.022, 2, 0.008);
  for (const zs of [-1, 1]) {
    const lip = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.011, 8, 48), mats.rim);
    lip.position.z = zs * 0.086;
    spin.add(lip);
    for (let k = 0; k < 5; k++) {
      for (const off of [-0.115, 0.115]) {
        const a = (k / 5) * Math.PI * 2 + off;
        const holder = new THREE.Group();
        holder.rotation.z = a;
        const sp = new THREE.Mesh(spokeGeo, mats.rim);
        sp.position.set(0.118, 0, zs * 0.078);
        sp.castShadow = false;
        holder.add(sp);
        spin.add(holder);
      }
    }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.056, 0.03, 24), mats.rim);
    hub.rotation.x = Math.PI / 2;
    hub.position.z = zs * 0.082;
    spin.add(hub);
    for (let n = 0; n < 5; n++) {
      const a = (n / 5) * Math.PI * 2;
      const nut = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.02, 8), mats.steel);
      nut.rotation.x = Math.PI / 2;
      nut.position.set(Math.cos(a) * 0.075, Math.sin(a) * 0.075, zs * 0.096);
      spin.add(nut);
    }
  }
  return spin;
}

/* ------------------------------------------------------------------ the van */

export function buildVan(tex) {
  const root = new THREE.Group();
  const mats = {
    paint: new THREE.MeshPhysicalMaterial({
      color: 0xf1f1f3,
      roughness: 0.34,
      metalness: 0.0,
      clearcoat: 1,
      clearcoatRoughness: 0.14,
      envMapIntensity: 1.1,
    }),
    glass: new THREE.MeshPhysicalMaterial({
      color: 0x030406,
      roughness: 0.08,
      metalness: 0.5,
      clearcoat: 1,
      envMapIntensity: 0.55,
    }),
    plastic: new THREE.MeshStandardMaterial({ color: 0x0d0e11, roughness: 0.62, metalness: 0.05 }),
    chrome: new THREE.MeshStandardMaterial({ color: 0xd8dce2, roughness: 0.18, metalness: 1 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.92, metalness: 0 }),
    rim: new THREE.MeshStandardMaterial({ color: 0xbfc3ca, roughness: 0.26, metalness: 1 }),
    rimDark: new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.6, metalness: 0.4 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x4a4d54, roughness: 0.45, metalness: 0.9 }),
    wheelWell: new THREE.MeshBasicMaterial({ color: 0x050507, side: THREE.DoubleSide }),
    headLens: new THREE.MeshStandardMaterial({
      color: 0xdfe8ff,
      emissive: 0xcfe0ff,
      emissiveIntensity: 0.15,
      roughness: 0.15,
      metalness: 0.2,
    }),
    tail: new THREE.MeshStandardMaterial({
      color: 0x4a0007,
      emissive: 0xff1428,
      emissiveIntensity: 0.35,
      roughness: 0.3,
    }),
    plate: new THREE.MeshStandardMaterial({ map: tex.plate, roughness: 0.5 }),
  };
  const decalMat = (map, extra = {}) =>
    new THREE.MeshStandardMaterial({
      map,
      transparent: true,
      roughness: 0.38,
      metalness: 0,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
      side: THREE.DoubleSide,
      ...extra,
    });

  const body = new THREE.Group(); // suspension-sprung mass, pivots about its centre of mass
  body.position.y = PIVOT_Y;
  const hull = new THREE.Group();
  hull.position.y = -PIVOT_Y;
  body.add(hull);
  root.add(body);

  const add = (geo, mat, pos = [0, 0, 0], opts = {}) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(...pos);
    if (opts.rot) m.rotation.set(...opts.rot);
    m.castShadow = opts.cast !== false;
    m.receiveShadow = true;
    hull.add(m);
    return m;
  };
  const box = (w, h, d, mat, pos, opts = {}, r = 0.01) =>
    add(new RoundedBoxGeometry(w, h, d, 2, r), mat, pos, opts);

  /* ---- lower body: bumpers, hood, doors, bed sides */
  const A = 0.355;
  const lower = [
    [2.08, 0.34, 0.09],
    ...arch(AX, A),
    ...arch(-AX, A),
    [-2.17, 0.34, 0.09],
    [-2.27, 0.6, 0.08],
    [-2.23, 1.0, 0.08],
    [0.92, 1.02, 0.08],
    [2.03, 0.83, 0.16],
    [2.12, 0.62, 0.1],
    [2.12, 0.45, 0.08],
  ];
  const lowerK = 0.06;
  const lowerY0 = 0.25;
  const lowerDepth = 1.52;
  const lowerHalf = lowerDepth / 2 + 0.08; // 0.84
  add(extrudeProfile(lower, { depth: lowerDepth, bt: 0.08, bs: 0.045, y0: lowerY0, k: lowerK }), mats.paint);

  /* ---- greenhouse + canopy */
  const gh = [
    [1.04, 0.95, 0],
    [0.14, 1.485, 0.18],
    [-0.42, 1.49, 0.04],
    [-0.44, 1.575, 0.05],
    [-1.98, 1.57, 0.16],
    [-2.2, 1.02, 0.07],
    [-2.2, 0.95, 0],
  ];
  const ghK = 0.14;
  const ghY0 = 1.0;
  const ghDepth = 1.38;
  const ghHalf = ghDepth / 2 + 0.07; // 0.76
  add(extrudeProfile(gh, { depth: ghDepth, bt: 0.07, bs: 0.04, y0: ghY0, k: ghK }), mats.paint);

  // windscreen
  {
    const n = new THREE.Vector2(0.48, 0.76).normalize().multiplyScalar(0.012);
    const bx = 0.9 + n.x;
    const by = 1.015 + n.y;
    const tx = 0.17 + n.x;
    const ty = 1.43 + n.y;
    const g = quadGeo(
      [
        [bx, by, -0.63],
        [bx, by, 0.63],
        [tx, ty, 0.585],
        [tx, ty, -0.585],
      ],
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ],
    );
    const m = new THREE.Mesh(g, mats.glass);
    m.material.side = THREE.DoubleSide;
    hull.add(m);
    // wipers
    for (const zs of [-0.2, 0.28]) {
      const w = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.01, 0.44), mats.plastic);
      w.position.set(0.7, 1.09, zs);
      w.rotation.set(0, 0, 0.62);
      w.rotation.order = 'ZYX';
      hull.add(w);
    }
  }

  // door glass (flat decal planes over the tapered cab sides)
  for (const side of [1, -1]) {
    const glass = side > 0 ? tex.glassR : tex.glassL;
    const g = sideDecal({ x0: glass.x0, x1: glass.x1, y0: glass.y0, y1: glass.y1, side, w0: ghHalf, y0ref: ghY0, k: ghK, eps: 0.003 });
    const m = new THREE.Mesh(
      g,
      new THREE.MeshPhysicalMaterial({
        map: glass.tex,
        transparent: true,
        roughness: 0.08,
        metalness: 0.55,
        clearcoat: 1,
        envMapIntensity: 1.5,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -3,
        polygonOffsetUnits: -3,
        side: THREE.DoubleSide,
      }),
    );
    hull.add(m);
  }

  /* ---- livery decals */
  const lowerSide = (map, x0, x1, y0, y1, side) => {
    const m = new THREE.Mesh(
      sideDecal({ x0, x1, y0, y1, side, w0: lowerHalf, y0ref: lowerY0, k: lowerK }),
      decalMat(map),
    );
    m.receiveShadow = true;
    hull.add(m);
  };
  const canopySide = (map, x0, x1, y0, y1, side) => {
    const m = new THREE.Mesh(
      sideDecal({ x0, x1, y0, y1, side, w0: ghHalf, y0ref: ghY0, k: ghK, eps: 0.004 }),
      decalMat(map),
    );
    hull.add(m);
  };
  for (const side of [1, -1]) {
    const R = side > 0;
    // door logo: globe sits toward the front
    lowerSide(R ? tex.doorLogoR : tex.doorLogoL, 0.0, 0.94, 0.47, 0.83, side);
    // door seams + handle
    const lines = R ? tex.linesR : tex.linesL;
    lowerSide(lines.tex, lines.x0, lines.x1, lines.y0, lines.y1, side);
    // rear quarter: phone number and mini globe
    lowerSide(tex.phone, -1.62, -0.74, 0.7, 0.88, side);
    lowerSide(R ? tex.quarterGlobeR : tex.quarterGlobeL, -2.0, -1.62, 0.52, 0.9, side);
    // canopy window graphic
    canopySide(R ? tex.canopyR : tex.canopyL, -1.95, -0.7, 1.1, 1.52, side);
  }
  // canopy rear window
  {
    const y0 = 1.06;
    const y1 = 1.44;
    const xAt = (y) => -2.2 + ((y - 1.02) / 0.55) * 0.22 - 0.012;
    const w = 0.64;
    const g = quadGeo(
      [
        [xAt(y0), y0, -w],
        [xAt(y0), y0, w],
        [xAt(y1), y1, w],
        [xAt(y1), y1, -w],
      ],
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ],
    );
    hull.add(new THREE.Mesh(g, decalMat(tex.canopyRear)));
  }
  // hood graphic: lies on the sloped hood, reads from the front
  {
    const hoodSlope = Math.atan2(0.83 - 1.02, 2.03 - 0.92); // negative: falls toward the nose
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.64), decalMat(tex.hood));
    const basis = new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, -1), new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 1, 0));
    m.quaternion.setFromRotationMatrix(basis);
    m.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), hoodSlope));
    m.position.set(1.5, 0.928, 0);
    hull.add(m);
  }
  // rear graphic
  {
    const y0 = 0.4;
    const y1 = 1.0;
    const xAt = (y) => -2.27 + Math.max(0, (y - 0.6) / 0.4) * 0.04 - 0.01 - (y < 0.6 ? 0.0 : 0);
    const w = 0.75;
    const g = quadGeo(
      [
        [xAt(y0) - 0.012, y0, -w],
        [xAt(y0) - 0.012, y0, w],
        [xAt(y1), y1, w],
        [xAt(y1), y1, -w],
      ],
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ],
    );
    hull.add(new THREE.Mesh(g, decalMat(tex.rear)));
  }

  /* ---- front fascia */
  box(0.04, 0.075, 0.74, mats.plastic, [2.076, 0.725, 0], { rot: [0, 0, 0.405] }); // upper grille
  box(0.012, 0.05, 0.15, mats.chrome, [2.1, 0.735, 0], { rot: [0, 0, 0.405] }, 0.004); // bowtie
  box(0.03, 0.1, 0.92, mats.plastic, [2.128, 0.56, 0]); // lower grille
  box(0.03, 0.05, 1.2, mats.plastic, [2.095, 0.355, 0]); // splitter
  const plateF = add(new THREE.PlaneGeometry(0.52, 0.112), mats.plate, [2.125, 0.43, 0], { rot: [0, Math.PI / 2, 0], cast: false });
  plateF.material = mats.plate;

  const headlights = [];
  for (const zs of [-1, 1]) {
    const housing = box(0.16, 0.13, 0.36, mats.plastic, [1.99, 0.77, zs * 0.57], { rot: [0, zs * 0.3, 0.1] }, 0.03);
    const lens = new THREE.Mesh(new RoundedBoxGeometry(0.02, 0.095, 0.3, 2, 0.008), mats.headLens);
    lens.position.set(0.082, 0, 0);
    housing.add(lens);
    headlights.push(lens);
    // fog lamps
    const fog = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.03, 20), mats.plastic);
    fog.rotation.z = Math.PI / 2;
    fog.position.set(2.1, 0.4, zs * 0.66);
    hull.add(fog);
    const fogLens = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.032, 16), mats.chrome);
    fogLens.rotation.z = Math.PI / 2;
    fogLens.position.set(2.11, 0.4, zs * 0.66);
    hull.add(fogLens);
  }

  /* ---- rear fittings */
  const tails = [];
  for (const zs of [-1, 1]) {
    const t = box(0.06, 0.3, 0.13, mats.tail, [-2.255, 0.82, zs * 0.7], { rot: [0, zs * 0.12, 0] }, 0.02);
    tails.push(t);
  }
  box(0.14, 0.06, 1.38, mats.plastic, [-2.3, 0.4, 0]); // rear step bumper
  const plateR = add(new THREE.PlaneGeometry(0.52, 0.112), mats.plate, [-2.298, 0.58, 0], { rot: [0, -Math.PI / 2, 0], cast: false });
  plateR.material = mats.plate;
  box(0.012, 0.045, 0.16, mats.chrome, [-2.28, 0.78, 0], {}, 0.004); // tailgate badge

  /* ---- mirrors + door handles */
  for (const zs of [-1, 1]) {
    box(0.04, 0.035, 0.13, mats.plastic, [0.82, 1.1, zs * 0.84], {}, 0.01);
    box(0.09, 0.12, 0.05, mats.plastic, [0.78, 1.14, zs * 0.93], { rot: [0, zs * 0.12, 0] }, 0.02);
  }
  // roof antenna
  box(0.014, 0.014, 0.014, mats.plastic, [0.0, 1.5, 0.0]);
  add(new THREE.CylinderGeometry(0.004, 0.006, 0.34, 6), mats.plastic, [-0.15, 1.64, 0.2]);

  /* ---- wheel wells (stop the body looking hollow through the arches) */
  for (const x of [AX, -AX]) {
    const half = new THREE.Mesh(new THREE.CircleGeometry(A + 0.02, 28, 0, Math.PI), mats.wheelWell);
    half.position.set(x, 0.31, 0);
    hull.add(half);
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(A + 0.01, A + 0.01, 1.5, 28, 1, true, 0, Math.PI), mats.wheelWell);
    tube.rotation.x = Math.PI / 2;
    tube.rotation.y = -Math.PI / 2;
    tube.position.set(x, 0.31, 0);
    hull.add(tube);
  }

  /* ---- wheels */
  const wheels = { pivots: [], spins: [] };
  const wheelSpots = [
    [AX, 1],
    [AX, -1],
    [-AX, 1],
    [-AX, -1],
  ];
  wheelSpots.forEach(([x, zs], i) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, WR, zs * TRACK);
    const spin = buildWheel(mats);
    pivot.add(spin);
    root.add(pivot);
    wheels.spins.push(spin);
    if (i < 2) wheels.pivots.push(pivot);
  });

  /* ---- headlights: real spot lights + visible beams */
  const lights = [];
  const beams = [];
  const beamMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    fog: false,
    uniforms: { uI: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `varying vec2 vUv; uniform float uI;
      void main(){ float a = pow(clamp(vUv.y, 0.0, 1.0), 1.9); gl_FragColor = vec4(vec3(0.82,0.9,1.0) * a * uI * 0.12, a * uI * 0.7); }`,
  });
  for (const zs of [-1, 1]) {
    const sp = new THREE.SpotLight(0xdfe9ff, 0, 55, 0.5, 0.7, 1.4);
    sp.position.set(2.1, 0.78, zs * 0.57);
    sp.target.position.set(18, 0.1, zs * 1.8);
    root.add(sp, sp.target);
    lights.push(sp);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(2.4, 16, 24, 1, true), beamMat);
    cone.geometry.translate(0, -8, 0);
    cone.geometry.rotateZ(Math.PI / 2);
    cone.position.set(2.15, 0.7, zs * 0.57);
    cone.rotation.z = -0.04;
    cone.renderOrder = 4;
    root.add(cone);
    beams.push(cone);
  }

  // contact shadow blob (cheap, always-on grounding)
  const blobC = document.createElement('canvas');
  blobC.width = blobC.height = 128;
  const bx = blobC.getContext('2d');
  const gg = bx.createRadialGradient(64, 64, 6, 64, 64, 62);
  gg.addColorStop(0, 'rgba(0,0,0,0.85)');
  gg.addColorStop(0.55, 'rgba(0,0,0,0.4)');
  gg.addColorStop(1, 'rgba(0,0,0,0)');
  bx.fillStyle = gg;
  bx.fillRect(0, 0, 128, 128);
  const blob = new THREE.Mesh(
    new THREE.PlaneGeometry(5.6, 2.9),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(blobC), transparent: true, depthWrite: false, opacity: 0.8 }),
  );
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 0.012;
  blob.renderOrder = 1;
  root.add(blob);

  /* ---- dynamic controls */
  const sus = { h: 0, hv: 0, p: 0, pv: 0, r: 0, rv: 0 };
  const api = {
    root,
    body,
    wheels,
    mats,
    headlights,
    // brake + parking lamps, headlight power
    setLights(power, brake) {
      mats.headLens.emissiveIntensity = 0.15 + power * 5.5;
      lights.forEach((l) => (l.intensity = power * 80));
      beamMat.uniforms.uI.value = power;
      beams.forEach((b) => (b.visible = power > 0.01));
      mats.tail.emissiveIntensity = 0.35 + brake * 3.2;
    },
    // Instant velocity impulse (rad/s, m/s). Negative pitch = nose dives, positive = nose pops up.
    kick(pitchVel = 0, heaveVel = 0) {
      sus.pv += pitchVel;
      sus.hv += heaveVel;
    },
    // Spring-damper suspension. aLong/aLat in m/s^2 (aLat > 0 = turning left).
    updateSuspension(dt, aLong, aLat, t, idle) {
      const steps = Math.max(1, Math.ceil(dt / 0.008));
      const h = dt / steps;
      const pT = THREE.MathUtils.clamp(aLong * 0.0019, -0.04, 0.026);
      const rT = THREE.MathUtils.clamp(aLat * 0.0016, -0.04, 0.04);
      const wP = 2 * Math.PI * 2.1;
      const zP = 0.15;
      const wH = 2 * Math.PI * 2.6;
      const zH = 0.17;
      const wR = 2 * Math.PI * 2.4;
      const zR = 0.2;
      const hT = -Math.abs(aLong) * 0.0005;
      for (let i = 0; i < steps; i++) {
        sus.pv += (wP * wP * (pT - sus.p) - 2 * zP * wP * sus.pv) * h;
        sus.p += sus.pv * h;
        sus.hv += (wH * wH * (hT - sus.h) - 2 * zH * wH * sus.hv) * h;
        sus.h += sus.hv * h;
        sus.rv += (wR * wR * (rT - sus.r) - 2 * zR * wR * sus.rv) * h;
        sus.r += sus.rv * h;
      }
      sus.p = THREE.MathUtils.clamp(sus.p, -0.062, 0.058);
      sus.h = THREE.MathUtils.clamp(sus.h, -0.045, 0.04);
      let jit = 0;
      if (idle) jit = Math.sin(t * 41) * 0.00055 + Math.sin(t * 27) * 0.0004; // engine idle shiver
      body.position.y = PIVOT_Y + sus.h;
      body.rotation.z = sus.p + jit;
      body.rotation.x = sus.r + jit * 0.6;
      return sus;
    },
    sus,
  };
  return api;
}
