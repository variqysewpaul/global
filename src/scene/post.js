// The finishing pipeline: what turns a clean render into something that looks photographed.
//
// The scene is drawn into a half-float (HDR) multisampled target, so highlights keep their energy instead of clipping, then:
//   1. Bloom, from a chain of small blurred copies (the "dual filter" used by modern game engines): only values brighter than
//      the threshold (LEDs, beams, chrome highlights) spill light, with a soft knee so nothing pops.
//   2. One composite pass, in this order: depth of field (a gather blur whose radius follows each pixel's distance from the
//      focus plane, so the product is sharp and the wall behind it softens), a directional blur along the camera's motion
//      (what a 180-degree shutter does to a whip pan), a hair of chromatic aberration toward the edges, the bloom, a colour
//      grade (exposure, contrast, split-toned shadows and highlights, saturation), a lens vignette, then three's own filmic
//      tone mapping and sRGB encode, and last film grain and a triangular dither (dark gradients band badly in 8 bits).
//
// Everything except the last step happens in linear light, which is what makes the glow and the blur behave like optics.
// Devices without float render targets (or phones, which cannot afford it) draw straight to the screen instead.
import * as THREE from 'three';

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

// 13 taps around the pixel, in texels of the input
const TAPS13 = /* glsl */ `
  vec3 a = fetch(vec2(-2.0, -2.0)), b = fetch(vec2(0.0, -2.0)), c = fetch(vec2(2.0, -2.0));
  vec3 d = fetch(vec2(-2.0, 0.0)), e = fetch(vec2(0.0, 0.0)), f = fetch(vec2(2.0, 0.0));
  vec3 g = fetch(vec2(-2.0, 2.0)), h = fetch(vec2(0.0, 2.0)), i = fetch(vec2(2.0, 2.0));
  vec3 j = fetch(vec2(-1.0, -1.0)), k = fetch(vec2(1.0, -1.0)), l = fetch(vec2(-1.0, 1.0)), m = fetch(vec2(1.0, 1.0));
`;

// first step: threshold with a soft knee, and a brightness-weighted average so a single hot pixel cannot flicker
const PREFILTER = /* glsl */ `
  uniform sampler2D tInput;
  uniform vec2 uTexel;
  uniform float uThreshold;
  uniform float uKnee;
  varying vec2 vUv;
  vec3 fetch(vec2 o) { return min(texture2D(tInput, vUv + o * uTexel).rgb, vec3(24.0)); }
  float br(vec3 c) { return max(c.r, max(c.g, c.b)); }
  void main() {
    ${TAPS13}
    vec3 g0 = (a + b + d + e) * 0.25, g1 = (b + c + e + f) * 0.25, g2 = (d + e + g + h) * 0.25, g3 = (e + f + h + i) * 0.25, g4 = (j + k + l + m) * 0.25;
    float w0 = 0.125 / (1.0 + br(g0)), w1 = 0.125 / (1.0 + br(g1)), w2 = 0.125 / (1.0 + br(g2)), w3 = 0.125 / (1.0 + br(g3)), w4 = 0.5 / (1.0 + br(g4));
    vec3 col = (g0 * w0 + g1 * w1 + g2 * w2 + g3 * w3 + g4 * w4) / (w0 + w1 + w2 + w3 + w4);
    float v = br(col);
    float s = clamp(v - uThreshold + uKnee, 0.0, 2.0 * uKnee);
    s = s * s / (4.0 * uKnee + 1e-4);
    float keep = max(s, v - uThreshold) / max(v, 1e-4);
    gl_FragColor = vec4(col * keep, 1.0);
  }
`;

const DOWNSAMPLE = /* glsl */ `
  uniform sampler2D tInput;
  uniform vec2 uTexel;
  varying vec2 vUv;
  vec3 fetch(vec2 o) { return texture2D(tInput, vUv + o * uTexel).rgb; }
  void main() {
    ${TAPS13}
    gl_FragColor = vec4(e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125, 1.0);
  }
`;

// a tent filter on the smaller level, added onto the larger one (additive blending)
const UPSAMPLE = /* glsl */ `
  uniform sampler2D tInput;
  uniform vec2 uTexel;
  uniform float uScatter;
  varying vec2 vUv;
  vec3 fetch(vec2 o) { return texture2D(tInput, vUv + o * uTexel).rgb; }
  void main() {
    vec3 col = fetch(vec2(-1.0, -1.0)) + fetch(vec2(0.0, -1.0)) * 2.0 + fetch(vec2(1.0, -1.0))
             + fetch(vec2(-1.0, 0.0)) * 2.0 + fetch(vec2(0.0, 0.0)) * 4.0 + fetch(vec2(1.0, 0.0)) * 2.0
             + fetch(vec2(-1.0, 1.0)) + fetch(vec2(0.0, 1.0)) * 2.0 + fetch(vec2(1.0, 1.0));
    gl_FragColor = vec4(col * (uScatter / 16.0), 1.0);
  }
`;

const COMPOSITE = /* glsl */ `
  uniform sampler2D tScene;
  uniform sampler2D tDepth;
  uniform sampler2D tBloom;
  uniform vec2 uRes;          // drawing-buffer size in pixels
  uniform float uNear;
  uniform float uFar;
  uniform float uFocus;       // distance from the camera to the plane in focus
  uniform float uAperture;    // blur radius, in pixels (at 1080 lines), of something at infinity
  uniform float uMaxCoc;      // the biggest blur radius, in pixels
  uniform vec2 uVel;          // where the picture moved this frame, in uv: the motion blur runs along it
  uniform float uBloom;
  uniform vec3 uBloomTint;
  uniform float uExposure;
  uniform float uContrast;
  uniform float uSat;
  uniform vec3 uShadow;       // added to the darks: the split-tone
  uniform vec3 uHigh;         // multiplies the lights
  uniform float uVignette;
  uniform float uGrain;
  uniform float uCA;
  uniform float uTime;
  uniform float uDof;         // 0 or 1
  varying vec2 vUv;

  float viewDist(float d) {
    float z = d * 2.0 - 1.0;
    return 2.0 * uNear * uFar / (uFar + uNear - z * (uFar - uNear));
  }
  // blur radius in pixels (always positive); the empty background counts as in focus, so glows and beams over it stay crisp
  float cocAt(vec2 uv) {
    float d = texture2D(tDepth, uv).x;
    if (d > 0.99999) return 0.0;
    float z = viewDist(d);
    return min(abs(z - uFocus) / z * uAperture * (uRes.y / 1080.0), uMaxCoc);
  }
  float hash(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }
  float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
  vec3 scene(vec2 uv) { return min(texture2D(tScene, uv).rgb, vec3(32.0)); }

  void main() {
    vec2 px = 1.0 / uRes;
    vec2 uv = vUv;
    vec2 fromCentre = uv - 0.5;
    // chromatic aberration: red and blue shift in opposite directions, more toward the edges
    vec2 ca = fromCentre * uCA;
    vec3 col = vec3(scene(uv + ca).r, scene(uv).g, scene(uv - ca).b);

    // depth of field: a golden-angle gather, each tap counted only if its own blur reaches this pixel
    float coc = uDof > 0.5 ? cocAt(uv) : 0.0;
    if (coc > 0.6) {
      vec3 sum = col;
      float wsum = 1.0;
      float rot = ign(gl_FragCoord.xy) * 6.2831853;
      for (int i = 0; i < 20; i++) {
        float fi = float(i) + 0.5;
        float r = sqrt(fi / 20.0) * coc;
        float a = fi * 2.3999632 + rot;
        vec2 o = vec2(cos(a), sin(a)) * r;
        vec2 suv = uv + o * px;
        float sc = cocAt(suv);
        float w = clamp(sc - r + 1.0, 0.0, 1.0);
        sum += scene(suv) * w;
        wsum += w;
      }
      col = sum / wsum;
    }

    // motion blur along the camera's movement
    float speed = length(uVel);
    if (speed > 0.0006) {
      vec3 acc = col;
      for (int i = 1; i < 9; i++) acc += scene(uv + uVel * (float(i) / 8.0 - 0.5));
      col = mix(col, acc / 9.0, smoothstep(0.0006, 0.003, speed));
    }

    // bloom
    col += texture2D(tBloom, uv).rgb * uBloom * uBloomTint;

    // the grade, in linear light
    col *= uExposure;
    float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
    col = pow(max(col, vec3(0.0)) / 0.18, vec3(uContrast)) * 0.18;
    col += uShadow * (1.0 - smoothstep(0.0, 0.45, l));
    col = mix(col, col * uHigh, smoothstep(0.3, 2.2, l));
    float g = dot(col, vec3(0.2126, 0.7152, 0.0722));
    col = mix(vec3(g), col, uSat);

    // lens vignette: a falloff in exposure, wider than tall
    vec2 q = fromCentre * vec2(uRes.x / uRes.y, 1.0);
    col *= 1.0 - uVignette * smoothstep(0.35, 1.25, length(q));

    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>

    // film grain, strongest in the mid-tones, and a triangular dither against banding
    float o = dot(gl_FragColor.rgb, vec3(0.3333));
    float grain = hash(gl_FragCoord.xy + fract(uTime * 7.13) * 311.0) - 0.5;
    gl_FragColor.rgb += grain * uGrain * (0.35 + 1.3 * o * (1.0 - o));
    gl_FragColor.rgb += (hash(gl_FragCoord.xy * 1.7 + fract(uTime) * 97.0) + hash(gl_FragCoord.yx * 0.9 + 13.0) - 1.0) / 255.0;
  }
`;

const fullscreen = (material) => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 2, 0, 0, 2]), 2));
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  const scene = new THREE.Scene();
  scene.add(mesh);
  return { scene, mesh, geometry };
};

const pass = (fragmentShader, uniforms, extra = {}) =>
  new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader, uniforms, depthTest: false, depthWrite: false, ...extra });

export class Post {
  static supported(renderer) {
    return renderer.capabilities.isWebGL2 && (renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float'));
  }

  constructor(renderer) {
    this.renderer = renderer;
    this.levels = 5;
    this.dof = true;
    this.bloom = true;
    this.width = 0;
    this.height = 0;
    this.camera = new THREE.Camera(); // the vertex shader ignores it
    this.mips = [];
    this.sceneRT = null;

    this.prefilter = pass(PREFILTER, { tInput: { value: null }, uTexel: { value: new THREE.Vector2() }, uThreshold: { value: 1 }, uKnee: { value: 0.5 } });
    this.down = pass(DOWNSAMPLE, { tInput: { value: null }, uTexel: { value: new THREE.Vector2() } });
    this.up = pass(UPSAMPLE, { tInput: { value: null }, uTexel: { value: new THREE.Vector2() }, uScatter: { value: 0.7 } }, { blending: THREE.AdditiveBlending });
    this.composite = pass(COMPOSITE, {
      tScene: { value: null },
      tDepth: { value: null },
      tBloom: { value: null },
      uRes: { value: new THREE.Vector2(1, 1) },
      uNear: { value: 0.05 },
      uFar: { value: 220 },
      uFocus: { value: 8 },
      uAperture: { value: 10 },
      uMaxCoc: { value: 9 },
      uVel: { value: new THREE.Vector2() },
      uBloom: { value: 0.5 },
      uBloomTint: { value: new THREE.Color(1, 0.92, 1) },
      uExposure: { value: 1 },
      uContrast: { value: 1.05 },
      uSat: { value: 1.05 },
      uShadow: { value: new THREE.Color(0.008, 0.004, 0.02) },
      uHigh: { value: new THREE.Color(1.02, 0.98, 1.03) },
      uVignette: { value: 0.32 },
      uGrain: { value: 0.03 },
      uCA: { value: 0.0016 },
      uTime: { value: 0 },
      uDof: { value: 1 },
    });
    this.fsPrefilter = fullscreen(this.prefilter);
    this.fsDown = fullscreen(this.down);
    this.fsUp = fullscreen(this.up);
    this.fsComposite = fullscreen(this.composite);
    this.black = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
    this.black.needsUpdate = true;
  }

  /** (Re)allocate every target for a drawing buffer of w x h pixels. */
  setSize(w, h) {
    w = Math.max(2, Math.round(w));
    h = Math.max(2, Math.round(h));
    if (w === this.width && h === this.height && this.sceneRT) return;
    this.width = w;
    this.height = h;
    this.sceneRT?.depthTexture?.dispose();
    this.sceneRT?.dispose();
    const samples = Math.min(4, this.renderer.capabilities.maxSamples || 0);
    const depthTexture = new THREE.DepthTexture(w, h, THREE.UnsignedIntType);
    this.sceneRT = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples, depthBuffer: true, depthTexture, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false });
    for (const m of this.mips) m.dispose();
    this.mips = [];
    for (let i = 0; i < this.levels; i++) {
      const mw = Math.max(2, w >> (i + 1));
      const mh = Math.max(2, h >> (i + 1));
      this.mips.push(new THREE.WebGLRenderTarget(mw, mh, { type: THREE.HalfFloatType, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false }));
    }
    this.composite.uniforms.uRes.value.set(w, h);
  }

  /**
   * Draw one frame. p: { focus, aperture, bloom, exposure, contrast, sat, shadow, high, vignette, grain, vel, time, near, far }
   * (see SecurityScene.grade). Leaves the renderer drawing to the screen.
   */
  render(scene, camera, p) {
    const r = this.renderer;
    const previousTarget = r.getRenderTarget();
    const previousAuto = r.autoClear;

    r.setRenderTarget(this.sceneRT);
    r.render(scene, camera); // clears to the background, draws, resolves the multisampling

    r.autoClear = false;
    let bloomTexture = this.black;
    if (this.bloom && p.bloom > 0.001) {
      const run = (fs, target, input, texel) => {
        const u = fs.mesh.material.uniforms;
        u.tInput.value = input;
        u.uTexel.value.copy(texel);
        r.setRenderTarget(target);
        r.render(fs.scene, this.camera);
      };
      const texel = new THREE.Vector2();
      this.prefilter.uniforms.uThreshold.value = p.threshold ?? 1;
      this.prefilter.uniforms.uKnee.value = 0.6;
      run(this.fsPrefilter, this.mips[0], this.sceneRT.texture, texel.set(1 / this.width, 1 / this.height));
      for (let i = 1; i < this.levels; i++) run(this.fsDown, this.mips[i], this.mips[i - 1].texture, texel.set(1 / this.mips[i - 1].width, 1 / this.mips[i - 1].height));
      for (let i = this.levels - 2; i >= 0; i--) run(this.fsUp, this.mips[i], this.mips[i + 1].texture, texel.set(1 / this.mips[i + 1].width, 1 / this.mips[i + 1].height));
      bloomTexture = this.mips[0].texture;
    }

    const u = this.composite.uniforms;
    u.tScene.value = this.sceneRT.texture;
    u.tDepth.value = this.sceneRT.depthTexture;
    u.tBloom.value = bloomTexture;
    u.uNear.value = camera.near;
    u.uFar.value = camera.far;
    u.uFocus.value = p.focus;
    u.uAperture.value = p.aperture;
    u.uDof.value = this.dof ? 1 : 0;
    u.uVel.value.copy(p.vel);
    u.uBloom.value = bloomTexture === this.black ? 0 : p.bloom;
    u.uExposure.value = p.exposure;
    u.uContrast.value = p.contrast;
    u.uSat.value = p.sat;
    u.uShadow.value.copy(p.shadow);
    u.uHigh.value.copy(p.high);
    u.uVignette.value = p.vignette;
    u.uGrain.value = p.grain;
    u.uTime.value = p.time;
    r.setRenderTarget(null);
    r.render(this.fsComposite.scene, this.camera);

    r.autoClear = previousAuto;
    r.setRenderTarget(previousTarget);
  }

  dispose() {
    this.sceneRT?.depthTexture?.dispose();
    this.sceneRT?.dispose();
    for (const m of this.mips) m.dispose();
    for (const fs of [this.fsPrefilter, this.fsDown, this.fsUp, this.fsComposite]) {
      fs.geometry.dispose();
      fs.mesh.material.dispose();
    }
    this.black.dispose();
  }
}
