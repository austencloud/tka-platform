import type { DetectionFrame } from "../../domain/models/DetectionFrame";
import type { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";

export interface DetectionCapabilities {
  supportsRealtime: boolean;
  supportsPostRecording: boolean;
  requiresCalibration: boolean;
}

export interface DetectionOptions {
  /** Whether the video feed is mirrored (default: true for front-facing camera) */
  mirrored?: boolean;
  /** Grid mode for position detection (BOX = cardinal only, DIAMOND = intercardinal only) */
  gridMode?: GridMode;
}

export interface IPositionDetector {
  getCapabilities(): DetectionCapabilities;
  initialize(): Promise<void>;
  startRealTimeDetection(
    video: HTMLVideoElement,
    onFrame: (frame: DetectionFrame) => void,
    options?: DetectionOptions
  ): Promise<void>;
  stopDetection(): void;
  processFrame(
    imageData: ImageData,
    timestamp: number
  ): Promise<DetectionFrame>;
  dispose(): void;
  readonly isInitialized: boolean;
  readonly isDetecting: boolean;
  getPerformanceStats?(): {
    fps: number;
    avgFrameTime: number;
    videoResolution: string;
  };
}
