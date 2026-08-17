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
  // Sidebar-only composite of effort + playback + display. Those three each
  // filled well under half the rail alone; the sidebar shows them as one page
  // and keeps the individual ids for the mobile dock, which shows one tray at
  // a time and cannot take the merged height.
  "motion",
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
 * Ordering follows `order` (defaults to PILL_ORDER). A consumer that wants a
 * different rail order — e.g. surfacing Effects first — passes its own order
 * built from PILL_ORDER's ids, so the two still cannot drift on membership.
 */
export function buildPillSpecs(
  specs: Partial<Record<PillId, Omit<PillSpec, "id">>>,
  order: readonly PillId[] = PILL_ORDER,
): PillSpec[] {
  return order
    .filter((id) => id in specs)
    .map((id) => ({ id, ...specs[id]! }));
}
