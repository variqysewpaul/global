import * as THREE from 'three';
import { smooth, lerp, BG, DECALS, studioEnvironment, makeFloor, createRenderer } from './kit.js';
import { makeMaterials, buildBulletCamera, stationLight } from './models.js';
import { buildGateMotor, buildBeamPosts, buildMonitors } from './models2.js';
import { Post } from './post.js';
import { makeDust, lightCone } from './atmosphere.js';

/*
 * One studio, four stations, lit like a product shot: a bullet camera on a plaster wall, a gate motor on its rack, a beam sensor
 * pair, a wall of monitors. The page scrolls the camera between them (chapter time t = 0 intro, 1 CCTV, 2 gates, 3 beams,
 * 4 control room). Everything is generated in code: no models, no textures are downloaded.
 */

export const STATION_GAP = 16;
const station = (i) => [i * STATION_GAP, 0, 0];
const UP = new THREE.Vector3(0, 1, 0);

// The look of each chapter (0 intro, 1 CCTV, 2 gates, 3 beams, 4 control room), blended as the camera travels between them:
// exposure, contrast and saturation; the split-tone (a tint added to the darks, one multiplied into the lights); how much the
// highlights bloom; and the lens (how far out of focus something at infinity falls, in pixels at 1080 lines). The macro on the
// CCTV camera has the shallowest focus; the control room is the deepest.
const MOODS = [
  { exposure: 1.0, contrast: 1.08, sat: 1.08, shadow: [0.0026, 0.001, 0.007], high: [1.04, 0.97, 1.0], bloom: 0.55, aperture: 12 },
  { exposure: 1.0, contrast: 1.1, sat: 1.06, shadow: [0.003, 0.001, 0.008], high: [1.03, 0.97, 1.03], bloom: 0.6, aperture: 16 },
  { exposure: 1.02, contrast: 1.08, sat: 1.05, shadow: [0.002, 0.001, 0.006], high: [1.05, 0.98, 0.98], bloom: 0.5, aperture: 11 },
  { exposure: 1.04, contrast: 1.1, sat: 1.1, shadow: [0.004, 0.001, 0.009], high: [1.0, 0.96, 1.06], bloom: 0.55, aperture: 9 },
  { exposure: 1.0, contrast: 1.07, sat: 1.04, shadow: [0.0015, 0.002, 0.008], high: [0.98, 0.99, 1.06], bloom: 0.5, aperture: 8 },
];

export class SecurityScene {
  constructor(canvas, lowPower = false, context) {
    this.canvas = canvas;
    this.lowPower = lowPower;
    const { renderer, maxPixelRatio } = createRenderer(canvas, context, lowPower);
    this.renderer = renderer;
    // Big screens get the finishing pipeline (HDR, bloom, depth of field, grade, grain: see post.js). Phones draw straight to the
    // screen with the browser's own antialiasing: the pipeline costs more than the scene itself on a small chip. ?nopost skips it.
    const wantPost = !lowPower && !new URLSearchParams(location.search).has('nopost') && Post.supported(renderer);
    this.post = wantPost ? new Post(renderer) : null;
    this.grade = { focus: 8, aperture: 10, bloom: 0.5, threshold: 1.8, exposure: 1, contrast: 1.05, sat: 1.05, shadow: new THREE.Color(), high: new THREE.Color(), vignette: 0.34, grain: 0.028, vel: new THREE.Vector2(), time: 0 };
    this.focus = null; // distance to the plane in focus (null: not set yet, so the first frame is already in focus)
    this.lookPrev = new THREE.Vector3();
    this.pos = new THREE.Vector3();
    this.velocity = 0; // how fast the chapter time is changing (the camera's spring)
    this.slow = 0; // consecutive slow measurements at the lowest resolution
    this.havePrev = false;
    this.motion = new THREE.Vector2();
    this.tmpA = new THREE.Vector3();
    this.tmpB = new THREE.Vector3();
    this.maxPixelRatio = maxPixelRatio;
    this.pixelRatio = maxPixelRatio;
    this.scene = new THREE.Scene();
    this.scene.background = BG.clone();
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.05, 220);
    this.camera.layers.enable(DECALS);
    this.clock = new THREE.Clock();
    this.target = 0;
    this.current = 0;
    this.primed = false;
    this.covered = false;
    this.disposed = false;
    this.frameNo = 0;
    this.frameTime = 0;
    this.frameCount = 0;
    this.pointer = new THREE.Vector2();
    this.pointerSmooth = new THREE.Vector2();
    this.fixed = null; // [w, h] when drawing at a fixed size (snapshots)
    this.look = new THREE.Vector3();
    this.shots = [];
    this.onProgress = null;
    this.resize = this.resize.bind(this);
    this.loop = this.loop.bind(this);
    this.resize();
    // Follow the canvas's own box, not the window: on phones the address bar sliding away changes the window's height mid-scroll,
    // and re-allocating the drawing buffer then would stutter. The hero is sized in small-viewport units, so its box stays put.
    this.observer = new ResizeObserver(this.resize);
    this.observer.observe(canvas);
    /** Resolves once the scene is built (and drawing, if loop() has been started). */
    this.ready = this.build();
  }

  // the size to draw at, in CSS pixels
  size() {
    return this.fixed ?? [this.canvas.clientWidth || window.innerWidth, this.canvas.clientHeight || window.innerHeight];
  }

  reflectorSize() {
    const [w, h] = this.size();
    const scale = this.lowPower ? 0.35 : 0.5;
    return [Math.max(64, Math.round(w * this.pixelRatio * scale)), Math.max(64, Math.round(h * this.pixelRatio * scale))];
  }

  // Build a step at a time, handing the main thread back between steps (a timer, not an animation frame: frames pause in hidden
  // tabs), so the page stays scrollable while the 3D gets ready.
  async build() {
    const breathe = () => new Promise((r) => setTimeout(r, 0));
    const report = (p) => this.onProgress?.(p);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(studioEnvironment(), 0.02).texture;
    pmrem.dispose();
    report(0.15);
    await breathe();

    const m = makeMaterials();
    this.materials = m;
    this.floor = makeFloor([180, 80], this.reflectorSize());
    this.floor.position.set(24, 0, 14);
    this.floor.camera.layers.enable(0);
    [this.reflW, this.reflH] = this.reflectorSize();
    this.renderOncePerFrame(this.floor);
    this.scene.add(this.floor);
    report(0.3);
    await breathe();

    const place = (group, i) => {
      group.position.set(...station(i));
      this.scene.add(group);
    };
    place(buildBulletCamera(m), 0);
    this.addKey(0);
    report(0.4);
    await breathe();
    place(buildGateMotor(m), 1);
    this.addKey(1, { from: [-5.2, 4.8, 7], target: [0.8, 1.3, 0.6], intensity: 230 });
    report(0.5);
    await breathe();
    const beams = buildBeamPosts(m);
    place(beams, 2);
    this.beams = beams.userData.beams;
    this.addKey(2, { from: [-6, 6.4, 8.5], target: [0, 3.4, 0], intensity: 280, angle: 0.55 });
    report(0.6);
    await breathe();
    place(buildMonitors(m), 3);
    this.addKey(3, { from: [-4, 6.6, 8.5], target: [0, 2.6, 0.5], intensity: 220, angle: 0.5 });
    report(0.7);
    await breathe();

    // a faint pink rim from behind, shared by every station
    const rim = new THREE.DirectionalLight('#ff8fc8', 0.7);
    rim.position.set(12, 6, -14);
    this.scene.add(rim);

    // dust in the key lights
    this.dust = makeDust([[0, 1.6, 0.5], [16, 1.4, 0.5], [32, 3.4, 0], [48, 2.6, 0.5]], this.lowPower ? 260 : 820);
    this.scene.add(this.dust);

    this.buildShots();
    // compile every shader off the main thread where the browser supports it, one object at a time (for the target the scene is
    // really drawn into: programs differ between the screen, which tone-maps, and the HDR target, which does not)
    if (this.post) this.renderer.setRenderTarget(this.post.sceneRT);
    for (const object of [...this.scene.children]) {
      await this.renderer.compileAsync(object, this.camera, this.scene);
      await breathe();
      if (this.disposed) return;
    }
    this.renderer.setRenderTarget(null);
    report(1);
  }

  // A key light for station i and the faint haze of its beam (the haze is only visible while the camera is at that station).
  addKey(i, options) {
    const group = stationLight(station(i), options);
    this.scene.add(group);
    const cone = lightCone(group.children[0], { amount: this.lowPower ? 0.1 : 0.16 });
    this.scene.add(cone);
    (this.cones ??= [])[i] = cone;
  }

  // How much the camera is at station i, 0-1 (the CCTV station owns the opening shot and the close-up).
  stationWeight(i, t) {
    let w = 0;
    for (const c of i === 0 ? [0, 1] : [i + 1]) w = Math.max(w, 1 - smooth(0.35, 1.05, Math.abs(t - c)));
    return w;
  }

  // camera positions for each chapter: [pos, look, fov]
  buildShots() {
    const at = (i, p) => new THREE.Vector3(...station(i)).add(new THREE.Vector3(...p));
    // On wide screens each shot looks left of the product, so it sits right of centre and the copy owns the left. `subjectX` is
    // where the product really is: on tall screens (phones) the camera slides across by the difference to centre it.
    const shot = (i, pos, look, fov, subjectX) => ({ pos: at(i, pos), look: at(i, look), fov, dx: subjectX - look[0] });
    this.shots = [
      shot(0, [1.9, 1.55, 7.6], [-1.1, 1.5, 0.3], 28, -0.5), // 0 intro: the bracket and its reflection
      shot(0, [3.5, 1.45, 4.3], [-0.45, 1.55, 0.7], 30, 0.15), // 1 CCTV: close on the lens
      shot(1, [3.4, 1.7, 9.4], [-1.0, 1.3, 0.4], 30, 0), // 2 gates: the motor and its drive
      shot(2, [-0.8, 3.5, 12.8], [-4.8, 3.4, 0], 30, -3.2), // 3 sensors: the left post and the beams leaving it
      shot(3, [0.2, 3.3, 11.8], [-1.6, 3.0, 0], 30, 0), // 4 control room: the monitor wall
    ];
  }

  // A mirror re-renders the whole scene each time it is drawn; never do that more than once a frame (every other frame on phones).
  renderOncePerFrame(mirror) {
    const render = mirror.onBeforeRender.bind(mirror);
    const every = this.lowPower ? 2 : 1;
    let last = -1;
    mirror.onBeforeRender = (...args) => {
      if (last === this.frameNo || (last >= 0 && this.frameNo - last < every)) return;
      last = this.frameNo;
      render(...args);
    };
  }

  setProgress(t) {
    this.target = Math.max(0, Math.min(this.shots.length - 1 || 0, t));
    // First reading (a reload part-way down the page): cut straight there.
    if (!this.primed) {
      this.primed = true;
      this.current = this.target;
    }
  }
  setPointer(x, y) {
    this.pointer.set(x, y);
  }
  /** True while something opaque fills the screen (or the hero is off screen): drawing is skipped. */
  setCovered(c) {
    this.covered = c;
  }

  resize() {
    const [w, h] = this.size();
    this.renderer.setPixelRatio(this.fixed ? 1 : this.pixelRatio);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.post?.setSize(w * (this.fixed ? 1 : this.pixelRatio), h * (this.fixed ? 1 : this.pixelRatio));
    this.syncReflector();
  }

  // Keep the mirror's resolution in step with the screen, but only when it is clearly different (resizing re-allocates it).
  syncReflector() {
    if (!this.floor) return;
    const [w, h] = this.reflectorSize();
    if (Math.abs(w - this.reflW) / this.reflW < 0.12 && Math.abs(h - this.reflH) / this.reflH < 0.12) return;
    this.floor.getRenderTarget().setSize(w, h);
    [this.reflW, this.reflH] = [w, h];
  }

  placeCamera(t, time) {
    // development: a fixed camera for stills (see snapCam)
    if (this.override) {
      const o = this.override;
      this.camera.position.set(...o.pos);
      this.look.set(...o.look);
      this.camera.fov = o.fov;
      this.camera.lookAt(this.look);
      this.camera.updateProjectionMatrix();
      this.floor.material.uniforms.uFocus.value.set(this.look.x, this.look.z);
      return;
    }
    const last = this.shots.length - 1;
    const i = Math.min(last - 1, Math.floor(t));
    const k = last > 0 ? smooth(0.2, 0.8, t - i) : 0; // dwell at each station, glide between
    const a = this.shots[Math.max(0, i)];
    const b = this.shots[Math.min(last, i + 1)];
    // The move. The body eases harder than the scroll does (a long dwell, a quick glide) and the eye leads the head, arriving on
    // the next subject a beat early. Between stations the camera also cranes up, pulls back and widens a little, like a dolly on
    // a short boom, then pushes in as it lands: that arc is what makes it read as a camera and not as a slide.
    const kp = lerp(k, smooth(0, 1, k), 0.6);
    const kl = smooth(0, 1, Math.min(1, Math.max(0, (k - 0.5) * 1.2 + 0.5)));
    const arc = Math.sin(Math.PI * k);
    const pos = this.pos.lerpVectors(a.pos, b.pos, kp);
    this.look.lerpVectors(a.look, b.look, kl);
    pos.addScaledVector(this.tmpA.copy(pos).sub(this.look).normalize(), arc * 1.8);
    pos.y += arc * 0.5;
    let fov = lerp(a.fov, b.fov, kp) + arc * 3.5;
    let roll = -arc * 0.03 * Math.sign(b.pos.x - a.pos.x); // banks into the move
    // The pointer swings the camera a few degrees round the subject (real parallax: near things move more than far ones).
    pos.sub(this.look).applyAxisAngle(UP, -this.pointerSmooth.x * 0.06).add(this.look);
    pos.y += this.pointerSmooth.y * 0.22;
    // Hand-held: slow and uneven, never quite repeating (two unrelated waves per axis).
    pos.x += (Math.sin(time * 0.37) + 0.5 * Math.sin(time * 0.91 + 1.3)) * 0.026;
    pos.y += (Math.sin(time * 0.29 + 2) + 0.5 * Math.sin(time * 0.77)) * 0.018;
    roll += Math.sin(time * 0.43) * 0.0016 + Math.sin(time * 1.1 + 0.6) * 0.0006;
    this.camera.position.copy(pos);
    // tall screens (phones): centre the product, lift it into the top half clear of the copy, and keep it as wide on screen
    const tall = smooth(1.1, 0.75, this.camera.aspect); // 0 on wide screens, 1 on an upright phone
    if (tall > 0) {
      const dx = lerp(a.dx, b.dx, kp) * tall;
      this.camera.position.x += dx;
      this.look.x += dx;
      this.look.y -= 0.9 * tall;
      const narrow = THREE.MathUtils.radToDeg(2 * Math.atan((Math.tan(THREE.MathUtils.degToRad(fov) / 2) / Math.max(0.5, this.camera.aspect)) * 0.9));
      fov = lerp(fov, Math.min(60, narrow), tall);
    }
    this.camera.fov = fov;
    this.camera.lookAt(this.look);
    this.camera.rotateZ(roll);
    this.camera.updateProjectionMatrix();
    this.floor.material.uniforms.uFocus.value.set(this.look.x, this.look.z);
  }

  render(dt = 0.016, time = this.clock.elapsedTime) {
    this.frameNo++;
    // The camera follows the scroll on a spring: it eases away, glides, and settles with the faintest overshoot.
    const wn = 4.8;
    const zeta = 0.86;
    this.velocity += (wn * wn * (this.target - this.current) - 2 * zeta * wn * this.velocity) * dt;
    this.current += this.velocity * dt;
    this.pointerSmooth.lerp(this.pointer, 1 - Math.exp(-dt * 3));
    // the beams pulse gently
    if (this.beams) for (const [i, b] of this.beams.entries()) b.material.opacity = b.userData.base * (0.86 + 0.14 * Math.sin(time * 3.1 + i));
    this.placeCamera(this.current, time);
    this.camera.updateMatrixWorld();
    // the haze comes up as the camera arrives at a station and goes as it leaves; the dust follows the lens
    if (this.cones) {
      for (const [i, cone] of this.cones.entries()) {
        const u = cone.material.uniforms;
        u.uAmount.value = u.uBase.value * this.stationWeight(i, this.current);
        u.uTime.value = time;
      }
    }
    if (this.dust) {
      const u = this.dust.material.uniforms;
      u.uTime.value = time;
      u.uScale.value = this.canvas.height / (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2));
    }
    if (this.post) this.post.render(this.scene, this.camera, this.gradeAt(this.current, time, dt));
    else this.renderer.render(this.scene, this.camera);
    this.lookPrev.copy(this.look);
    this.havePrev = true;
  }

  // The grade and the lens for chapter time t, written into this.grade (one object, reused every frame).
  gradeAt(t, time, dt) {
    const g = this.grade;
    const last = MOODS.length - 1;
    const i = Math.max(0, Math.min(last - 1, Math.floor(t)));
    const f = smooth(0.2, 0.8, t - i);
    const a = MOODS[i];
    const b = MOODS[Math.min(last, i + 1)];
    for (const k of ['exposure', 'contrast', 'sat', 'bloom', 'aperture']) g[k] = lerp(a[k], b[k], f);
    g.shadow.setRGB(lerp(a.shadow[0], b.shadow[0], f), lerp(a.shadow[1], b.shadow[1], f), lerp(a.shadow[2], b.shadow[2], f));
    g.high.setRGB(lerp(a.high[0], b.high[0], f), lerp(a.high[1], b.high[1], f), lerp(a.high[2], b.high[2], f));
    // autofocus on what the camera is looking at, a little late: the focus is pulled through the move
    const d = this.camera.position.distanceTo(this.look);
    this.focus = this.focus === null ? d : this.focus + (d - this.focus) * Math.min(1, dt * 5);
    g.focus = this.focus;
    // motion blur: how far the world streams past the lens during a 1/48 s shutter, as a share of the picture (along the camera's
    // right and up axes)
    if (this.havePrev && dt > 0) {
      const heightAtFocus = 2 * d * Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2);
      const widthAtFocus = heightAtFocus * this.camera.aspect;
      const m = this.tmpA.copy(this.look).sub(this.lookPrev).multiplyScalar(1 / dt);
      const x = m.dot(this.tmpB.setFromMatrixColumn(this.camera.matrixWorld, 0)) / widthAtFocus / 48;
      const y = m.dot(this.tmpB.setFromMatrixColumn(this.camera.matrixWorld, 1)) / heightAtFocus / 48;
      this.motion.lerp(this.tmpV2(x, y), Math.min(1, dt * 12));
    } else this.motion.set(0, 0);
    g.vel.copy(this.motion).clampLength(0, 0.05);
    g.time = time;
    return g;
  }
  tmpV2(x, y) {
    return (this._v2 ??= new THREE.Vector2()).set(x, y);
  }

  loop() {
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, this.clock.getDelta());
    if (this.covered) {
      this.current = this.target; // keep the camera where the scroll is, so it is in place when uncovered
      this.velocity = 0;
      return;
    }
    this.adaptResolution(dt);
    this.render(dt, this.clock.elapsedTime);
  }
  start() {
    if (!this.raf) this.loop();
  }

  // Trade resolution for frame rate: step down when frames run long, and back up when there is headroom again.
  adaptResolution(dt) {
    if (document.hidden) return;
    this.frameTime += dt;
    this.frameCount++;
    if (this.frameCount < 90) return;
    const avg = this.frameTime / this.frameCount;
    this.frameTime = 0;
    this.frameCount = 0;
    const minRatio = this.lowPower ? 0.75 : 1; // phones may go below 1 rather than stutter
    if (avg > 1 / 45 && this.pixelRatio > minRatio) {
      this.pixelRatio = Math.max(minRatio, this.pixelRatio - 0.25);
      this.resize();
    } else if (avg > 1 / 45 && this.post && ++this.slow >= 2) {
      // still slow at the lowest resolution, twice running: give up the depth of field first, then the bloom
      this.slow = 0;
      if (this.post.dof) this.post.dof = false;
      else this.post.bloom = false;
    } else if (avg < 1 / 75 && this.pixelRatio < this.maxPixelRatio) {
      this.pixelRatio = Math.min(this.maxPixelRatio, this.pixelRatio + 0.25);
      this.resize();
    }
  }

  /** Development: draw one frame at chapter time t at a fixed size and save it as .snaps/<name> (see vite.config.js). */
  async snap(name, t = this.target, w = 1280, h = 720, type = name.endsWith('.png') ? 'image/png' : 'image/jpeg') {
    this.fixed = [w, h];
    this.resize();
    this.setProgress(t);
    this.current = this.target;
    this.velocity = 0;
    this.focus = null;
    this.havePrev = false;
    this.render(0.016, 3);
    const blob = await new Promise((r) => this.canvas.toBlob(r, type, 0.88));
    await fetch('/__save?name=' + encodeURIComponent(name), { method: 'POST', body: blob });
    this.fixed = null;
    this.resize();
    return blob.size;
  }

  /** Development: like snap, but from a camera of your own: { pos: [x,y,z], look: [x,y,z], fov } in world units (station i is at x = i * 16). */
  async snapCam(name, cam, w, h) {
    this.override = cam;
    this.fixed = [w, h];
    this.resize();
    this.focus = null;
    this.havePrev = false;
    this.render(0.016, 3);
    const type = name.endsWith('.png') ? 'image/png' : 'image/jpeg';
    const blob = await new Promise((r) => this.canvas.toBlob(r, type, 0.9));
    await fetch('/__save?name=' + encodeURIComponent(name), { method: 'POST', body: blob });
    this.override = null;
    this.fixed = null;
    this.resize();
    return blob.size;
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.observer.disconnect();
    this.floor?.dispose();
    this.scene.traverse((o) => {
      o.geometry?.dispose();
      for (const mat of [].concat(o.material ?? [])) {
        for (const value of Object.values(mat)) if (value && value.isTexture) value.dispose();
        mat.dispose();
      }
    });
    this.scene.environment?.dispose();
    this.post?.dispose();
    this.renderer.dispose();
  }
}
