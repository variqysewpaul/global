# Global Security Solutions — site

Vite + vanilla JS. **GSAP** (ScrollTrigger) for animation, **Lenis** for smooth scrolling, **three.js** for the hero scene.

```bash
npm install
npm run dev      # http://localhost:5173   (the 3D scene on its own: http://localhost:5173/dev3d.html)
npm run build    # static site in dist/
```

Build size: the page's own JavaScript is about 140 KB (53 KB gzipped). The 3D scene (three.js and the studio code) is a separate chunk of
about 557 KB (144 KB gzipped) that is fetched after the page's copy, and only on devices that will draw it on a real graphics chip.
There are no video frames, models or textures to download: the scene is generated in code. The two posters are 78 KB and 62 KB.

## Design intent

- **A product studio at the top, corporate everywhere else.** The hero is a real-time 3D scene lit like a product photograph: a dark
  studio, large softboxes, polished black floor, soft shadows, filmic tone mapping. Scrolling moves the camera from product to product
  (a CCTV camera, a gate motor, beam sensors, the control-room monitors). Because the camera is real, the movement is continuous: there
  are no frames to jump between. The lighting follows the approach of the Ekhaya site's water scene, so the sites share one look.
  Everything below the hero is plain, clear and professional: light and dark bands, sentence-case Montserrat headings, Inter body text,
  pink as an accent.
- **Light and transitions below the hero:** soft glows that drift across the dark sections, headings that wipe in, a process line that fills as you scroll.

## What's on the page

1. **Hero and services** (`src/hero3d.js`, `src/scene/`). One pinned stage (about 7.5 screens of scroll; 6 on phones). The camera starts on the
   opening shot with the headline, then glides to each station and rests there while its copy is read:
   - **CCTV:** a bullet camera on a plaster wall, close on the lens and its infrared ring.
   - **Gates:** a gate motor on its base, with the rack and pinion that drives the gate set out in front.
   - **Sensors & beams:** a pair of beam posts with violet beams between them.
   - **Control room & armed response:** a wall of monitors showing camera feeds, held to the end of the hero for the closing message.
   A stepper on the right (pills at the top on phones) jumps between stations, and each chapter's button pre-selects that option in the
   enquiry form.
2. **Key points** strip.
3. **Our approach** (grey): a large statement whose words light up as you scroll through it, and three numbered values (always on, always on the way, done properly).
4. **Armed response & control room** (dark): four steps (signal, operator, dispatch, on site) and a call to action, with rings spreading out behind it.
5. **Services** (light): numbered rows (alarms, gates, CCTV, hardware), each listing what's included with an "Enquire" link.
6. **Promise marquee**: a line of large type ("Always on. Always listening. Always on the way.") that drifts and leans into the scroll direction.
7. **About** (grey), **Coverage** (Google Maps loads only when the visitor clicks "Show map"), **FAQ** (native `<details>`), **Contact** (the form opens the visitor's email app), footer.

The structure and motion of the lower page borrow from armadillo-gs.com (numbered sections, a values marquee, masked headline reveals); the wording is our own, written only from the information the client supplied. The motion lives in `src/motion.js`: headlines (each word rises out of its own mask), the scroll-lit statement, numbered rows (a hairline draws across, then the content rises in), the rings, the marquee, and a ring that follows the pointer on fine pointers. All transform/opacity only; with reduced motion none of it runs and the content is simply there.

## The hero scene

| File | What it does |
|---|---|
| `src/hero3d.js` | The page side. Decides 3D or still, maps scroll to the scene's time (`STOPS`), fades each chapter's copy in and out, runs the stepper, pauses drawing when the hero is off screen, handles a lost graphics context. |
| `src/scene/context.js` | Asks for a WebGL2 context and refuses software rendering. No three.js in it, so the page can ask before downloading the 3D code. |
| `src/scene/kit.js` | The studio kit: the lit environment, textures generated in code, the polished floor, floor decals, the renderer. |
| `src/scene/models.js`, `models2.js` | The products (camera, gate motor, beam posts, monitors) and their materials. |
| `src/scene/SecurityScene.js` | Builds the scene a piece at a time, owns the shots and the camera, the frame loop, adaptive resolution and the snapshot helper. |

**Why it looks real.** Most of it is lighting, not geometry (the same recipe as the Ekhaya site):

- The studio is a dark room with large emissive softboxes (a big overhead panel, tall side strips, front fill cards, a violet back wall),
  baked once into an environment map (`PMREMGenerator`). Metal and glass have something to reflect, and that is most of what reads as real.
  A warm spot per station, aimed at the product, and a faint pink rim from behind add to it.
- Materials are physically based: brushed and satin metals with procedural roughness maps, clear-coated paint, glass with a dark
  interior, an iridescent lens coating, plaster with a generated relief. Edges are really rounded (`RoundedBoxGeometry`), because a
  rounded edge catching a softbox is what makes a part look machined.
- Soft shadows (VSM) are drawn once, because nothing that casts a shadow moves. ACES filmic tone mapping rolls highlights off like a camera.
- The floor is polished stone: a blurred mirror that strengthens at grazing angles (Fresnel), faint mineral grain, and an edge that
  dissolves into the dark. Contact shadows and light pools are decals kept out of the mirror.
- Beams are a crisp additive core plus soft gradient ribbons (no hard-edged tubes); LEDs are emissive with a glow sprite. There is no
  post-processing pass, which would cost more than the scene on integrated graphics.

**How it stays smooth.**

- The scene smooths the camera itself (`current += (target - current) * min(1, dt * 4.5)`) on top of Lenis, so scrolling in jumps still
  moves the camera in one continuous glide. The camera dwells at each station and glides between them.
- Resolution adapts: if frames average slower than 45 fps the pixel ratio steps down (never below 1); with headroom it steps back up.
  Measured here on an Intel Iris Xe: 1920 × 1080 at pixel ratio 1 about 110 fps, at 1.5 about 58 fps.
- The canvas follows its own box (a `ResizeObserver`), not the window, so a phone's address bar sliding away does not re-allocate it.
- The scene is built a step at a time, handing the main thread back in between (shaders compile with `compileAsync`), so the page stays
  scrollable while it loads. The poster is on screen meanwhile; the live scene fades in over it.
- Nothing is drawn while the hero is off screen or the tab is hidden. On phones the mirror redraws every other frame.

**Fallbacks.** The still poster (and no 3D download) is used on: reduced motion, Save-Data or a 2G connection, a device whose browser would draw
WebGL in software (SwiftShader, llvmpipe and friends, detected up front), a failed scene build, or `/?still`. In still mode the hero is
one screen with the intro copy; the Services cards below carry the rest of the information. If the graphics driver drops the context
mid-visit the poster comes back until it recovers.

### Changing the scene

- **Shots:** `buildShots()` in `SecurityScene.js`. Each shot is `[position, look-at, field of view, subjectX]`, relative to its station. On
  wide screens each shot looks to the left of the product so it sits right of centre and the copy owns the left; `subjectX` is where the
  product really is, so on phones the camera slides across to centre it.
- **Pacing:** `STOPS` in `src/hero3d.js` is the scroll progress (0–1 across the hero) at which the camera reaches the opening shot and each
  station; the last is held to the end. The hero's scroll length is `.hero { height }` in `src/style.css`. Keep the chapters in the same
  order as the stations: the `article.chapter` elements and stepper buttons in `index.html` are CCTV, Gates, Sensors & beams, Control room.
- **A new station:** write a `buildX(materials)` function that returns a group (see `models2.js`), place it with `place(group, i)` in
  `build()`, give it a `stationLight`, add a shot, add a chapter and a `STOPS` entry. Stations are 16 units apart (`STATION_GAP`).
- **Looking at it without a screen:** `/dev3d.html` runs the scene on its own. In the console (or a script), `__scene.snap('s2.jpg', 2, 1280, 720)`
  draws chapter time 2 at that size and writes `.snaps/s2.jpg` (the dev server accepts it; `.snaps/` is ignored by Git). A `.png` name saves a PNG.
  `?software` lets it draw even where the browser would use software rendering (slow, for checking pictures only).
- **Posters:** snap the opening shot as a PNG at 1600 × 900 and 900 × 1600, then
  `ffmpeg -y -i .snaps/poster-land.png -c:v libwebp -quality 86 -compression_level 6 public/poster.webp` (and the same for `poster-tall.webp`).
  Needs ffmpeg (winget package `Gyan.FFmpeg`). The posters are drawn by the scene itself, so the live scene fades in over an identical frame.
- Handy in the browser console: `__gss.hero.scene` (the scene), `__gss.lenis.stop()` before testing so a stray wheel event does not move the page.

## Accessibility

- Reduced motion, Save-Data, a 2G connection, no usable graphics chip or a failed build (force with `/?still`): the hero is the still poster with the same headline and calls to action. No 3D code is downloaded.
- Skip link jumps past the hero and moves keyboard focus to the next section; in-page links move focus to their target.
- One `h1`, logical headings, labelled regions and form fields, visible focus rings, `lang="en-ZA"`. The canvas is `aria-hidden` with a text description. The stepper is real buttons with `aria-current`. Hidden chapters are not focusable.
- Contrast: an automated pass over every text element below the hero found no failures against WCAG AA (run on an earlier version). The hero copy sits over the scene with a light shade behind it and should be re-checked.
- Third-party content (the map) loads only on request.

## Things to confirm with the client

- **The products in the scene** are generic, drawn in code (a bullet camera, a gate motor, beam posts, monitors); they are not the client's own equipment, and
  the beams are shown as glowing violet lines (real beams are invisible infrared), so the glow is a visual device. Real photography or footage of their installations would lift the page further.
- Copy is built only from the information supplied (services, areas, 24/7 control room and armed response). The FAQ, "about" and chapter wording should be approved. No claims such as years in business, response times, accreditations or pricing are made.
- **Logo:** redrawn as vector from the vinyl on the vehicle (`node scripts/build-logo.mjs` regenerates `public/logo.svg`, `logo-reverse.svg`, `logo-mark.svg`, the favicon and the symbols in `index.html`). The lettering uses Michroma as a stand-in and the figure is hand-drawn, so swap in the client's real vector logo when available.
- The contact form uses `mailto:`; connect a form service or backend when ready.

## Folders

`src/` page code (`scene/` is the 3D hero) · `public/` logo, favicon and posters · `scripts/` logo generator (and the frame generator for the archived clip hero) ·
`dev3d.html` the scene on its own, for development (not in the build) ·
`ai-brief/` the prompts and the clip an earlier version was built from ·
`archive/` earlier versions, none in the build: `clip-scrub-hero/` (the footage hero scrubbed by scroll: its `film.js` and `sequence.js`, and the frames),
`drawn-version/` (the illustrated, no-video hero), `video-version/`, `old-house/`, `clip-tour/`, `beam-macro-clip/`, `van-hero/`, `webgl-experiment/`, `stylised-sections/`.

**What is in the Git repository:** the code, the posters, the briefs and the source clip `ai-brief/source/walkthrough-v2.mp4`, and the code of every archived version.
Large working material is kept locally and is not in the repository: the other source clips, the guide stills and reference photos in `ai-brief/`, the
frame sets and images of the archived versions (the last published frames of the clip hero are in the Git history), and the development snapshots in `.snaps/`. See `.gitignore`.
