/**
 * Composite Export Options
 *
 * Configuration for composite video export (animation + grid side-by-side).
 */

export interface CompositeExportOptions {
  orientation: "horizontal" | "vertical";
  gridStepSize: number; // Size of each beat in the grid (pixels)
  includeStartPosition: boolean;
  showStepNumbers: boolean;
  fps: number;
  loopCount: number;
}

export const DEFAULT_COMPOSITE_OPTIONS: CompositeExportOptions = {
  orientation: "horizontal",
  gridStepSize: 120,
  includeStartPosition: true,
  showStepNumbers: true,
  fps: 50,
  loopCount: 1,
};
