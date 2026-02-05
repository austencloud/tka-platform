/**
 * Interface for MediaPipe HandLandmarker wrapper
 * Handles initialization and raw landmark detection from MediaPipe
 */

export interface HandLandmark {
  x: number;
  y: number;
  z: number;
}

export interface HandednessResult {
  categoryName: string;
  score: number;
}

export interface HandLandmarkerResult {
  landmarks: HandLandmark[][];
  handedness: HandednessResult[][];
}

export interface IHandLandmarker {
  /** Initialize MediaPipe HandLandmarker */
  initialize(): Promise<void>;

  /** Detect hands in a video frame (VIDEO mode) */
  detectForVideo(
    video: HTMLVideoElement,
    timestamp: number
  ): HandLandmarkerResult;

  /** Detect hands in an image (IMAGE mode) */
  detect(image: OffscreenCanvas): HandLandmarkerResult;

  /** Clean up resources */
  dispose(): void;

  /** Whether the service is initialized */
  readonly isInitialized: boolean;
}
