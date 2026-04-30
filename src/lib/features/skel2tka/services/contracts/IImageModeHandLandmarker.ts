/**
 * IImageModeHandLandmarker - MediaPipe HandLandmarker in IMAGE mode
 *
 * Dedicated to batch/offline frame analysis. Unlike the train module's
 * VIDEO mode landmarker (which tracks hands across frames and requires
 * monotonically increasing timestamps), IMAGE mode treats each frame
 * independently - correct for video uploads where frames are pre-extracted.
 */

import type { HandLandmarkerResult } from "$lib/features/train/services/contracts/IHandLandmarker";

export interface IImageModeHandLandmarker {
  /** Initialize MediaPipe HandLandmarker in IMAGE mode */
  initialize(): Promise<void>;

  /** Detect hands in a single image (no temporal tracking) */
  detect(image: OffscreenCanvas): HandLandmarkerResult;

  /** Clean up WASM/GPU resources */
  dispose(): void;

  /** Whether MediaPipe models have been downloaded and loaded */
  readonly isInitialized: boolean;
}
