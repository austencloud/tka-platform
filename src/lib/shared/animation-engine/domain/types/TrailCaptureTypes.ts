import type { TrailPoint, TrailSettings } from "./TrailTypes";
import type { PropState } from "$lib/shared/foundation/domain/types/PropState";

export interface AdditionalLayerProps {
  blueProp: PropState | null;
  redProp: PropState | null;
}

export interface TrailCapturePropStates {
  blueProp: PropState | null;
  redProp: PropState | null;
  additionalLayers?: AdditionalLayerProps[];
}

export interface PropDimensions {
  width: number;
  height: number;
}

export interface TrailCaptureConfig {
  canvasSize: number;
  bluePropDimensions: PropDimensions;
  redPropDimensions: PropDimensions;
  trailSettings: TrailSettings;
  bluePropType?: string | null;
  redPropType?: string | null;
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
