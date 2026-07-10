/**
 * Arrow Halo — single source of truth.
 *
 * Arrows in a pictograph frequently overlay the same visual space a prop
 * occupies. A subtle background-matching halo separates them so the arrow reads
 * as floating above the prop. The halo is colored to match the pictograph
 * background, so it is invisible against the background and only renders as a
 * clean gap where the arrow overlaps a prop (worst with wide props like
 * fans / doublestars).
 *
 * This module owns the halo definition so the live renderer (ArrowSvg.svelte)
 * and the image composition pipeline (Canvas2DDirectRenderer) apply the exact
 * same effect. Do NOT re-derive the halo anywhere else.
 *
 * Parity: the filter is applied to arrow-intrinsic-unit content in both paths,
 * which scales by the same renderSize/950 factor in each — so a single
 * stdDeviation gives an identical blur live and in export.
 */

/**
 * Blur std deviation, in arrow-intrinsic units (arrow viewBox is ~250 across,
 * mapping 1:1 into the 950-unit pictograph space). Tuned to match the previous
 * CSS `drop-shadow(0 0 2px)` halo at a representative pictograph render size.
 * Three stacked shadows compound, so the visible halo is denser than a single
 * pass at this radius.
 */
export const HALO_STD_DEVIATION = 6;

/** Number of stacked drop-shadow passes (compounds opacity, matches the old CSS ×3). */
const HALO_PASSES = 3;

/**
 * Background-matching halo color.
 * Dark: #0a0a0f (matches the dark bg rect in PictographRenderer / Canvas2D bg).
 * Light: white — light-friendly counterpart, and stays invisible against print's
 * white background (print renders as light mode).
 */
export function haloColor(isDarkMode: boolean): string {
  return isDarkMode ? "#0a0a0f" : "white";
}

/**
 * Build the `<filter>` markup for the arrow halo. Three chained feDropShadow
 * primitives (dx=dy=0) reproduce the compounding triple drop-shadow: each
 * primitive's default input is the previous primitive's result, so the shadows
 * stack. A generous filter region prevents the blur from clipping.
 *
 * @param id unique filter id (referenced via filter="url(#id)")
 * @param isDarkMode selects the background-matching flood color
 */
export function buildArrowHaloFilter(id: string, isDarkMode: boolean): string {
  const color = haloColor(isDarkMode);
  const passes = Array.from(
    { length: HALO_PASSES },
    () =>
      `<feDropShadow dx="0" dy="0" stdDeviation="${HALO_STD_DEVIATION}" flood-color="${color}" flood-opacity="1"/>`
  ).join("");
  // Explicit generous region (default is -10%..120%); the compounding blur needs
  // headroom so edges never clip.
  return `<filter id="${id}" x="-20%" y="-20%" width="140%" height="140%">${passes}</filter>`;
}

/**
 * Canvas `ctx.filter` string equivalent — FALLBACK ONLY.
 *
 * Used only if the baked SVG `<filter>` is found not to rasterize in the
 * composition worker's `createImageBitmap` path. Driven by the same constants so
 * values stay single-sourced even if the application mechanism must differ. The
 * blur radius here is in canvas device px at the current draw scale.
 */
export function haloCanvasFilter(isDarkMode: boolean, scale: number): string {
  const color = haloColor(isDarkMode);
  const r = HALO_STD_DEVIATION * scale;
  return Array.from({ length: HALO_PASSES }, () => `drop-shadow(0 0 ${r}px ${color})`).join(" ");
}
