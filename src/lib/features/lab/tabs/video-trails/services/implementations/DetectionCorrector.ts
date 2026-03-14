import type { IDetectionCorrector } from "../contracts/IDetectionCorrector";
import type { DetectedEndpoint, EndpointCorrection, TrainingPair } from "../../domain/types";

export class DetectionCorrector implements IDetectionCorrector {
  applyCorrections(
    frameIndex: number,
    detected: DetectedEndpoint[],
    corrections: Record<number, EndpointCorrection[]>,
  ): DetectedEndpoint[] {
    const frameCorrections = corrections[frameIndex];
    if (!frameCorrections || frameCorrections.length === 0) return detected;

    const result: DetectedEndpoint[] = [];

    for (const endpoint of detected) {
      const correction = frameCorrections.find(
        (c) => c.propIndex === endpoint.propIndex && c.tipIndex === endpoint.tipIndex,
      );

      if (!correction) {
        result.push(endpoint);
        continue;
      }

      if (correction.status === "occluded") {
        // Endpoint was occluded at this frame — omit it from results entirely.
        continue;
      }

      if (correction.status === "corrected" || correction.status === "interpolated") {
        if (correction.corrected) {
          result.push({
            ...endpoint,
            x: correction.corrected.x,
            y: correction.corrected.y,
            // Manually placed points are treated as fully certain.
            confidence: 1,
          });
        }
        continue;
      }

      // "accepted" — user confirmed the detection is accurate, keep as-is.
      result.push(endpoint);
    }

    return result;
  }

  generateTrainingPairs(
    frameDetections: Record<number, DetectedEndpoint[]>,
    corrections: Record<number, EndpointCorrection[]>,
    getFrameImage: (frameIndex: number) => { width: number; height: number; dataUrl: string },
  ): TrainingPair[] {
    const pairs: TrainingPair[] = [];

    for (const frameStr of Object.keys(corrections)) {
      const frameIndex = Number(frameStr);
      const corrected = corrections[frameIndex];
      if (!corrected || corrected.length === 0) continue;

      const detected = frameDetections[frameIndex] ?? [];

      pairs.push({
        frame: getFrameImage(frameIndex),
        detected,
        corrected,
        metadata: {
          correctedBy: "user",
          correctedAt: new Date().toISOString(),
          sourceDetector: "led-threshold-v1",
        },
      });
    }

    return pairs;
  }
}
