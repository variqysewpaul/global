// Only what the page uses of Motion, so the lazily loaded chunk is as small as it can be (a dynamic import of the whole package cannot be tree-shaken).
export { animate, stagger } from 'motion';
