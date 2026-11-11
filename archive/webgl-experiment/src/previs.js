// Dev-only: renders deterministic guide frames from the WebGL scene into ./ai-brief/previs/
// for use as composition / motion guides in an AI image + video workflow. Not bundled in production.
//
//   const p = __gss.previs;  p.begin();
//   await p.still('previs/00-hero.png', { T: 0 });
//   await p.arrival({ from: 0, to: 40 });   // call repeatedly in chunks until it returns { done: true }
//   p.end();
import { state } from './state.js';

export function installPrevis({ stage, story, gsap }) {
  const canvas = document.getElementById('stage');
  let t = 0;

  const save = async (name, dataUrl) => {
    const r = await fetch(`/__save?path=${encodeURIComponent(name)}`, { method: 'POST', body: dataUrl });
    if (!r.ok) throw new Error(`save failed: ${await r.text()}`);
  };
  const frame = (dt, render) => {
    t += dt;
    state.shiftX = 0; // centred framing for guide frames
    state.shiftY = 0;
    stage.update(dt, t, render);
  };
  // run the physics for `n` frames without paying for a render
  const sim = (n, dt = 1 / 60) => {
    for (let i = 0; i < n; i++) frame(dt, false);
  };
  const shot = async (name) => {
    frame(1 / 60, true);
    await save(name, canvas.toDataURL('image/png'));
  };

  // arrival clip definition (kept in one place so stills and video agree)
  const CAM_T0 = 68;
  const CAM_T1 = 92;
  const CAR0 = 0.2;
  const carAt = (f) => CAR0 + (1 - CAR0) * f;

  const api = {
    begin() {
      document.documentElement.classList.add('previs');
      gsap.ticker.sleep();
    },
    end() {
      document.documentElement.classList.remove('previs');
      gsap.ticker.wake();
    },
    // a static guide frame; `f` (0..1) places the van along the arrival, T picks the camera/world state
    async still(name, { T = CAM_T1, f = null, settle = 90 } = {}) {
      story.tl.time(T);
      if (f !== null) state.carT = carAt(f);
      sim(settle);
      await shot(name);
      return name;
    },
    // frames [from, to) of the arrival video: the van drives at the camera, brakes, stops, then bounces during the hold
    async arrival({ from = 0, to = 40, fps = 24, seconds = 8, hold = 2.5, prefix = 'previs/arrival/f_' } = {}) {
      const nDrive = Math.round(fps * seconds);
      const total = nDrive + Math.round(fps * hold);
      const dt = 1 / fps;
      if (from === 0) {
        story.tl.time(CAM_T0);
        state.carT = carAt(0);
        sim(30);
      }
      for (let i = from; i < Math.min(to, total); i++) {
        const f = Math.min(1, i / nDrive);
        story.tl.time(CAM_T0 + (CAM_T1 - CAM_T0) * f);
        state.carT = carAt(f);
        frame(dt, true);
        await save(`${prefix}${String(i + 1).padStart(4, '0')}.png`, canvas.toDataURL('image/png'));
      }
      return { next: Math.min(to, total), total, done: to >= total };
    },
  };
  return api;
}
