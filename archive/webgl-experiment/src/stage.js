// Renderer, camera rig, lights, post-processing and the per-frame van physics.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { state } from './state.js';
import { makeLivery } from './livery.js';
import { buildVan, WHEELBASE } from './van.js';
import { buildWorld, ROUTE, ROUTE_LEN, routeU, TOWER } from './world.js';

const clamp = THREE.MathUtils.clamp;
const smooth = THREE.MathUtils.smoothstep;
const wrapPi = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export async function createStage(canvas, { reduced = false } = {}) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  } catch {
    return null;
  }
  if (!renderer.capabilities.isWebGL2) return null;

  let pixelRatio = Math.min(window.devicePixelRatio || 1, 1.75);
  renderer.setPixelRatio(pixelRatio);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  const fogColor = new THREE.Color().setRGB(0.04, 0.016, 0.046, THREE.LinearSRGBColorSpace);
  scene.background = fogColor.clone();
  scene.fog = new THREE.FogExp2(fogColor, state.fog);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.3;

  const camera = new THREE.PerspectiveCamera(state.fov, 1, 0.1, 1500);
  const aniso = renderer.capabilities.getMaxAnisotropy();

  /* ---- lights */
  const hemi = new THREE.HemisphereLight(0x6a78b8, 0x1d0d1c, 0.55);
  const key = new THREE.DirectionalLight(0xe4ecff, 2.5);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -6.5, right: 6.5, top: 6.5, bottom: -6.5, near: 1, far: 40 });
  key.shadow.bias = -0.0005;
  key.shadow.normalBias = 0.03;
  const rimPink = new THREE.PointLight(0xff2f8f, 34, 26, 2);
  const rimCool = new THREE.PointLight(0x7fa6ff, 22, 24, 2);
  scene.add(hemi, key, key.target, rimPink, rimCool);

  /* ---- content */
  const world = buildWorld(scene, { aniso });
  const tex = await makeLivery(aniso);
  const van = buildVan(tex);
  scene.add(van.root);

  /* ---- post-processing */
  const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(4, 4), 0.55, 0.6, 0.92);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  let useComposer = true;

  let W = 1;
  let H = 1;
  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(W, H, false);
    composer.setPixelRatio(pixelRatio);
    composer.setSize(W, H);
    camera.aspect = W / H;
  }
  resize();

  /* ---- pointer */
  const ptr = { x: 0, y: 0, tx: 0, ty: 0 };
  window.addEventListener('pointermove', (e) => {
    ptr.tx = (e.clientX / W) * 2 - 1;
    ptr.ty = (e.clientY / H) * 2 - 1;
  });
  const ray = new THREE.Raycaster();
  window.addEventListener('pointerdown', (e) => {
    if (state.mapMix > 0.5) return;
    if (e.target.closest && e.target.closest('a,button,input,textarea,select,label,header,.card,.panel,.feed')) return;
    ray.setFromCamera(new THREE.Vector2((e.clientX / W) * 2 - 1, -(e.clientY / H) * 2 + 1), camera);
    if (ray.intersectObject(van.root, true).length) {
      van.kick(-0.5, -0.2); // press down on the nose
      shake = Math.max(shake, 0.35);
    }
  });

  /* ---- van driving */
  const p = new THREE.Vector3();
  const tg = new THREE.Vector3();
  const t0 = new THREE.Vector3();
  const t1 = new THREE.Vector3();
  let steer = 0;
  let spin = 0;
  let first = true;
  let prevDist = 0;
  let prevV = 0;
  let prevYaw = 0;
  let aF = 0;
  let aL = 0;
  let prevTau = 0;
  let shake = 0;
  const dive = { fired: false };
  const stop = { fired: false };

  function driveVan(dt, t) {
    const tau = state.carT;
    const u = routeU(tau);
    state.routeU = u;
    ROUTE.getPointAt(u, p);
    ROUTE.getTangentAt(u, tg);
    const yaw = Math.atan2(-tg.z, tg.x);
    van.root.position.set(p.x, 0, p.z);
    van.root.rotation.y = yaw;

    // steering follows path curvature, then holds a hard lock when the van pulls up
    const du = 0.004;
    const u0 = clamp(u - du, 0, 1);
    const u1 = clamp(u + du, 0, 1);
    ROUTE.getTangentAt(u0, t0);
    ROUTE.getTangentAt(u1, t1);
    const dpsi = wrapPi(Math.atan2(-t1.z, t1.x) - Math.atan2(-t0.z, t0.x));
    const kappa = u1 - u0 > 1e-6 ? dpsi / ((u1 - u0) * ROUTE_LEN) : 0;
    let target = clamp(Math.atan(WHEELBASE * kappa), -0.52, 0.52);
    target = THREE.MathUtils.lerp(target, -0.5, smooth(u, 0.955, 0.996));
    target += (1 - smooth(u, 0, 0.012)) * 0.2; // parked with a little lock on, hero stance
    steer += (target - steer) * (1 - Math.exp(-dt * 12));
    van.wheels.pivots.forEach((pv) => (pv.rotation.y = steer));

    const dist = u * ROUTE_LEN;
    spin = -dist / 0.31;
    van.wheels.spins.forEach((s) => (s.rotation.z = spin));

    // speed / acceleration from how fast the scroll is driving the van
    const d = Math.max(dt, 1 / 240);
    if (first) {
      prevDist = dist;
      prevYaw = yaw;
      prevTau = tau;
      first = false;
    }
    const v = clamp((dist - prevDist) / d, -45, 45);
    const a = clamp((v - prevV) / d, -60, 60);
    aF += (a - aF) * (1 - Math.exp(-d * 16));
    const yawRate = wrapPi(yaw - prevYaw) / d;
    aL += (clamp(v * yawRate, -14, 14) - aL) * (1 - Math.exp(-d * 10));
    prevDist = dist;
    prevV = v;
    prevYaw = yaw;

    // guaranteed beats: nose-dive when the braking starts, rebound bounce when the van stops
    if (prevTau < 0.8 && tau >= 0.8 && !dive.fired) {
      van.kick(-0.5, -0.18);
      dive.fired = true;
    }
    if (tau < 0.78) dive.fired = false;
    if (prevTau < 0.997 && tau >= 0.997 && !stop.fired) {
      van.kick(1.05, 0.42);
      shake = 1;
      stop.fired = true;
    }
    if (tau < 0.99) stop.fired = false;
    prevTau = tau;

    const braking = tau > 0.8 && tau < 0.998 ? 1 : clamp(-aF / 4, 0, 1);
    van.setLights(clamp(state.headlights, 0, 1), tau >= 0.998 ? 0.45 : braking);
    van.updateSuspension(d, aF, aL, t, u < 0.002 || u > 0.998);
  }

  /* ---- camera rig */
  const pos = new THREE.Vector3();
  const look = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const right = new THREE.Vector3();
  const up = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);

  function driveCamera(dt, t) {
    const portrait = W / H < 1;
    const fit = portrait ? Math.min(2.4, 1.12 / (W / H)) : 1;
    look.set(state.look.x, state.look.y, state.look.z);
    pos.set(state.cam.x, state.cam.y, state.cam.z);
    pos.sub(look).multiplyScalar(fit).add(look);

    const ground = 1 - state.mapMix;
    const k = 1 - Math.exp(-dt * 3);
    ptr.x += (ptr.tx - ptr.x) * k;
    ptr.y += (ptr.ty - ptr.y) * k;
    dir.subVectors(look, pos).normalize();
    right.crossVectors(dir, UP).normalize();
    up.crossVectors(right, dir).normalize();
    if (!reduced) {
      pos.addScaledVector(right, ptr.x * 0.4 * ground).addScaledVector(up, -ptr.y * 0.2 * ground);
      shake *= Math.exp(-dt * 4.5);
      if (shake > 0.002) {
        pos.x += Math.sin(t * 61) * 0.025 * shake;
        pos.y += Math.sin(t * 53 + 1) * 0.02 * shake;
        pos.z += Math.sin(t * 47 + 2) * 0.025 * shake;
      }
    }
    camera.position.copy(pos);
    camera.lookAt(look);
    camera.fov = state.fov * (portrait ? 1.08 : 1);
    camera.aspect = W / H;
    if (portrait) camera.setViewOffset(W, H, 0, H * 0.1 * ground, W, H);
    else camera.setViewOffset(W, H, -state.shiftX * W, state.shiftY * H, W, H);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  }

  /* ---- light rig follows the van, oriented from the camera */
  const hd = new THREE.Vector3();
  function rot(v, a, out) {
    const c = Math.cos(a);
    const s = Math.sin(a);
    return out.set(v.x * c + v.z * s, 0, -v.x * s + v.z * c);
  }
  const tmpA = new THREE.Vector3();
  function driveLights() {
    const f = van.root.position;
    hd.set(camera.position.x - f.x, 0, camera.position.z - f.z);
    if (hd.lengthSq() < 4) hd.set(0, 0, 1);
    hd.normalize();
    key.position.copy(f).addScaledVector(rot(hd, 0.75, tmpA), 9).setY(7.5);
    key.target.position.set(f.x, 0.6, f.z);
    rimPink.position.copy(f).addScaledVector(rot(hd, Math.PI - 0.8, tmpA), 7.5).setY(2.6);
    rimCool.position.copy(f).addScaledVector(rot(hd, Math.PI + 0.9, tmpA), 8).setY(2.2);
    const m = state.mapMix;
    hemi.intensity = 0.55 + m * 0.5;
  }

  /* ---- frame */
  let active = true;
  let covered = false; // photoreal footage fully covers the canvas: skip the WebGL draw
  let frames = 0;
  let acc = 0;
  let adapted = false;
  function update(dt, t, render = true) {
    dt = Math.min(dt, 0.05);
    driveVan(dt, t);
    driveCamera(dt, t);
    driveLights();
    world.update(t, van.root.position);
    scene.fog.density = state.fog;

    if (!render || !active || covered) return;
    if (useComposer) composer.render(dt);
    else renderer.render(scene, camera);

    // adapt quality once, early, if the machine can't keep up
    if (!adapted && ++frames > 40) {
      acc += dt;
      if (frames > 160) {
        const avg = acc / 120;
        adapted = true;
        if (avg > 1 / 38) {
          pixelRatio = Math.max(1, pixelRatio * 0.7);
          if (avg > 1 / 24) useComposer = false;
          resize();
        }
      }
    }
  }

  const v3 = new THREE.Vector3();
  function project(world3, out) {
    v3.copy(world3).project(camera);
    out.x = (v3.x * 0.5 + 0.5) * W;
    out.y = (-v3.y * 0.5 + 0.5) * H;
    out.visible = v3.z > -1 && v3.z < 1;
    return out;
  }

  window.addEventListener('resize', resize);
  return {
    renderer,
    scene,
    camera,
    van,
    world,
    update,
    project,
    resize,
    setActive(v) {
      active = v;
    },
    setCovered(v) {
      covered = v;
    },
    bloom,
    setComposer(v) {
      useComposer = v;
    },
    TOWER,
    towerTop: world.towerPos,
    nodePos: world.nodePos,
  };
}
