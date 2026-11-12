import * as THREE from 'three';
import { smooth, lerp, BG, DECALS, studioEnvironment, makeFloor, createRenderer } from './kit.js';
import { makeMaterials, buildBulletCamera, stationLight } from './models.js';
import { buildGateMotor, buildBeamPosts, buildMonitors } from './models2.js';

/*
 * One studio, four stations, lit like a product shot: a bullet camera on a plaster wall, a gate motor on its rack, a beam sensor
 * pair, a wall of monitors. The page scrolls the camera between them (chapter time t = 0 intro, 1 CCTV, 2 gates, 3 beams,
 * 4 control room). Everything is generated in code: no models, no textures are downloaded.
 */

export const STATION_GAP = 16;
const station = (i) => [i * STATION_GAP, 0, 0];

export class SecurityScene {
  constructor(canvas, lowPower = false, context) {
    this.canvas = canvas;
    this.lowPower = lowPower;
    // Rendered straight to the screen with the browser's own antialiasing: a post-processing chain costs more than the scene
    // itself on integrated graphics (grain and vignette are a CSS overlay instead).
    const { renderer, maxPixelRatio } = createRenderer(canvas, context, lowPower);
    this.renderer = renderer;
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
    this.scene.add(stationLight(station(0)));
    report(0.4);
    await breathe();
    place(buildGateMotor(m), 1);
    this.scene.add(stationLight(station(1), { from: [-5.2, 4.8, 7], target: [0.8, 1.3, 0.6], intensity: 230 }));
    report(0.5);
    await breathe();
    const beams = buildBeamPosts(m);
    place(beams, 2);
    this.beams = beams.userData.beams;
    this.scene.add(stationLight(station(2), { from: [-6, 6.4, 8.5], target: [0, 3.4, 0], intensity: 280, angle: 0.55 }));
    report(0.6);
    await breathe();
    place(buildMonitors(m), 3);
    this.scene.add(stationLight(station(3), { from: [-4, 6.6, 8.5], target: [0, 2.6, 0.5], intensity: 220, angle: 0.5 }));
    report(0.7);
    await breathe();

    // a faint pink rim from behind, shared by every station
    const rim = new THREE.DirectionalLight('#ff8fc8', 0.7);
    rim.position.set(12, 6, -14);
    this.scene.add(rim);

    this.buildShots();
    // compile every shader off the main thread where the browser supports it, one object at a time
    for (const object of [...this.scene.children]) {
      await this.renderer.compileAsync(object, this.camera, this.scene);
      await breathe();
      if (this.disposed) return;
    }
    report(1);
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
    this.camera.position.lerpVectors(a.pos, b.pos, k);
    this.look.lerpVectors(a.look, b.look, k);
    let fov = lerp(a.fov, b.fov, k);
    // hand-held drift and a little pointer parallax
    this.camera.position.x += Math.sin(time * 0.31) * 0.05 + this.pointerSmooth.x * 0.25;
    this.camera.position.y += Math.sin(time * 0.23) * 0.03 + this.pointerSmooth.y * 0.15;
    // tall screens (phones): centre the product, lift it into the top half clear of the copy, and keep it as wide on screen
    const tall = smooth(1.1, 0.75, this.camera.aspect); // 0 on wide screens, 1 on an upright phone
    if (tall > 0) {
      const dx = lerp(a.dx, b.dx, k) * tall;
      this.camera.position.x += dx;
      this.look.x += dx;
      this.look.y -= 0.9 * tall;
      const narrow = THREE.MathUtils.radToDeg(2 * Math.atan((Math.tan(THREE.MathUtils.degToRad(fov) / 2) / Math.max(0.5, this.camera.aspect)) * 0.9));
      fov = lerp(fov, Math.min(60, narrow), tall);
    }
    this.camera.fov = fov;
    this.camera.lookAt(this.look);
    this.camera.updateProjectionMatrix();
    this.floor.material.uniforms.uFocus.value.set(this.look.x, this.look.z);
  }

  render(dt = 0.016, time = this.clock.elapsedTime) {
    this.frameNo++;
    this.current += (this.target - this.current) * Math.min(1, dt * 4.5);
    this.pointerSmooth.lerp(this.pointer, Math.min(1, dt * 2.5));
    // the beams pulse gently
    if (this.beams) for (const [i, b] of this.beams.entries()) b.material.opacity = b.userData.base * (0.86 + 0.14 * Math.sin(time * 3.1 + i));
    this.placeCamera(this.current, time);
    this.renderer.render(this.scene, this.camera);
  }

  loop() {
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, this.clock.getDelta());
    if (this.covered) {
      this.current = this.target; // keep the camera where the scroll is, so it is in place when uncovered
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
    this.renderer.dispose();
  }
}
