// Opens the 3D context for the hero, or says there isn't a good one. Kept apart from kit.js so the page can ask this question
// without downloading three.js: a device that would draw in software (no graphics chip, a remote desktop, a blocklisted driver)
// gets the still poster and never fetches the 3D code.
//
// The context is created here, with the settings three.js would use, and handed to the renderer, so there is only ever one.
export function fast3DContext(canvas) {
  try {
    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: true,
      depth: true,
      stencil: false,
      premultipliedAlpha: true,
      preserveDrawingBuffer: false,
      powerPreference: 'high-performance',
      failIfMajorPerformanceCaveat: true, // refuse a software-backed context instead of quietly accepting it
    });
    if (!gl) return null;
    // some browsers still hand back a software context; its renderer string gives it away
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
    return /swiftshader|llvmpipe|softpipe|software|basic render/i.test(renderer) ? null : gl;
  } catch {
    return null;
  }
}
