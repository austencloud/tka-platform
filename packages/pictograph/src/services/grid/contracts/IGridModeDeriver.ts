import type { GridMode, MotionData } from "@tka/types";
import type { GridData } from "../../../domain/grid-models";

export interface IGridModeDeriver {
  deriveGridMode(blueMotion: MotionData, redMotion: MotionData): GridMode;
  usesDiamondLocations(motion: MotionData): boolean;
  usesBoxLocations(motion: MotionData): boolean;
  computeGridData(blueMotion: MotionData, redMotion: MotionData): GridData;
}
