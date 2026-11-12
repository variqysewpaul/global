// The products, built from simple shapes (lathes, bevelled extrusions, rounded boxes) and given convincing physical materials.
// Rounded edges catch the light; that is most of what makes hardware read as real. Everything is modelled in scene units where
// 1 unit is about 10 cm, with the floor at y = 0.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { brushedTexture, grainTexture, plasterNormalTexture, radialTexture, decal } from './kit.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

/* ---------- materials ---------- */

export function makeMaterials() {
  const brushed = brushedTexture(256);
  brushed.repeat.set(3, 3);
  const brushedAlong = brushed.clone();
  brushedAlong.rotation = Math.PI / 2;
  brushedAlong.center.set(0.5, 0.5);
  brushedAlong.repeat.set(3, 3);
  brushedAlong.needsUpdate = true;
  const grain = grainTexture(256);
  grain.repeat.set(4, 4);
  const plaster = plasterNormalTexture(256);
  plaster.repeat.set(8, 5);
  const phys = (o) => new THREE.MeshPhysicalMaterial(o);
  return {
    textures: { brushed, grain, plaster },
    // satin white powder-coat, with a clear top coat
    whitePaint: phys({ color: '#d6dae1', roughness: 0.42, clearcoat: 0.5, clearcoatRoughness: 0.22, envMapIntensity: 0.75 }),
    blackPlastic: phys({ color: '#0b0c10', roughness: 0.45, clearcoat: 0.35, clearcoatRoughness: 0.25 }),
    graphite: phys({ color: '#33373e', metalness: 0.2, roughness: 0.36, clearcoat: 0.85, clearcoatRoughness: 0.1, envMapIntensity: 1.25 }),
    satinGrey: phys({ color: '#5c626b', roughness: 0.46, clearcoat: 0.4, clearcoatRoughness: 0.28, envMapIntensity: 0.9 }),
    metalPlain: phys({ color: '#aeb3ba', metalness: 1, roughness: 0.28 }),
    rubber: new THREE.MeshStandardMaterial({ color: '#0c0c0f', roughness: 0.88 }),
    alu: phys({ color: '#b4b9c0', metalness: 1, roughness: 0.36, roughnessMap: brushedAlong }),
    steel: phys({ color: '#80868d', metalness: 1, roughness: 0.42, roughnessMap: brushed }),
    darkMetal: phys({ color: '#2c2f36', metalness: 1, roughness: 0.4, roughnessMap: brushed }),
    // lens glass: nearly black, with a clear coat, so it shows the softboxes and little else
    glass: phys({ color: '#05060c', roughness: 0.02, clearcoat: 1, clearcoatRoughness: 0.01, envMapIntensity: 3.2 }),
    coating: phys({ color: '#150b28', roughness: 0.12, metalness: 0.2, iridescence: 1, iridescenceIOR: 1.7, iridescenceThicknessRange: [250, 700], envMapIntensity: 2.2 }),
    wall: new THREE.MeshStandardMaterial({ color: '#3a3342', roughness: 0.92, normalMap: plaster, normalScale: new THREE.Vector2(0.5, 0.5), envMapIntensity: 0.3 }),
    // emissive accents (not lit: they glow)
    pink: (k = 3.0) => new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff5fae').multiplyScalar(k) }),
    violet: (k = 3.2) => new THREE.MeshBasicMaterial({ color: new THREE.Color('#c88cff').multiplyScalar(k) }),
  };
}

/* ---------- helpers ---------- */

// A thick open polyline (mitred joins) as a flat shape, ready to extrude.
function strokeShape(pts, width) {
  const h = width / 2;
  const left = [];
  const right = [];
  pts.forEach((p, i) => {
    const d1 = i > 0 ? p.clone().sub(pts[i - 1]).normalize() : null;
    const d2 = i < pts.length - 1 ? pts[i + 1].clone().sub(p).normalize() : null;
    const n1 = d1 && new THREE.Vector2(-d1.y, d1.x);
    const n2 = d2 && new THREE.Vector2(-d2.y, d2.x);
    let n = n1 ?? n2;
    let s = 1;
    if (n1 && n2) {
      n = n1.clone().add(n2).normalize();
      s = 1 / Math.max(0.35, n.dot(n1));
    }
    left.push(p.clone().addScaledVector(n, h * s));
    right.push(p.clone().addScaledVector(n, -h * s));
  });
  return new THREE.Shape([...left, ...right.reverse()]);
}

function cylBetween(a, b, r, mat, segs = 28) {
  const dir = b.clone().sub(a);
  const len = dir.length();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, segs), mat);
  m.position.copy(a).addScaledVector(dir, 0.5);
  m.quaternion.setFromUnitVectors(V(0, 1, 0), dir.normalize());
  return m;
}

// A cross-head screw seen face-on (its axis is +z).
function screw(m, r = 0.05) {
  const g = new THREE.Group();
  const head = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.08, 0.035, 24), m.steel);
  head.rotation.x = Math.PI / 2;
  g.add(head);
  const slot = new THREE.BoxGeometry(r * 1.4, r * 0.26, 0.02);
  for (const a of [0, Math.PI / 2]) {
    const s = new THREE.Mesh(slot, m.blackPlastic);
    s.position.z = 0.014;
    s.rotation.z = a + 0.3;
    g.add(s);
  }
  return g;
}

// A soft additive glow (LED bloom without a post-processing pass).
let glowTex;
export function glow(color, size, strength = 1) {
  glowTex ??= radialTexture([[0, '#ffffff'], [0.25, '#7a7a7a'], [0.6, '#1c1c1c'], [1, '#000000']]);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: new THREE.Color(color).multiplyScalar(strength), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  s.scale.setScalar(size);
  return s;
}

export function shadowed(group, cast = true, receive = false) {
  group.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = cast;
      o.receiveShadow = receive;
    }
  });
  return group;
}

// The key light for one station: a soft spot with a static shadow, plus the floor decals that anchor things to the ground.
export function stationLight(at, { from = [-5.4, 4.6, 6.8], target = [0, 1.6, 0], intensity = 340, color = '#fff0e0', angle = 0.36 } = {}) {
  const g = new THREE.Group();
  const spot = new THREE.SpotLight(color, intensity, 0, angle, 1, 2);
  spot.position.set(at[0] + from[0], at[1] + from[1], at[2] + from[2]);
  spot.target.position.set(at[0] + target[0], at[1] + target[1], at[2] + target[2]);
  spot.castShadow = true;
  spot.shadow.mapSize.set(1024, 1024);
  spot.shadow.radius = 14;
  spot.shadow.blurSamples = 16;
  spot.shadow.bias = -0.0004;
  spot.shadow.camera.near = 4;
  spot.shadow.camera.far = 30;
  g.add(spot, spot.target);
  return g;
}

/* ---------- 1. the bullet camera, on a wall bracket ---------- */

export function buildBulletCamera(m) {
  const g = new THREE.Group();

  // The plaster wall behind it (it takes the camera's soft shadow).
  const wall = new THREE.Mesh(new THREE.BoxGeometry(14, 4.4, 0.6), m.wall);
  wall.position.set(0, 2.2, -1.2);
  wall.receiveShadow = true;
  g.add(wall);

  // Wall plate with four screws, and the arm to the ball joint.
  const plateC = V(-1.75, 1.95, -0.83);
  const plate = new THREE.Mesh(new RoundedBoxGeometry(1.0, 1.0, 0.14, 5, 0.045), m.graphite);
  plate.position.copy(plateC);
  g.add(plate);
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const s = screw(m, 0.048);
    s.position.set(plateC.x + sx * 0.34, plateC.y + sy * 0.34, plateC.z + 0.075);
    g.add(s);
  }
  const B = V(-1.15, 1.8, -0.02);
  g.add(cylBetween(V(plateC.x, plateC.y, plateC.z + 0.07), B, 0.085, m.alu));
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.08, 36), m.alu);
  collar.position.set(plateC.x, plateC.y, plateC.z + 0.11);
  collar.rotation.x = Math.PI / 2;
  g.add(collar);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.2, 40, 24), m.alu);
  ball.position.copy(B);
  g.add(ball);

  // The camera body. It is modelled along +y (rear at the bottom, lens at the top) with the sun hood on +z, then aimed.
  const body = new THREE.Group();
  const lathe = (pts, mat, segs = 96) => new THREE.Mesh(new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), segs), mat);
  body.add(lathe([[0, -0.34], [0.16, -0.34], [0.25, -0.31], [0.32, -0.24], [0.355, -0.12], [0.37, 0], [0.37, 1.18], [0.385, 1.23], [0.392, 1.3], [0.385, 1.37], [0.372, 1.41]], m.graphite));
  // front bezel, the dark lens recess, the glass and the coated element behind it
  body.add(lathe([[0.378, 1.4], [0.372, 1.445], [0.35, 1.47], [0.3, 1.482], [0.272, 1.472], [0.262, 1.44]], m.steel));
  const recess = new THREE.Mesh(new THREE.CircleGeometry(0.265, 56), new THREE.MeshStandardMaterial({ color: '#0a0b12', roughness: 0.35, metalness: 0.3 }));
  recess.rotation.x = -Math.PI / 2;
  recess.position.y = 1.438;
  body.add(recess);
  const lens = new THREE.Mesh(new THREE.SphereGeometry(0.245, 64, 32, 0, Math.PI * 2, 0, Math.PI / 2), m.glass);
  lens.scale.y = 0.78;
  lens.position.y = 1.442;
  body.add(lens);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.013, 16, 72), m.coating);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 1.452;
  body.add(ring);
  const iris = new THREE.Mesh(new THREE.SphereGeometry(0.085, 28, 16), new THREE.MeshStandardMaterial({ color: '#05030a', roughness: 0.2, metalness: 0.6 }));
  iris.position.y = 1.43;
  body.add(iris);
  // infrared LEDs around the lens, with a soft glow each
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const led = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.014, 16), m.violet(2.6));
    led.position.set(Math.cos(a) * 0.318, 1.482, Math.sin(a) * 0.318);
    body.add(led);
    const halo = glow('#b070ff', 0.2, 1.1);
    halo.position.set(Math.cos(a) * 0.318, 1.495, Math.sin(a) * 0.318);
    body.add(halo);
  }
  // the brand accent: a thin pink band round the tube
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.372, 0.008, 12, 96), m.pink(1.8));
  band.rotation.x = Math.PI / 2;
  band.position.y = 0.96;
  body.add(band);
  // cable gland at the rear
  body.add(lathe([[0.07, -0.34], [0.115, -0.4], [0.12, -0.7], [0.1, -0.74]], m.rubber, 32));

  // sun hood: a bevelled shell over the top, overhanging the lens
  const arc = [];
  for (let i = 0; i <= 40; i++) {
    const a = THREE.MathUtils.lerp(Math.PI - 0.1, Math.PI * 2 + 0.1, i / 40); // the lower half in shape space = the +z side after the turn
    arc.push(new THREE.Vector2(Math.cos(a) * 0.46, Math.sin(a) * 0.46));
  }
  const hoodGeo = new THREE.ExtrudeGeometry(strokeShape(arc, 0.034), { depth: 1.5, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 4, curveSegments: 4 });
  hoodGeo.rotateX(-Math.PI / 2);
  hoodGeo.translate(0, 0.2, 0);
  body.add(new THREE.Mesh(toCreasedNormals(hoodGeo, Math.PI / 5), m.graphite));

  // aim it: the lens points right and a little down; the hood stays on top
  const d = V(0.86, -0.14, 0.49).normalize();
  const zUp = V(0, 1, 0).addScaledVector(d, -d.y).normalize();
  const xAxis = d.clone().cross(zUp);
  body.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAxis, d, zUp));
  body.position.copy(B);
  g.add(body);

  shadowed(g, true, false);
  wall.castShadow = false;
  wall.receiveShadow = true;

  // contact shadow where the wall meets the floor
  const base = decal({ size: [14, 3.2], stops: [[0, '#ffffff'], [0.45, '#9a9a9a'], [1, '#000000']], opacity: 0.7 });
  base.position.set(0, 0.004, -0.2);
  g.add(base);
  return g;
}
