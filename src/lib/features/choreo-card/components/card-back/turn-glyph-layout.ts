/**
 * Shared bar geometry for the turn-pattern glyph, used by BOTH renderers:
 *   - TurnPatternGlyph.svelte (live card, CSS cqi units)
 *   - rasterizeTurnGlyph in card-back-bitmaps-percard.ts (print bitmap)
 *
 * The glyph lives in a fixed 10×6cqi corner box on the card back. Turn
 * patterns are period-compressed but unbounded — a non-repeating 8-step
 * pattern renders 8 bar groups, far wider than the box at natural size.
 * When the cluster would overflow, every horizontal dimension (bar width,
 * gaps, corner radius) scales down proportionally so the cluster always
 * fits. Bar HEIGHTS never scale — height encodes the turn value.
 */

export const TURN_GLYPH_BOX_W_CQI = 10;
export const TURN_GLYPH_BOX_H_CQI = 6;

const BAR_W_CQI = 1.1;
const INTRA_GAP_CQI = 0.25;
const GROUP_GAP_CQI = 0.6;
const RADIUS_CQI = 0.2;

export interface TurnGlyphLayout {
  /** Width of one bar, cqi */
  barW: number;
  /** Gap between the blue and red bar inside a group, cqi */
  intraGap: number;
  /** Gap between groups, cqi */
  groupGap: number;
  /** Top corner radius of a bar, cqi */
  radius: number;
  /** Total cluster width, cqi — always ≤ the box width */
  clusterW: number;
  /** Applied horizontal scale (1 when the pattern fits at natural size) */
  scale: number;
}

/** Compute the horizontal layout for `count` bar groups inside `boxW` cqi. */
export function layoutTurnGlyph(
  count: number,
  boxW: number = TURN_GLYPH_BOX_W_CQI,
): TurnGlyphLayout {
  const groupW = BAR_W_CQI * 2 + INTRA_GAP_CQI;
  const natural = count > 0 ? count * groupW + (count - 1) * GROUP_GAP_CQI : 0;
  const scale = natural > boxW ? boxW / natural : 1;
  return {
    barW: BAR_W_CQI * scale,
    intraGap: INTRA_GAP_CQI * scale,
    groupGap: GROUP_GAP_CQI * scale,
    radius: RADIUS_CQI * scale,
    clusterW: natural * scale,
    scale,
  };
}
