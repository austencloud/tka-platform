// --- From PropGeometryAdjustmentRepository ---

import type { Point } from "fabric";

export interface CascadingPropGeometryResult {
  readonly adjustment: Point;
  readonly matchedKey: string;
}
