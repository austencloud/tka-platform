/**
 * Shared emitter contract for the per-tip overlay effects (water, bubbles,
 * petals, smoke, ink, frost, sparkles, silk, echo, zap).
 *
 * Replaces the fixed 4-slot `{bluePosA, bluePosB, redPosA, redPosB}` input that
 * only ever carried the two base props (propIndex 0/1). A flat emitter list
 * carries every visible tip including tunnel kaleidoscope layer props
 * (propIndex >= 2), so the effects render on the layers the way bloom + pulse
 * already do.
 *
 * Identity is `${propIndex}:${tipIndex}` — stable across frames, so renderers
 * key per-emitter velocity/trail state on it.
 */
export interface EmitterTip {
  x: number;
  y: number;
  /** base blue=0, red=1; layer li blue=2+2*li, red=3+2*li. */
  propIndex: number;
  /** 0 = end A, 1 = end B. */
  tipIndex: number;
  /** Derived from tipIndex (0→"A", else "B"). Drives tracking-mode filtering. */
  end: "A" | "B";
  /**
   * Per-prop resolved color (hex). Consumed only by prop-colored effects
   * (echo, zap same-prop edges); palette-driven effects ignore it. Mirrors the
   * trail-overlay spectrum gating: base props use the trail colors, layers use
   * the spectrum fan when the rainbow toggle is on, base colors when off.
   */
  color: string;
}

/** Stable per-frame identity for an emitter's cross-frame state. */
export function emitterId(propIndex: number, tipIndex: number): string {
  return `${propIndex}:${tipIndex}`;
}
