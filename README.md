# Global Security Solutions — site

Vite + vanilla JS. **GSAP** (ScrollTrigger) for animation, **Lenis** for smooth scrolling. No framework, no 3D library.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static site in dist/  (JS ≈ 142 KB, 54 KB gzipped, plus the footage frames: 8 MB desktop set, 4 MB phone set; a visitor downloads one)
```

## Design intent

- **Footage-led top, corporate everywhere else.** The hero and the services explanation are one 10-second clip of a property at night,
  scrubbed by scroll, shown the way it was made: no colour overlay and no grain, only a light shade behind the copy.
  Everything below it is plain, clear and professional: light and dark bands, sentence-case Montserrat headings, Inter body text, pink as an accent.
- **Light and transitions below the hero:** soft glows that drift across the dark sections, headings that wipe in, a process line that fills as you scroll.

## What's on the page

1. **Hero and services** (`src/film.js`). One pinned stage (about 9 screens of scroll; 7 on phones). Scrolling down plays the clip forward and
   scrolling up plays it back, so the footage always moves with the page. The clip pushes in on the gate motor, a wall-mounted CCTV camera
   and a dome camera, then violet alarm beams switch on across a window and the camera pulls back to the whole house:
   - **Opening:** the first frame of the clip (the gate and motor), with the headline. The first scroll tick already moves the footage.
   - **Gates** (the gate motor), **CCTV** (bullet camera, then the dome camera), **Sensors & beams** (the beams light up): each chapter's copy
     shows while its part of the clip is on screen.
   - **Control room & armed response:** the clip ends on the wide shot of the house for the closing message and call to action.
   A stepper on the right (pills at the top on phones) jumps between chapters, and each chapter's button pre-selects that option in the
   enquiry form.
2. **Key points** strip.
3. **Armed response & control room** (dark): four steps (signal, operator, dispatch, on site) and a call to action.
4. **Services** (light): alarms, gates, CCTV, hardware. Each card lists what's included and has an "Enquire" link.
5. **About** (grey), **Coverage** (Google Maps loads only when the visitor clicks "Show map"), **FAQ** (native `<details>`), **Contact** (the form opens the visitor's email app), footer.

## The footage

| Frames | Source | Used for |
|---|---|---|
| `public/frames/film`: 240 frames (every frame of the clip, 24 fps), 1280 px, webp quality 88, 7.9 MB | `ai-brief/source/walkthrough-v2.mp4` | the hero on desktop and tablets |
| `public/frames/film-sm`: the same 240 frames at 720 px, quality 84, 3.7 MB | the same clip | the hero on screens 800 px wide or less |
| `public/poster.webp` (first frame) and `public/poster-wide.webp` (last frame) | the same clip | the first frame is on screen before anything loads; the wide shot is the whole hero in still mode |

How the frames are played (`src/sequence.js`):

- Every frame is downloaded once and kept compressed. Downloads start with a coarse skeleton (every 12th frame), then fill in nearest the
  playhead, so scrubbing works long before every frame has arrived and a jump to another chapter loads that part first.
- Only the frames around the playhead are decoded (three at a time, nearest first, in the direction of travel), so memory stays small, stale
  work never blocks the frame that is needed now, and the full-resolution set can be used on any device.
- Every frame of the clip is used at its original 24 fps. Between two frames the player cross-fades by the fractional scroll position
  (each real frame is held crisp at both ends), so a slow scroll glides instead of stepping at 24 fps.
- Nothing expensive sits over the footage: the page has one light shade layer and no blend modes, blurred backdrops or filters, and the canvas
  backing store is capped at 1920 px wide (the clip is 1280 px, so more pixels add GPU work, not detail).
- `__gss.film.seq.stats` in the browser console shows how many draws used the exact frame, a stand-in frame, or a blend.
- On tall or square windows (width < height) the whole 16:9 frame fits the width in the upper part of the screen, with the copy below, instead
  of cropping it to a sliver. On wide windows it fills the screen.

To use a different clip:

```bash
node scripts/make-frames.mjs path/to/clip.mp4 --name film    --fps 24 --width 1280 --quality 88
node scripts/make-frames.mjs path/to/clip.mp4 --name film-sm --fps 24 --width 720  --quality 84
ffmpeg -y -i path/to/clip.mp4 -vf "select=eq(n\,0)"   -frames:v 1 -c:v libwebp -quality 92 -update 1 public/poster.webp
ffmpeg -y -i path/to/clip.mp4 -vf "select=eq(n\,239)" -frames:v 1 -c:v libwebp -quality 92 -update 1 public/poster-wide.webp
```

(Use the clip's own last frame number in place of 239.) Then edit `src/film.js`:

- `FPS` is the clip's frame rate.
- `TIME` maps scroll (0–1 across the hero) to seconds of clip, with an ease for each leg. It is slow where there is something to read.
- `WINDOWS` is where each chapter's copy shows (0–1 across the hero). Keep the chapters in the same order as the `article.chapter` elements and
  stepper buttons in `index.html`.
- The hero's scroll length is `.hero { height }` in `src/style.css`.

Needs ffmpeg (winget package `Gyan.FFmpeg`, or set the `FFMPEG` environment variable to the full path of ffmpeg.exe).

## Accessibility

- Reduced motion, Save-Data, a 2G connection, or frames that fail to load (force with `/?still`): the hero is the wide-shot poster only, with the same copy. No frames are downloaded, and the Services cards below carry the same information.
- Skip link jumps past the hero and moves keyboard focus to the next section; in-page links move focus to their target.
- One `h1`, logical headings, labelled regions and form fields, visible focus rings, `lang="en-ZA"`. The footage is `aria-hidden` with a text description. The stepper is real buttons with `aria-current`. Hidden chapters are not focusable.
- Contrast: an automated pass over every text element below the hero found no failures against WCAG AA (run on an earlier version). The hero copy sits over a light shade over the footage and should be re-checked.
- Third-party content (the map) loads only on request.

## Things to confirm with the client

- **Footage:** the clip is AI-generated, so check it for details that don't match the real equipment (the violet light strip on the gate motor,
  the camera and sensor housings). The beams are shown as glowing violet lines; real beams are invisible infrared, so the glow is a visual device.
  The clip also has an audio track, which the site does not use.
- Copy is built only from the information supplied (services, areas, 24/7 control room and armed response). The FAQ, "about" and chapter wording should be approved. No claims such as years in business, response times, accreditations or pricing are made.
- Real photography or footage of their installations would lift the page further, and avoids AI-image licensing questions.
- **Logo:** redrawn as vector from the vinyl on the vehicle (`node scripts/build-logo.mjs` regenerates `public/logo.svg`, `logo-reverse.svg`, `logo-mark.svg`, the favicon and the symbols in `index.html`). The lettering uses Michroma as a stand-in and the figure is hand-drawn, so swap in the client's real vector logo when available.
- The contact form uses `mailto:`; connect a form service or backend when ready.

## Folders

`src/` page code · `public/` logo, favicon, posters and `frames/` · `scripts/` frame and logo generators ·
`ai-brief/` the prompts and the clip the site is built from ·
`archive/` earlier versions, none in the build: `drawn-version/` (the illustrated, no-video hero: copy its `src/` and `index.html` back to use it),
`video-version/` (an earlier footage version), `old-house/`, `clip-tour/`, `beam-macro-clip/`, `van-hero/`, `webgl-experiment/`, `stylised-sections/`.

**What is in the Git repository:** the code, the current footage (`public/frames`, the posters and the source clip `ai-brief/source/walkthrough-v2.mp4`), the
briefs, and the code of every archived version. Large working material is kept locally and is not in the repository: the other source clips,
the guide stills and reference photos in `ai-brief/`, and the frame sets and images of the archived versions (regenerate frames with
`scripts/make-frames.mjs`). See `.gitignore`.
