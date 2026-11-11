// One clip tells the whole top of the page: the hero plays its first seconds, the services tour plays the rest.
// Times are seconds of the source clip (ai-brief/source/tour-walkthrough.mp4).
export const CLIP_SECONDS = 20;
export const HERO_END = 3.5; // the hero covers 0 → HERO_END, the tour picks up from there
export const HERO_P = HERO_END / CLIP_SECONDS; // the same point as a 0–1 position in the frame set
export const FRAMES = 'tour-walk';
