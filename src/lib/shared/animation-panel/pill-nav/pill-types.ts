/**
 * Pill-nav contract for AnimationPanel.
 *
 * PILL_ORDER is the single source of truth for which pills exist and
 * the order they render. PillId is derived from it so the two cannot
 * drift - adding a pill in only one place is a compile error.
 */

export const PILL_ORDER = [
  "grid",
  "layers",
  "props",
  "effects",
  "effort",
  "playback",
  "display",
  "export",
] as const;

export type PillId = (typeof PILL_ORDER)[number];

export interface PillSpec {
  id: PillId;
  /** Uppercase short label (≤8 chars), e.g. "EFFECTS". */
  label: string;
  /** FontAwesome class, e.g. "fa-wand-magic-sparkles". Optional - Effort uses a color dot instead. */
  icon?: string;
  /** Live one-line summary of the section's current state, ≤24 chars (truncated with ellipsis if longer). */
  summary: string;
  /** Optional accent color override. Effort sets this to its color so the active glow matches. */
  accentColor?: string;
}

/**
 * Build the ordered PillSpec array from a PillId-keyed partial record.
 * Only pills present in the record are included in the output.
 * Ordering follows PILL_ORDER.
 */
export function buildPillSpecs(
  specs: Partial<Record<PillId, Omit<PillSpec, "id">>>,
): PillSpec[] {
  return PILL_ORDER
    .filter((id) => id in specs)
    .map((id) => ({ id, ...specs[id]! }));
}
