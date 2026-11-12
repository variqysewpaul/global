// Air. A studio with nothing in it but products looks like a render; a little haze in the key lights and dust drifting through them
// is what makes it look like a room. Both are cheap, both are additive, and neither writes depth.
import * as THREE from 'three';

// Motes of dust, drifting slowly, visible only where a key light is on them. A few are large and soft: out-of-focus specks close to
// the lens, the thing that gives a camera move its sense of depth.
export function makeDust(centers, count = 820) {
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count * 4); // phase, size (world units), speed, brightness
  const rnd = (a, b) => a + Math.random() * (b - a);
  const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
  for (let i = 0; i < count; i++) {
    const c = centers[i % centers.length];
    positions.set([c[0] + gauss() * 4.2, Math.max(0.25, c[1] + gauss() * 2.4), c[2] + gauss() * 4.5 + 1.5], i * 3);
    const soft = i % 11 === 0;
    seeds.set([Math.random(), soft ? rnd(0.12, 0.26) : rnd(0.006, 0.015), rnd(0.4, 1.2), soft ? rnd(0.14, 0.26) : rnd(0.9, 1.8)], i * 4);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uScale: { value: 1000 }, // pixels per world unit at distance 1
      uCenters: { value: centers.map((c) => new THREE.Vector3(...c)) },
      uColor: { value: new THREE.Color('#ffe6f2') },
      uAmount: { value: 1 },
    },
    vertexShader: /* glsl */ `
      attribute vec4 aSeed;
      uniform float uTime;
      uniform float uScale;
      uniform vec3 uCenters[${centers.length}];
      varying float vAlpha;
      void main() {
        float t = uTime * aSeed.z;
        vec3 p = position;
        p += vec3(sin(t + aSeed.x * 6.2831), cos(t * 0.7 + aSeed.x * 17.0) * 0.5, sin(t * 0.53 + aSeed.x * 9.0)) * 0.4;
        p.y += mod(uTime * 0.04 * aSeed.z + aSeed.x * 5.0, 5.0) - 2.5; // a slow rise, wrapping
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float dist = max(0.001, -mv.z);
        gl_PointSize = clamp(aSeed.y * uScale / dist, 1.0, 72.0);
        // only where a key light reaches
        float lit = 0.0;
        for (int i = 0; i < ${centers.length}; i++) {
          vec3 d = p - uCenters[i];
          lit = max(lit, exp(-dot(d, d) / 16.0));
        }
        float twinkle = 0.55 + 0.45 * sin(uTime * (0.7 + aSeed.z) + aSeed.x * 40.0);
        vAlpha = aSeed.w * lit * twinkle * smoothstep(0.5, 2.8, dist) * (1.0 - smoothstep(30.0, 60.0, dist));
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uAmount;
      varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        float a = 1.0 - smoothstep(0.0, 1.0, d);
        a *= a;
        gl_FragColor = vec4(uColor * a * vAlpha * uAmount, a * vAlpha * uAmount);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.renderOrder = 5;
  return points;
}

// The beam of a spot light, as a faint additive cone: brightest through its middle, gone at its edges and at the far end.
export function lightCone(spot, { color = '#fff0e0', amount = 0.07 } = {}) {
  const target = spot.target.position;
  const length = spot.position.distanceTo(target) * 1.05;
  const radius = Math.tan(spot.angle) * length;
  const geometry = new THREE.ConeGeometry(radius, length, 56, 1, true);
  geometry.translate(0, -length / 2, 0); // the apex at the origin, opening toward -y
  const material = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uAmount: { value: amount }, uBase: { value: amount }, uTime: { value: 0 }, uLength: { value: length } },
    vertexShader: /* glsl */ `
      uniform float uLength;
      varying vec3 vWorld;
      varying vec3 vNormal;
      varying float vT;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        vNormal = normalize(mat3(modelMatrix) * normal);
        vT = -position.y / uLength;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uAmount;
      uniform float uTime;
      varying vec3 vWorld;
      varying vec3 vNormal;
      varying float vT;
      void main() {
        vec3 V = normalize(cameraPosition - vWorld);
        float facing = abs(dot(normalize(vNormal), V));      // 1 through the middle of the beam, 0 at its edges
        float along = smoothstep(0.0, 0.18, vT) * (1.0 - smoothstep(0.5, 1.0, vT));
        float drift = 0.8 + 0.2 * sin(vWorld.y * 2.7 + vWorld.x * 1.9 + uTime * 0.35);
        float a = pow(facing, 2.2) * along * drift * uAmount;
        gl_FragColor = vec4(uColor * a, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.FrontSide,
    blending: THREE.AdditiveBlending,
  });
  const cone = new THREE.Mesh(geometry, material);
  cone.position.copy(spot.position);
  cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), target.clone().sub(spot.position).normalize());
  cone.renderOrder = 4;
  cone.frustumCulled = false;
  return cone;
}
