/**
 * When a band stops being a wall and becomes a way in.
 *
 * Split out of the component so the row math is testable without mounting
 * anything — this is the kind of off-by-one that hides well in CSS.
 *
 * There is no longer a "does this band convert" question to answer. The
 * Archive is always a doorway, and Collections is always one strip per medium
 * (2026-07-28) — the threshold that used to flip Collections between a grid
 * and a doorway is gone with the grid.
 */

/**
 * A strip shows a taste, not a page. Six is the ceiling however wide the screen
 * gets: past that a strip starts reading as the grid it replaced, which is the
 * whole thing it exists to avoid.
 */
export const STRIP_SAMPLE_CAP = 6;

/**
 * How many columns a medium strip may use at this tier. The band's own column
 * count is the other bound — six tiles must never be forced onto a screen that
 * fits two.
 */
export function stripColumns(bandColumns: number): number {
  return Math.max(1, Math.min(STRIP_SAMPLE_CAP, bandColumns));
}

/**
 * How many tiles a sample row shows. Capped at the column count so the sample
 * is exactly one row at every breakpoint — a taste of the work, not a grid.
 */
export function sampleCount(total: number, columns: number): number {
  if (total <= 0 || columns <= 0) return 0;
  return Math.min(total, columns);
}
