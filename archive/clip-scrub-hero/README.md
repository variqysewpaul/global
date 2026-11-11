# Clip-scrub hero (retired)

The hero used before the 3D studio scene: one 10-second AI-generated clip of a property at night, exported as 240 webp frames
(`frames/film`, `frames/film-sm`) and played on a canvas as the page scrolled.

- `film.js`: scroll → clip-time mapping (`TIME`, `WINDOWS`), copy timeline, stepper. Replaces `src/hero3d.js`.
- `sequence.js`: the frame player (coarse-to-fine download, decode around the playhead, dissolve on change).
- `frames/`: the frames (kept locally; not in Git, whose history has the last published set). Regenerate with
  `node scripts/make-frames.mjs path/to/clip.mp4 --name film --fps 24 --width 1280 --quality 88`.

It was retired because 24 fps footage scrubbed by scroll can only ever step from frame to frame, which reads as jitter however it is
blended. To bring it back: copy `film.js` and `sequence.js` into `src/`, the frames into `public/frames/`, swap `initHero3D` for
`initFilm` in `src/main.js`, and restore the older posters and the clip-hero CSS from Git history.
