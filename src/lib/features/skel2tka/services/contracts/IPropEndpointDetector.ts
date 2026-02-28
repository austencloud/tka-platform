/**
 * IPropEndpointDetector - Detect prop staff endpoints in a video frame
 *
 * Interface-only for Phase 0. Implementation comes in Phase 2.
 *
 * Three planned implementations:
 * 1. LuminosityEndpointDetector — MVP, for LED staves (Phase 2)
 * 2. ColorMarkerEndpointDetector — For colored tape markers (future)
 * 3. AIEndpointDetector — Trained ONNX model on collected data (Phase 6)
 */

/** A 2D point with detection confidence */
export interface EndpointPosition {
  x: number;
  y: number;
  confidence: number;
}

/** Detection result for a single staff in a single frame */
export interface PropEndpoints {
  /** Position of the thumb end (consistent grip reference) */
  thumbEnd: EndpointPosition | null;

  /** Position of the pinky end */
  pinkyEnd: EndpointPosition | null;

  /** Staff angle in degrees (0 = horizontal right, 90 = vertical up) */
  angleDegrees: number | null;

  /** Measured staff length in pixels (for consistency checks) */
  staffLengthPx: number | null;
}

/** Hand association for endpoint results */
export interface FrameEndpoints {
  /** Endpoints for the blue (left) hand's staff */
  blue: PropEndpoints | null;

  /** Endpoints for the red (right) hand's staff */
  red: PropEndpoints | null;
}

/** Point for passing hand positions to constrain endpoint search */
export interface Point {
  x: number;
  y: number;
}

export type EndpointDetectionMode = "luminosity" | "color_marker" | "ai_model";

export interface IPropEndpointDetector {
  /** Which detection mode this implementation uses */
  readonly mode: EndpointDetectionMode;

  /** Initialize the detector (download model, set up parameters, etc.) */
  initialize(): Promise<void>;

  /**
   * Detect prop endpoints in a single frame.
   *
   * @param frame - Raw pixel data from the video frame
   * @param handPositions - Known hand positions from Phase 1 (optional, helps constrain search)
   * @returns Detected endpoints for each staff
   */
  detect(frame: ImageData, handPositions?: { blue: Point; red: Point }): FrameEndpoints;

  /** Release resources */
  dispose(): void;
}
