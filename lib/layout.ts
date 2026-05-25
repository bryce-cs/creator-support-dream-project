// Shared layout primitives: lerp params and nav positions.
// Imported by Canvas (homepage scaled scene) and FluidNav (used on other pages)
// so the nav renders at IDENTICAL screen positions across the site.

export const DESKTOP_W = 1440;
export const MOBILE_W = 402;
export const LERP_MAX = 1280;
export const LERP_MIN = 520;

// Height of the nav-only scaled strip used by non-homepage pages.
// Tall enough to contain the Apply button plus padding at scale=1.
export const NAV_FRAME_H = 110;

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Compute the 0→1 mobile-ness factor from current viewport width. */
export function viewportT(vw: number): number {
  return Math.max(0, Math.min(1, (LERP_MAX - vw) / (LERP_MAX - LERP_MIN)));
}

/** Compute the scale factor: how the lerped frame fits the viewport. */
export function frameScale(vw: number, t: number): { frameW: number; scale: number } {
  const frameW = lerp(DESKTOP_W, MOBILE_W, t);
  const scale = Math.min(1, vw / frameW);
  return { frameW, scale };
}

// Nav chrome positions — desktop coords / mobile coords.
// Both layouts use the same logo + Adobe + View Submissions + Apply.
export const NAV = {
  logo:     { d: { x: 45,   y: 38, w: 125, h: 44 }, m: { x: 26,  y: 28, w: 108, h: 38 } },
  adobe:    { d: { x: 200,  y: 36, w: 94,  h: 51 }, m: { x: 150, y: 27, w: 77,  h: 42 } },
  viewNav:  { d: { x: 1108, y: 49, fs: 20 },        m: { x: 1108, y: 49, fs: 20 } },
  applyNav: { d: { x: 1301, y: 47, w: 79, h: 28, fs: 20 }, m: { x: 289, y: 35, w: 79, h: 28, fs: 20 } },
};
