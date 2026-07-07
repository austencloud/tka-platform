/**
 * Performer-ring model — the schematic, countable cast the tuner draws.
 *
 * A tunnel overlays `imageCount` copies of the sequence. Each copy is one
 * "performer" (a dancer with two hands). This turns a {@link TunnelConfig} into a
 * flat list of performer dots for the schematic ring diagram — the countable
 * counterpart to the dense live mandala.
 *
 * It reads ONLY the count-building generators (fold / mirror / flip). The motion
 * modulators (invert / echo / stagger / speed) never change the count, so they
 * are absent here by construction — toggling one leaves this output identical,
 * which is exactly the "motion is free" story the UI teaches.
 *
 * The list length always equals `imageCount(cfg)` and the reflection nesting
 * mirrors `generateCopyOps`'s closure order (fold set, then ∪ mirror, then ∪
 * flip), so the diagram stays faithful to what actually renders.
 */
import type { TunnelConfig } from "./tunnel-config";

/** One performer in the schematic ring. */
export interface RingPerformer {
  /** Stable key across config changes (drives enter/exit transitions). */
  id: string;
  /** Angle around the ring, degrees, 0 = east, growing clockwise. */
  angleDeg: number;
  /** Reflection depth: 0 = fold performer, 1 = one reflection, 2 = both. Used to
   *  seat reflected twins on tighter concentric rings so no dot hides another. */
  depth: number;
}

const norm360 = (d: number): number => ((d % 360) + 360) % 360;

/** Evenly-spaced fold performers, first at the top, laid out clockwise. Matches
 *  `foldRotations` (k × 360/fold), so the schematic angles equal the render's. */
function foldAngles(fold: number): number[] {
  const n = Math.max(1, fold);
  const out: number[] = [];
  for (let k = 0; k < n; k++) out.push(norm360(-90 + (k * 360) / n));
  return out;
}

/**
 * The full cast for a config, in the same overlay order as `generateCopyOps`.
 * Length === `imageCount(cfg)`.
 */
export function performerRing(cfg: TunnelConfig): RingPerformer[] {
  let out: RingPerformer[] = foldAngles(cfg.fold).map((a, i) => ({
    id: `f${i}`,
    angleDeg: a,
    depth: 0,
  }));
  // Reflect across the vertical axis (mirror): angle θ → 180° − θ.
  if (cfg.mirror) {
    out = [
      ...out,
      ...out.map((p) => ({
        id: `m:${p.id}`,
        angleDeg: norm360(180 - p.angleDeg),
        depth: p.depth + 1,
      })),
    ];
  }
  // Reflect across the horizontal axis (flip): angle θ → −θ.
  if (cfg.flip) {
    out = [
      ...out,
      ...out.map((p) => ({
        id: `p:${p.id}`,
        angleDeg: norm360(-p.angleDeg),
        depth: p.depth + 1,
      })),
    ];
  }
  return out;
}

/** Radius fraction (0..1 of the ring radius) for a reflection depth — deeper
 *  reflections seat on tighter rings so coincident twins stay countable. */
export function depthRadiusFraction(depth: number): number {
  return [1, 0.64, 0.38][Math.min(depth, 2)] ?? 0.38;
}
