export type QualityLevel =
  | "high"
  | "medium"
  | "low"
  | "minimal"
  | "ultra-minimal";
export type Dimensions = {
  width: number;
  height: number;
};

// NOTE: QualitySettings lives in ../models/background-models.ts
// Import it from there directly, not from this file.

export type PerformanceMetrics = {
  fps: number;
  warnings: string[];
  particleCount?: number;
  renderTime?: number;
  memoryUsage?: number;
};
export type BackgroundEvent =
  | { type: "ready" }
  | { type: "performanceReport"; metrics: PerformanceMetrics }
  | { type: "qualityChanged"; quality: QualityLevel }
  | { type: "error"; message: string; stack?: string };
