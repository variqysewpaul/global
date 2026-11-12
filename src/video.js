// The background videos in the lower sections (the armed response vehicle and the pistol). They are decoration: muted, looping,
// no controls, hidden from screen readers.
//
// Cheap by design: nothing is fetched until the video is near the screen (first the still poster, then the video itself when it is
// actually on screen), it plays only while it is on screen and the tab is visible, and a small version is used on phones. With
// reduced motion, Save-Data or a 2G connection the video is never fetched and the poster stays as a still picture.
const posterOf = (v) => {
  if (v.dataset.poster && !v.poster) v.poster = v.dataset.poster;
};

export function initVideos({ reduced }) {
  const vids = [...document.querySelectorAll('video[data-src]')];
  if (!vids.length) return;
  const conn = navigator.connection || {};
  const still = reduced || conn.saveData || /(^|-)2g$/.test(conn.effectiveType || '');
  const small = matchMedia('(max-width: 900px)').matches;
  const visible = new Set();

  // the poster arrives a little before the video is on screen
  const near = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        posterOf(e.target);
        near.unobserve(e.target);
      }
    },
    { rootMargin: '800px 0px' },
  );
  vids.forEach((v) => near.observe(v));
  if (still) return;

  const play = (v) => {
    if (!v.getAttribute('src')) v.src = small && v.dataset.srcSm ? v.dataset.srcSm : v.dataset.src;
    v.muted = true; // required for autoplay
    v.play()?.catch(() => {}); // blocked (low-power mode, say): the poster stays
  };
  const watch = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const v = e.target;
        if (e.isIntersecting) {
          visible.add(v);
          if (!document.hidden) play(v);
        } else {
          visible.delete(v);
          v.pause();
        }
      }
    },
    { rootMargin: '60px 0px', threshold: 0.01 },
  );
  vids.forEach((v) => watch.observe(v));
  document.addEventListener('visibilitychange', () => {
    for (const v of vids) {
      if (document.hidden) v.pause();
      else if (visible.has(v)) play(v);
    }
  });
}
