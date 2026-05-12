/**
 * GridModeDeriver - Microservice for determining grid mode from motion data
 *
 * Class kept for backward-compatible DI injection.
 * All logic lives in ../grid-mode-deriver.ts as plain functions.
 */

import type { GridData } from "../../domain/models/grid-models";
import type { MotionData } from "../../../shared/domain/models/MotionData";
import type { GridMode } from "../../domain/enums/grid-enums";
import {
  deriveGridMode as _deriveGridMode,
  usesDiamondLocations as _usesDiamondLocations,
  usesBoxLocations as _usesBoxLocations,
  isSkewed as _isSkewed,
  computeGridData as _computeGridData,
} from "../grid-mode-deriver";

export class GridModeDeriver {
  deriveGridMode(blueMotion: MotionData, redMotion: MotionData): GridMode {
    return _deriveGridMode(blueMotion, redMotion);
  }
  usesDiamondLocations(motion: MotionData): boolean {
    return _usesDiamondLocations(motion);
  }
  usesBoxLocations(motion: MotionData): boolean {
    return _usesBoxLocations(motion);
  }
  isSkewed(motion: MotionData): boolean {
    return _isSkewed(motion);
  }
  computeGridData(blueMotion: MotionData, redMotion: MotionData): GridData {
    return _computeGridData(blueMotion, redMotion);
  }
}

// ============================================================================
// DIRECT EXPORT - Use this instead of new GridModeDeriver()
// ============================================================================
export const gridModeDeriver = new GridModeDeriver();
