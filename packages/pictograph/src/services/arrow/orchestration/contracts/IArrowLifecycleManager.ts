import type { PictographData, MotionData, GridMode } from "@tka/types";
import type {
  ArrowAssets,
  ArrowLifecycleResult,
  ArrowPosition,
  ArrowState,
} from "../../../../domain/arrow-models";
import type { ThemeMode } from "../../../../utils/svg-color-utils";

export interface ArrowLifecycleOptions {
  themeMode?: ThemeMode;
  gridMode?: GridMode;
}

export interface IArrowLifecycleManager {
  loadArrowAssets(
    motionData: MotionData,
    options?: ArrowLifecycleOptions
  ): Promise<ArrowAssets>;

  calculateArrowPosition(
    motionData: MotionData,
    pictographData: PictographData
  ): Promise<ArrowPosition>;

  shouldMirrorArrow(
    motionData: MotionData,
    pictographData: PictographData
  ): boolean;

  getArrowState(
    motionData: MotionData,
    pictographData: PictographData,
    options?: ArrowLifecycleOptions
  ): Promise<ArrowState>;

  coordinateArrowLifecycle(
    pictographData: PictographData,
    options?: ArrowLifecycleOptions
  ): Promise<ArrowLifecycleResult>;

  resetArrowState(): void;
}
