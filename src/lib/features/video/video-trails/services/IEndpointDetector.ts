import type { DetectedEndpoint, DetectionConfig, DetectorCapabilities } from "../domain/types";

export interface IEndpointDetector {
  detect(frame: ImageData, config: DetectionConfig): DetectedEndpoint[];
  readonly name: string;
  readonly capabilities: DetectorCapabilities;
}
