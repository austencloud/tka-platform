import type { DetectedEndpoint, EndpointCorrection, TrainingPair } from "../../domain/types";

export interface IDetectionCorrector {
  applyCorrections(
    frameIndex: number,
    detected: DetectedEndpoint[],
    corrections: Record<number, EndpointCorrection[]>,
  ): DetectedEndpoint[];
  generateTrainingPairs(
    frameDetections: Record<number, DetectedEndpoint[]>,
    corrections: Record<number, EndpointCorrection[]>,
    getFrameImage: (frameIndex: number) => { width: number; height: number; dataUrl: string },
  ): TrainingPair[];
}
