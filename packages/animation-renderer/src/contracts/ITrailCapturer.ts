import type { PropState, TrailPoint, TrailSettings } from "@tka/types";

export interface TrailCapturePropStates {
  blueProp: PropState | null;
  redProp: PropState | null;
  secondaryBlueProp?: PropState | null;
  secondaryRedProp?: PropState | null;
}

export interface TrailCaptureConfig {
  canvasSize: number;
  bluePropDimensions: { width: number; height: number };
  redPropDimensions: { width: number; height: number };
  trailSettings: TrailSettings;
  bluePropType?: string | null;
  redPropType?: string | null;
  isSeamlesslyLoopable?: boolean;
}

export interface IAnimationCacheService {
  getCachedPoints(
    propIndex: 0 | 1,
    endType: 0 | 1,
    startStep: number,
    endStep: number,
    canvasSize: number
  ): TrailPoint[];
  isValid(): boolean;
}

export interface IPerformanceMonitorService {
  getAdaptivePointSpacing(): number;
}

export interface ITrailCapturer {
  initialize(config: TrailCaptureConfig): void;
  updateConfig(config: Partial<TrailCaptureConfig>): void;
  captureFrame(
    props: TrailCapturePropStates,
    currentStep: number | undefined,
    currentTime: number
  ): void;
  getTrailPoints(propIndex: 0 | 1 | 2 | 3, endType: 0 | 1): TrailPoint[];
  getAllTrailPoints(): {
    blue: TrailPoint[];
    red: TrailPoint[];
    secondaryBlue: TrailPoint[];
    secondaryRed: TrailPoint[];
  };
  fillTrailPointArrays(
    blue: TrailPoint[],
    red: TrailPoint[],
    secondaryBlue: TrailPoint[],
    secondaryRed: TrailPoint[]
  ): void;
  clearTrails(): void;
  updateSettings(settings: TrailSettings): void;
  setAnimationCacheService(cacheService: IAnimationCacheService | null): void;
  setPerformanceMonitor(monitor: IPerformanceMonitorService | null): void;
}
