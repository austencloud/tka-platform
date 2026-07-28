/**
 * When a band stops being a wall and becomes a way in.
 *
 * Split out of the component so the boundary is testable without mounting
 * anything — the threshold is the kind of off-by-one that hides well in CSS.
 */

export type DoorwayBand = "archive" | "collections";

/**
 * Collections stays inline while it is browsable and flips to a doorway once it
 * is a scroll. 60 is a judgement, not a measurement: two full rows at the widest
 * tier (8 columns) is 16, and roughly four screens of scrolling at typical tile
 * sizes lands near 60. Austen's account sits at 46 today, so the band stays
 * inline for him now and converts as he saves more.
 */
export const COLLECTIONS_DOORWAY_THRESHOLD = 60;

/**
 * The archive is ALWAYS a doorway, including when it is small. A band that is a
 * grid at 40 items and a doorway at 400 teaches two different interactions for
 * the same thing, and the empty/small case is exactly when a consistent way in
 * matters most.
 */
export function shouldUseDoorway(band: DoorwayBand, count: number): boolean {
  if (band === "archive") return true;
  return count > COLLECTIONS_DOORWAY_THRESHOLD;
}

/**
 * How many tiles the doorway shows. Capped at the column count so the sample is
 * exactly one row at every breakpoint — it is a taste of the work, not a grid.
 */
export function sampleCount(total: number, columns: number): number {
  if (total <= 0 || columns <= 0) return 0;
  return Math.min(total, columns);
}
