import {
  MANDALA_GRID_RADIUS,
  ENGINE_GRID_RADIUS,
} from "$lib/shared/mandala/domain/mandala-constants";

/**
 * Scale the mandala's hand circle to the engine hand orbit (150/950 viewbox)
 * so the shared tile artwork (ShapeMatrixMandalaArt) drawn in the same square
 * as AnimatorCanvas lands exactly under the prop's traced path. Same formula
 * as the lab's render-mandala-overlay-layer.ts (the MP4 bake proves the
 * correspondence); kept in sync by the contract test in
 * shape-matrix-elemental-drill.test.ts.
 */
export function alignScale(clubTipDx: number): number {
  const GRID_HALFWAY = 150;
  const VIEWBOX = 950;
  const tipReach = (clubTipDx * MANDALA_GRID_RADIUS) / ENGINE_GRID_RADIUS;
  const maxExtent = MANDALA_GRID_RADIUS + tipReach;
  const mandalaHandFrac = MANDALA_GRID_RADIUS / (2 * maxExtent * 1.05);
  const engineHandFrac = GRID_HALFWAY / VIEWBOX;
  return engineHandFrac / mandalaHandFrac;
}
