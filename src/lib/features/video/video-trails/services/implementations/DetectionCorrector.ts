import type { DetectedEndpoint, EndpointCorrection, TrainingPair } from "../../domain/types";

export class DetectionCorrector {
  applyCorrections(
    frameIndex: number,
    detected: DetectedEndpoint[],
    corrections: Record<number, EndpointCorrection[]>,
  ): DetectedEndpoint[] {
    const frameCorrections = corrections[frameIndex];
    if (!frameCorrections || frameCorrections.length === 0) return detected;

    const result: DetectedEndpoint[] = [];
    const handledKeys = new Set<string>();

    // First pass: apply corrections to existing detected endpoints
    for (const endpoint of detected) {
      const key = `${endpoint.propIndex}-${endpoint.tipIndex}`;
      const correction = frameCorrections.find(
        (c) => c.propIndex === endpoint.propIndex && c.tipIndex === endpoint.tipIndex,
      );

      if (!correction) {
        result.push(endpoint);
        continue;
      }

      handledKeys.add(key);

      if (correction.status === "occluded") {
        continue;
      }

      if (correction.status === "corrected" || correction.status === "interpolated") {
        if (correction.corrected) {
          result.push({
            ...endpoint,
            x: correction.corrected.x,
            y: correction.corrected.y,
            confidence: 1,
          });
        }
        continue;
      }

      result.push(endpoint);
    }

    // Second pass: add manually placed points that have no corresponding detection.
    // This happens in guided mode where the user clicks to create endpoints from scratch.
    for (const correction of frameCorrections) {
      const key = `${correction.propIndex}-${correction.tipIndex}`;
      if (handledKeys.has(key)) continue;

      if (correction.status === "corrected" || correction.status === "interpolated") {
        if (correction.corrected) {
          result.push({
            x: correction.corrected.x,
            y: correction.corrected.y,
            brightness: 1,
            confidence: 1,
            propIndex: correction.propIndex,
            tipIndex: correction.tipIndex,
            frameIndex,
          });
        }
      }
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
