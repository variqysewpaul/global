// Stations 2-4: the gate motor, the beam sensor posts, the monitor wall. Same approach as the camera in models.js: simple shapes
// with rounded edges, physical materials, and lighting from the studio environment.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { decal } from './kit.js';
import { glow, shadowed } from './models.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const rbox = (w, h, d, r, mat, seg = 5) => new THREE.Mesh(new RoundedBoxGeometry(w, h, d, seg, r), mat);
const at = (mesh, x, y, z) => {
  mesh.position.set(x, y, z);
  return mesh;
};

/* ---------- 2. the gate motor ---------- */

// A gear (axis +z): trapezoid teeth, a hub hole, bevelled edges.
function gear(r, teeth, depth, mat) {
  const th = r * 0.24;
  const s = new THREE.Shape();
  const p = (a, rr) => new THREE.Vector2(Math.cos(a) * rr, Math.sin(a) * rr);
  for (let i = 0; i < teeth; i++) {
    const a0 = (i / teeth) * Math.PI * 2;
    const w = (Math.PI * 2) / teeth;
    const pts = [p(a0, r), p(a0 + w * 0.14, r + th), p(a0 + w * 0.4, r + th), p(a0 + w * 0.54, r)];
    pts.forEach((q, j) => (i === 0 && j === 0 ? s.moveTo(q.x, q.y) : s.lineTo(q.x, q.y)));
  }
  s.closePath();
  const hole = new THREE.Path();
  hole.absarc(0, 0, r * 0.32, 0, Math.PI * 2, true);
  s.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2, curveSegments: 20 });
  geo.translate(0, 0, -depth / 2);
  return new THREE.Mesh(toCreasedNormals(geo, Math.PI / 4), mat);
}

export function buildGateMotor(m) {
  const g = new THREE.Group();

  // backdrop: a plaster pillar and the slatted gate
  const pillar = at(new THREE.Mesh(new THREE.BoxGeometry(1.8, 5.2, 1.8), m.wall), -5.2, 2.6, -1.5);
  pillar.receiveShadow = true;
  g.add(pillar);
  const slatCount = 24;
  const slats = new THREE.InstancedMesh(new RoundedBoxGeometry(0.2, 4.6, 0.16, 3, 0.04), m.darkMetal, slatCount);
  const mat4 = new THREE.Matrix4();
  for (let i = 0; i < slatCount; i++) slats.setMatrixAt(i, mat4.makeTranslation(-3.6 + i * 0.62, 2.6, -1.9));
  slats.castShadow = slats.receiveShadow = true;
  g.add(slats);
  for (const y of [0.4, 4.9]) g.add(shadowed(at(rbox(15, 0.28, 0.24, 0.06, m.darkMetal), 3.3, y, -1.9)));

  // base plate, set-back lower block, overhanging housing with a brushed lid
  g.add(at(rbox(4.3, 0.14, 2.2, 0.05, m.darkMetal), 0, 0.07, 0.05));
  g.add(shadowed(at(rbox(3.2, 0.72, 1.3, 0.12, m.darkMetal, 5), 0, 0.5, -0.02)));
  const housing = at(rbox(3.5, 1.6, 1.5, 0.22, m.satinGrey, 7), 0, 1.64, 0);
  g.add(housing);
  g.add(at(rbox(3.1, 0.1, 1.25, 0.05, m.graphite, 4), 0, 2.47, 0));
  // the brand accent: a violet light strip and a pink indicator on the front face
  // a graphite face panel, proud of the cover, with vent slots below it
  g.add(at(rbox(3.04, 1.1, 0.07, 0.05, m.graphite, 6), 0, 1.7, 0.745));
  for (let i = 0; i < 9; i++) g.add(at(rbox(0.26, 0.04, 0.04, 0.015, m.blackPlastic, 2), -1.2 + i * 0.3, 1.0, 0.742));
  const strip = at(new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.06, 0.03), m.violet(2.8)), -0.35, 1.7, 0.792);
  g.add(strip);
  const stripGlow = glow('#b070ff', 2.0, 0.2);
  stripGlow.position.set(-0.35, 1.7, 0.86);
  stripGlow.scale.set(2.2, 0.36, 1);
  g.add(stripGlow);
  const tri = new THREE.Shape([new THREE.Vector2(-0.12, 0.08), new THREE.Vector2(0.12, 0.08), new THREE.Vector2(0, -0.1)]);
  g.add(at(new THREE.Mesh(new THREE.ShapeGeometry(tri), m.pink(2.2)), 1.0, 1.7, 0.795));
  // anchor bolts through the base plate
  for (const [x, z] of [[-1.8, -0.8], [1.8, -0.8], [-1.8, 0.9], [1.8, 0.9]]) {
    const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.1, 6), m.steel);
    bolt.position.set(x, 0.19, z);
    g.add(bolt);
    const washer = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.025, 28), m.alu);
    washer.position.set(x, 0.15, z);
    g.add(washer);
  }

  // the drive: a pinion engaged with a length of rack, set out in front like a product spec
  const rackY = 0.3;
  const rackX = 4.2;
  g.add(at(rbox(3.4, 0.22, 0.32, 0.04, m.metalPlain), rackX, 0.11, 2.0));
  const teethN = 15;
  const teeth = new THREE.InstancedMesh(new RoundedBoxGeometry(0.11, 0.13, 0.28, 2, 0.02), m.metalPlain, teethN);
  for (let i = 0; i < teethN; i++) teeth.setMatrixAt(i, mat4.makeTranslation(rackX - 1.55 + i * 0.224, rackY + 0.06, 2.0));
  g.add(teeth);
  const pinion = gear(0.5, 14, 0.3, m.metalPlain);
  pinion.position.set(rackX, rackY + 0.06 + 0.07 + 0.5, 2.0);
  pinion.rotation.z = Math.PI / 14;
  g.add(pinion);

  shadowed(g, true, false);
  pillar.castShadow = false;
  pillar.receiveShadow = true;
  const base = decal({ size: [9, 5], stops: [[0, '#ffffff'], [0.5, '#8a8a8a'], [1, '#000000']], opacity: 0.65 });
  base.position.set(0.5, 0.004, 0.4);
  g.add(base);
  return g;
}

/* ---------- 3. the beam sensor posts ---------- */

// a strip that is brightest along its centre line and fades smoothly to both edges
let ribbonTex;
function ribbonTexture() {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 128;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 128);
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    const v = Math.pow(1 - Math.abs(t * 2 - 1), 2.2);
    g.addColorStop(t, `rgb(${Math.round(v * 255)},${Math.round(v * 255)},${Math.round(v * 255)})`);
  }
  x.fillStyle = g;
  x.fillRect(0, 0, 4, 128);
  return new THREE.CanvasTexture(c);
}

export function buildBeamPosts(m) {
  const g = new THREE.Group();
  const gap = 9.2;
  const beamY = [4.15, 3.6];

  const post = (x, face) => {
    const p = new THREE.Group();
    p.add(at(rbox(1.3, 0.12, 1.3, 0.05, m.darkMetal), x, 0.06, 0));
    p.add(at(rbox(0.82, 5.5, 0.82, 0.14, m.alu, 7), x, 2.87, 0));
    p.add(at(rbox(0.96, 0.34, 0.96, 0.12, m.graphite, 6), x, 5.74, 0));
    // the lens window on the face that looks at the other post: black glass, two apertures
    const wx = x + face * 0.415;
    const win = new THREE.Mesh(new RoundedBoxGeometry(0.1, 2.2, 0.56, 4, 0.05), m.glass);
    win.position.set(wx, 3.88, 0);
    p.add(win);
    for (const y of beamY) {
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.19, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), m.glass);
      dome.rotation.z = -face * Math.PI / 2; // axis towards the other post
      dome.scale.set(0.5, 1, 1);
      dome.position.set(wx + face * 0.03, y, 0);
      p.add(dome);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.025, 14, 48), m.steel);
      ring.rotation.y = Math.PI / 2;
      ring.position.set(wx + face * 0.035, y, 0);
      p.add(ring);
      const halo = glow('#b070ff', 0.7, 0.8);
      halo.position.set(wx + face * 0.12, y, 0);
      p.add(halo);
    }
    // status light and the brand accent
    p.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.03), m.pink(2.0)), x - face * 0.0, 1.8, 0.425));
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.07, 6), m.steel);
      bolt.position.set(x + sx * 0.5, 0.155, sz * 0.5);
      p.add(bolt);
    }
    return p;
  };
  g.add(shadowed(post(-gap / 2, 1)));
  g.add(shadowed(post(gap / 2, -1)));

  // the beams: a hot core, a violet halo and a wide faint bloom, stacked (additive)
  const beams = [];
  for (const y of beamY) {
    const len = gap - 0.9;
    const core = new THREE.Mesh(
      new THREE.CylinderGeometry(0.024, 0.024, len, 20, 1, true),
      new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffffff').multiplyScalar(2.6), transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    core.rotation.z = Math.PI / 2;
    core.position.set(0, y, 0);
    core.userData.base = 1;
    g.add(core);
    beams.push(core);
    ribbonTex ??= ribbonTexture();
    for (const [h, color, k, op, rot] of [[0.42, '#c88cff', 1.6, 0.75, 0], [1.5, '#9a5cff', 1.1, 0.34, 0], [0.9, '#c88cff', 1.2, 0.3, Math.PI / 2]]) {
      const ribbon = new THREE.Mesh(
        new THREE.PlaneGeometry(len, h),
        new THREE.MeshBasicMaterial({ map: ribbonTex, color: new THREE.Color(color).multiplyScalar(k), transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
      );
      ribbon.rotation.x = rot;
      ribbon.position.set(0, y, 0);
      ribbon.userData.base = op;
      g.add(ribbon);
      beams.push(ribbon);
    }
  }
  g.userData.beams = beams;
  // the beam tints the posts and the floor
  const light = new THREE.PointLight('#a66bff', 26, 14, 2);
  light.position.set(0, 3.9, 1.2);
  g.add(light);
  const pool = decal({ size: [13, 4], color: '#6a3cc8', stops: [[0, '#ffffff'], [0.5, '#555555'], [1, '#000000']], opacity: 0.5, additive: true });
  pool.position.set(0, 0.005, 0.3);
  g.add(pool);
  const contact = decal({ size: [12, 3.4], stops: [[0, '#ffffff'], [0.5, '#8a8a8a'], [1, '#000000']], opacity: 0.55 });
  contact.position.set(0, 0.004, 0);
  g.add(contact);
  return g;
}

/* ---------- 4. the monitor wall ---------- */

// A procedural CCTV feed on a canvas: a night street, with the on-screen display of a recorder.
function feedTexture(label, seed, alert) {
  const W = 1024;
  const H = 576;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const x = c.getContext('2d');
  let s = seed;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  // sky and ground
  const sky = x.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#0b1020');
  sky.addColorStop(0.55, '#1a2238');
  sky.addColorStop(0.56, '#10131c');
  sky.addColorStop(1, '#07080d');
  x.fillStyle = sky;
  x.fillRect(0, 0, W, H);
  // buildings with lit windows
  for (let i = 0; i < 9; i++) {
    const bw = 70 + rnd() * 110;
    const bh = 90 + rnd() * 190;
    const bx = i * 118 + rnd() * 30 - 20;
    x.fillStyle = `rgb(${14 + rnd() * 10},${16 + rnd() * 10},${24 + rnd() * 12})`;
    x.fillRect(bx, H * 0.56 - bh, bw, bh);
    for (let wy = H * 0.56 - bh + 14; wy < H * 0.56 - 14; wy += 26) {
      for (let wx = bx + 10; wx < bx + bw - 14; wx += 22) {
        if (rnd() < 0.28) {
          x.fillStyle = `rgba(255,${190 + rnd() * 40},${120 + rnd() * 50},${0.45 + rnd() * 0.45})`;
          x.fillRect(wx, wy, 9, 12);
        }
      }
    }
  }
  // street lamps and their pools
  for (const lx of [150, 480, 820]) {
    x.fillStyle = '#222836';
    x.fillRect(lx, H * 0.34, 4, H * 0.28);
    const pool = x.createRadialGradient(lx + 2, H * 0.36, 2, lx + 2, H * 0.62, 150);
    pool.addColorStop(0, 'rgba(255,214,150,0.55)');
    pool.addColorStop(1, 'rgba(255,214,150,0)');
    x.fillStyle = pool;
    x.fillRect(lx - 160, H * 0.3, 320, H * 0.5);
  }
  // noise, scanlines, vignette
  for (let i = 0; i < 2600; i++) {
    x.fillStyle = `rgba(255,255,255,${rnd() * 0.07})`;
    x.fillRect(rnd() * W, rnd() * H, 2, 2);
  }
  x.fillStyle = 'rgba(0,0,0,0.18)';
  for (let y = 0; y < H; y += 4) x.fillRect(0, y, W, 1.5);
  const vg = x.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.9);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.55)');
  x.fillStyle = vg;
  x.fillRect(0, 0, W, H);
  if (alert) {
    // a detection box in the brand violet
    x.strokeStyle = '#c88cff';
    x.lineWidth = 4;
    x.strokeRect(430, 250, 190, 230);
    x.fillStyle = 'rgba(200,140,255,0.16)';
    x.fillRect(430, 250, 190, 230);
    x.fillStyle = '#c88cff';
    x.fillRect(430, 216, 150, 34);
    x.fillStyle = '#10051c';
    x.font = 'bold 22px monospace';
    x.fillText('MOTION', 442, 241);
  }
  // recorder overlay
  x.fillStyle = '#e8e8ee';
  x.font = 'bold 30px monospace';
  x.fillText(label, 34, 58);
  x.fillStyle = '#ff3d5a';
  x.beginPath();
  x.arc(W - 150, 48, 9, 0, Math.PI * 2);
  x.fill();
  x.fillStyle = '#e8e8ee';
  x.fillText('REC', W - 130, 58);
  x.font = '24px monospace';
  x.fillText('22:41:07   11-11-2026', 34, H - 34);
  x.strokeStyle = 'rgba(232,232,238,0.7)';
  x.lineWidth = 3;
  for (const [cx, cy, dx, dy] of [[24, 24, 1, 1], [W - 24, 24, -1, 1], [24, H - 24, 1, -1], [W - 24, H - 24, -1, -1]]) {
    x.beginPath();
    x.moveTo(cx, cy + dy * 34);
    x.lineTo(cx, cy);
    x.lineTo(cx + dx * 34, cy);
    x.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export function buildMonitors(m) {
  const g = new THREE.Group();
  // the console, and a plaster backdrop
  const wall = at(new THREE.Mesh(new THREE.BoxGeometry(16, 6, 0.6), m.wall), 0, 3, -2.6);
  wall.receiveShadow = true;
  g.add(wall);
  g.add(shadowed(at(rbox(11.6, 1.05, 3.4, 0.12, m.graphite, 6), 0, 0.525, 0.2)));
  g.add(at(rbox(10.4, 0.06, 2.6, 0.02, m.blackPlastic, 2), 0, 1.07, 0.35)); // a desk mat

  const feeds = [
    { x: -4.3, ry: 0.3, label: 'CAM 02  GATE', seed: 11, alert: false },
    { x: 0, ry: 0, label: 'CAM 01  DRIVEWAY', seed: 23, alert: true },
    { x: 4.3, ry: -0.3, label: 'CAM 03  ENTRANCE', seed: 37, alert: false },
  ];
  for (const f of feeds) {
    const unit = new THREE.Group();
    unit.add(at(rbox(4.2, 2.6, 0.18, 0.07, m.blackPlastic, 5), 0, 0, 0));
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(3.96, 2.22), new THREE.MeshBasicMaterial({ map: feedTexture(f.label, f.seed, f.alert), toneMapped: false }));
    screen.position.set(0, 0.02, 0.095);
    unit.add(screen);
    // a clear sheet over the screen, so it catches the softboxes like real glass
    const sheen = new THREE.Mesh(new THREE.PlaneGeometry(3.96, 2.22), new THREE.MeshPhysicalMaterial({ color: '#000000', transparent: true, opacity: 0.18, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 2.6 }));
    sheen.position.set(0, 0.02, 0.098);
    unit.add(sheen);
    unit.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.025, 0.02), m.pink(1.8)), 0, -1.2, 0.092));
    // neck and foot
    unit.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 1.4, 24), m.alu), 0, -1.95, -0.12));
    unit.position.set(f.x, 3.45, 0.5);
    unit.rotation.y = f.ry;
    g.add(unit);
    g.add(at(rbox(1.7, 0.08, 1.2, 0.04, m.alu, 3), f.x, 1.14, 0.45));
  }
  shadowed(g, true, false);
  wall.castShadow = false;
  wall.receiveShadow = true;

  // the screens light the desk and the room in violet-blue
  const glowL = new THREE.PointLight('#8f7dff', 36, 16, 2);
  glowL.position.set(0, 3.2, 3.2);
  g.add(glowL);
  const pool = decal({ size: [14, 6], color: '#4a3cc8', stops: [[0, '#ffffff'], [0.5, '#555555'], [1, '#000000']], opacity: 0.4, additive: true });
  pool.position.set(0, 0.005, 1.6);
  g.add(pool);
  const contact = decal({ size: [13, 4.6], stops: [[0, '#ffffff'], [0.5, '#8a8a8a'], [1, '#000000']], opacity: 0.6 });
  contact.position.set(0, 0.004, 0.3);
  g.add(contact);
  return g;
}
