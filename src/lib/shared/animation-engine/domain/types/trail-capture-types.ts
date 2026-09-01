import type { TrailPoint, TrailSettings } from "./trail-types";
import type { PropState } from "$lib/shared/foundation/domain/types/prop-state";

export interface AdditionalLayerProps {
  leftProp: PropState | null;
  rightProp: PropState | null;
  /** Presentation envelope for one overlaid performer. The tunnel transition
   *  keeps geometry live while copies bloom in/out on the persistent canvas. */
  opacity?: number;
  /** Per-performer prop type (Performer Set). Absent → the global prop (today). */
  leftPropType?: string;
  rightPropType?: string;
}

export interface TrailCapturePropStates {
  leftProp: PropState | null;
  rightProp: PropState | null;
  additionalLayers?: AdditionalLayerProps[];
}

export interface PropDimensions {
  width: number;
  height: number;
}

export interface TrailCaptureConfig {
  canvasSize: number;
  leftPropDimensions: PropDimensions;
  rightPropDimensions: PropDimensions;
  trailSettings: TrailSettings;
  leftPropType?: string | null;
  rightPropType?: string | null;
  isSeamlesslyLoopable?: boolean;
}

export interface IAnimationCacheService {
  getCachedPoints(
    propIndex: 0 | 1,
    tipIndex: number,
    startStep: number,
    endStep: number,
    canvasSize: number
  ): TrailPoint[];
  isValid(): boolean;
}

export interface IPerformanceMonitorService {
  getAdaptivePointSpacing(): number;
}
