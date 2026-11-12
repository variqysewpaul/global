# Global Security Solutions — site

Vite + vanilla JS. **GSAP** (ScrollTrigger) for animation, **Lenis** for smooth scrolling, **three.js** for the hero scene. Fonts: Montserrat (headings), Poppins (text), Inter (hero), Michroma (logo wordmark).

```bash
npm install
npm run dev      # http://localhost:5173   (the 3D scene on its own: http://localhost:5173/dev3d.html)
npm run build    # static site in dist/
```

Build size: the page's own JavaScript is about 140 KB (53 KB gzipped). The 3D scene (three.js and the studio code) is a separate chunk of
about 557 KB (144 KB gzipped) that is fetched after the page's copy, and only on devices that will draw it on a real graphics chip.
The hero needs no video or models: the scene is generated in code (the two posters are 78 KB and 62 KB). The lower sections carry three short videos (`public/video`, 1.0–1.2 MB each; about a quarter of that on phones) that are only fetched when they come on screen.

## Design intent

- **A product studio at the top.** The hero is a real-time 3D scene lit like a product photograph: a dark studio, large softboxes, polished
  black floor, soft shadows, filmic tone mapping. Scrolling moves the camera from product to product (a CCTV camera, a gate motor, beam
  sensors, the control-room monitors). Because the camera is real, the movement is continuous: there are no frames to jump between. The
  lighting follows the approach of the Ekhaya site's water scene, so the sites share one look.
- **Below the hero, the layout and motion of armadillo-gs.com**, in our colours (near-black, pink panels, white type) and with our own words.
  Same section order, same proportions (everything is sized in `vw`, measured on a 1440 px screen), same line-by-line text reveals, the
  same full-screen menu, section ticks, hover pictures and draggable strip. Their sphere videos are bespoke assets, so the same slots
  carry our own footage (the armed response vehicle and a pistol) and a small turning globe (like the one in our logo). The scene's products
  (camera, gate motor, beam posts, monitors) appear only in the hero, not again in the body.

## What's on the page

1. **Hero** (`src/hero3d.js`, `src/scene/`). One pinned stage (about 7.5 screens of scroll; 6 on phones). The camera starts on the opening shot
   with the headline, then glides to each station and rests there while its copy is read: **CCTV** (a bullet camera on a plaster wall),
   **Gates** (a gate motor, with the rack and pinion that drives the gate), **Sensors & beams** (a pair of posts with violet beams between
   them), **Control room & armed response** (a wall of monitors, held to the end of the hero). A stepper on the right (pills at the top on
   phones) jumps between stations; each chapter's button puts that subject on the email links in the Contact section.
2. **Intro**: two columns of text, the larger one first.
3. **Our approach**: a pink half-panel (title, paragraph, three numbered values: always on, always on the way, done properly) beside a
   video of the armed response vehicle (it drifts as you scroll), with a small turning globe above it and a large faint ring.
4. **Our services**: title and paragraph over a six-entry numbered grid (alarms, gates, CCTV, hardware, control room, armed response), on a
   soft pink glow. Each entry is an email link with the subject filled in.
5. **The promise**: "Always on, Always listening & Always on the way" in very large type over a looping video of a pistol with violet light, smoke and sparks. Drag it (a
   "Swipe" cursor shows); it carries on a little and settles.
6. **Who we work for** (pink): intro text on the left; homes, businesses, and complexes and commercial sites on the right. Hovering a row
   draws a line under it and opens a round picture of the vehicle behind it with a "View" cursor (on touch screens each row carries a small round picture).
7. **About us**, then a wide band with a second video of the vehicle (the camera carries on round to the rear, with the phone number on the side) and a ring.
8. **Contact** (pink footer): a very large "Contact", a paragraph with the phone, email and directions links, and a bar with the address,
   email, phone and fax. There is no form: the email and phone links are the enquiry route.

The **menu** (the button at the top right, on every screen size) opens a full-screen list of the sections. On wide screens, **ticks** at the
left edge show where you are (they appear after the hero); hovering them reveals the section names.

### How the lower page moves (`src/motion.js`, `src/globe.js`, `src/sections.css`)

- **Line-by-line text:** each heading and paragraph is split into words, each word is given its line number, and when the block scrolls into
  view the lines rise 3 vw and fade in one after another (0.9 s, easing `cubic-bezier(.33,1,.68,1)`, 0.15 s between title lines). The line
  numbers are re-measured when the window is resized. Numbered rows, services and groups rise in as they arrive.
- **Parallax:** the three videos drift slowly against the scroll. The small globes (a 2D canvas, about a thousand points a frame, only
  while on screen) turn with it.
- **The strip** is one line of type repeated to fill, dragged with pointer events and a little inertia; vertical swipes still scroll the page.
- **The pointer ring** (fine pointers only) follows the mouse, swells over links and carries a label over the strip and the group list.
- All of it is transform or opacity. With reduced motion nothing is split or animated and the content is simply there.

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
- **Videos for the lower sections** (`public/video`, played by `src/video.js`) come from two supplied clips (1280 × 720, 24 fps, 10 s, with sound). Audio is dropped.
  `vehicle-1` is the first 5 s of the vehicle clip and `vehicle-2` the last 5 s, each played forwards then backwards (so the loop has no cut); `pistol` is
  the pistol clip with its last second cross-faded into its first (a seamless 9 s loop). Each has a 640 × 360 `-sm` version for phones and a `.webp` poster
  (its first frame). For example, the first vehicle clip:
  `ffmpeg -ss 0 -t 5 -i vehicle.mp4 -filter_complex "[0:v]scale=1280:720,split[a][b];[b]reverse,trim=start_frame=1,setpts=PTS-STARTPTS[r];[a][r]concat=n=2:v=1:a=0[v]" -map "[v]" -an -c:v libx264 -preset slow -crf 27 -pix_fmt yuv420p -movflags +faststart public/video/vehicle-1.mp4`
  (use `scale=640:360` and `-crf 30` for the `-sm` file). The round pictures in "Who we work for" (`public/img/armed-*.webp`) are 720 × 720 stills of the vehicle clip.
  To add a video, put `<video muted loop playsinline preload="none" data-poster="…" data-src="…" data-src-sm="…">` in a section; `video.js` does the rest.
- Pictures from the 3D scene from a camera of your own: `__scene.snapCam('name.png', { pos: [x, y, z], look: [x, y, z], fov }, width, height)` (station *i* is at x = *i* × 16: camera 0, gate motor 16, beam posts 32, monitors 48), writing to `.snaps/`.
- Handy in the browser console: `__gss.hero.scene` (the scene), `__gss.lenis.stop()` before testing so a stray wheel event does not move the page.

## Phones

- **Menu:** the same full-screen menu as on wide screens; the page behind it is `inert`, Escape closes it, and choosing a link closes it and scrolls. Below 560 px the header's phone number is hidden (it is in the hero, the menu and the Contact section).
- **Sections:** under 1000 px wide everything stacks in one column and sizes switch from `vw` to rem and viewport-width values; the ticks are hidden.
- **Hero:** the four stations sit on one row of pills (the active one filled). On short phones (under 760 px high) the intro paragraph is dropped so the product stays visible; under 600 px the chapter paragraphs go too. Landscape phones (under 520 px high) get a compact layout. Safe-area insets are respected.
- **3D on phones** (a coarse pointer, a narrow screen or 4 cores or fewer): pixel ratio capped at 1.25 and allowed to fall to 0.75 if frames run long; the mirror is smaller and redraws every other frame; the scene is only fetched once the page has loaded and the browser is idle, so the poster, copy and first scroll are never competing with it. Devices with 2 cores or 2 GB of memory or less get the poster instead.
- The videos use the small encodes (about 270–300 KB each) below 900 px wide.
- Touch targets are at least 44 px; the canvas follows its own box, so the address bar sliding away does not resize it.

## Accessibility

- Reduced motion, Save-Data, a 2G connection, no usable graphics chip or a failed build (force with `/?still`): the hero is the still poster with the same headline and calls to action. No 3D code is downloaded.
- Skip link jumps past the hero and moves keyboard focus to the next section; in-page links move focus to their target.
- One `h1`, logical headings, labelled regions and form fields, visible focus rings, `lang="en-ZA"`. The canvas is `aria-hidden` with a text description. The stepper is real buttons with `aria-current`. Hidden chapters are not focusable.
- Contrast: an automated pass over every text element below the hero found no failures against WCAG AA (run on an earlier version). The hero copy sits over the scene with a light shade behind it and should be re-checked.
- The videos are decoration: muted, no controls, hidden from screen readers. They are only fetched when near the screen and play only while on screen and the tab is visible; with reduced motion, Save-Data or a 2G connection only the still poster is shown.
- No third-party content is loaded: the address links to Google Maps in a new tab rather than embedding it.

## Things to confirm with the client

- **The products in the scene** are generic, drawn in code (a bullet camera, a gate motor, beam posts, monitors); they are not the client's own equipment, and
  the beams are shown as glowing violet lines (real beams are invisible infrared), so the glow is a visual device. Real photography or footage of their installations would lift the page further.
- **The footage** (the vehicle and the pistol clips) is AI-generated, so check it for details that do not match the real thing: the vehicle's livery and number plate, and the firearm. A video of a firearm being fired is a marketing choice the client should approve.
- Copy is built only from the information supplied (services, areas, 24/7 control room and armed response). The intro, approach, "who we work for", "about" and contact wording should be approved. No claims such as years in business, response times, accreditations or pricing are made.
- **Logo:** redrawn as vector from the vinyl on the vehicle (`node scripts/build-logo.mjs` regenerates `public/logo.svg`, `logo-reverse.svg`, `logo-mark.svg`, the favicon and the symbols in `index.html`). The lettering uses Michroma as a stand-in and the figure is hand-drawn, so swap in the client's real vector logo when available.
- Enquiries go by `mailto:` and phone only (the page has no form); connect a form service or backend if the client wants one.

## Folders

`src/` page code (`scene/` is the 3D hero; `sections.css`, `motion.js` and `globe.js` are the lower page) · `public/` logo, favicon, posters, `video/` (the lower-section videos and their posters) and `img/` (stills of the vehicle clip) · `scripts/` logo generator (and the frame generator for the archived clip hero) ·
`dev3d.html` the scene on its own, for development (not in the build) ·
`ai-brief/` the prompts and the clip an earlier version was built from ·
`archive/` earlier versions, none in the build: `clip-scrub-hero/` (the footage hero scrubbed by scroll: its `film.js` and `sequence.js`, and the frames),
`drawn-version/` (the illustrated, no-video hero), `video-version/`, `old-house/`, `clip-tour/`, `beam-macro-clip/`, `van-hero/`, `webgl-experiment/`, `stylised-sections/`.

**What is in the Git repository:** the code, the posters, the briefs and the source clip `ai-brief/source/walkthrough-v2.mp4`, and the code of every archived version.
Large working material is kept locally and is not in the repository: the other source clips, the guide stills and reference photos in `ai-brief/`, the
frame sets and images of the archived versions (the last published frames of the clip hero are in the Git history), and the development snapshots in `.snaps/`. See `.gitignore`.
