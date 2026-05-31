/**
 * Shared rhythm catalog. A rhythm is a per-period symbol unit describing which
 * hand (or, single-lane, which beat) is ACTIVE on each beat. Tiled to a period.
 *
 * Symbols: P both · R red only · B blue only · - none.
 * Shared by the Turns and (Phase 2) Reversals drawers. ids intentionally match
 * the reversal pattern ids in choreo-card/domain/reversal-patterns.ts.
 */
export interface RhythmDef {
  readonly id: string;
  readonly label: string;
  /** One period unit; tiled across the pattern length. */
  readonly sym: string;
}

/** Per-hand catalog (Turns + Reversals). */
export const PER_HAND_RHYTHMS: readonly RhythmDef[] = [
  { id: "book", label: "Book", sym: "P" },
  { id: "long-book", label: "Long Book", sym: "P-" },
  { id: "alternating", label: "Alternating", sym: "RB" },
  { id: "red-book", label: "Red Book", sym: "R" },
  { id: "blue-book", label: "Blue Book", sym: "B" },
];

/** The "no rhythm" entry — all beats continuous / inactive. */
export const CONTINUOUS: RhythmDef = { id: "continuous", label: "Continuous", sym: "-" };

/** Single-lane accent catalog (Duration — which beats are held longer). */
export const DURATION_RHYTHMS: readonly RhythmDef[] = [
  { id: "every", label: "Every beat", sym: "P" },
  { id: "every-other", label: "Every other", sym: "P-" },
  { id: "downbeat", label: "Downbeat", sym: "P---" },
  { id: "last", label: "Last beat", sym: "---P" },
];
