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
  /**
   * Optional fixed period. When set, the rhythm only stamps at exactly this
   * period (the strip resizes to it on apply) and is only compatible with
   * lengths divisible by it. When absent, the rhythm tiles to any chosen
   * period (the default for the simple rhythms). `sym.length` must equal it.
   */
  readonly period?: number;
}

/** Per-hand catalog (Turns + Reversals). */
export const PER_HAND_RHYTHMS: readonly RhythmDef[] = [
  { id: "book", label: "Book", sym: "P" },
  { id: "long-book", label: "Long Book", sym: "P-" },
  { id: "alternating", label: "Alternating", sym: "RB" },
  { id: "red-book", label: "Red Book", sym: "R" },
  { id: "blue-book", label: "Blue Book", sym: "B" },
  // Solo family (canonical: choreo-card/domain/reversal-patterns.ts → solo-1).
  // One hand per beat across an 8-beat cycle; never both, never neither.
  { id: "solo-1", label: "Solo 1", sym: "RBBRBRRB", period: 8 },
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
