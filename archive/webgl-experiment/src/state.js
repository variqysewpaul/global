// Shared, GSAP-tweened story state. The scroll timeline writes to it,
// the render loop (stage.js) reads from it. Nothing else mutates it.
export const state = {
  T: 0, // master timeline position, 0..100

  // camera rig
  cam: { x: -6.4, y: 1.35, z: 7.4 },
  look: { x: 0.2, y: 0.8, z: 0.2 },
  fov: 34,
  shiftX: 0.16, // sideways framing offset (fraction of viewport width)
  shiftY: 0,

  // world
  fog: 0.0105,
  mapMix: 0, // 0 = street level, 1 = control-room radar view

  // van
  carT: 0, // 0..1 along the speed profile (see story.js / world.js)
  routeU: 0, // derived each frame: 0..1 distance along the route
  headlights: 0,

  // photoreal footage layer (only used when public/frames/<name>/ exists)
  seq: 0, // frame position 0..1
  seqMix: 0, // canvas opacity: crossfade from WebGL to footage

  // control-room sequence
  alarm: 0, // alarm trips at the client premises
  sig1: 0, // pulse premises -> control room
  tower: 0, // control room lights up
  sig2: 0, // pulse control room -> van
  cleared: 0, // van on site, perimeter calmed
  gate: 0, // gate leaf open amount
};
