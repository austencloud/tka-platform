/**
 * HandLandmarker - MediaPipe HandLandmarker wrapper
 *
 * Responsibility: Initialize and manage MediaPipe HandLandmarker,
 * provide raw landmark detection for video frames and images.
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MediaPipeHandLandmarker = any;

export class HandLandmarker {
  private _handLandmarker: MediaPipeHandLandmarker = null;
  private _isInitialized = false;

  get isInitialized(): boolean {
    return this._isInitialized;
  }

  async initialize(): Promise<void> {
    if (this._isInitialized) return;

    try {
      // Dynamically import MediaPipe
      const vision = await import("@mediapipe/tasks-vision");
      const { HandLandmarker, FilesetResolver } = vision;

      const wasmFileset = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm"
      );

      this._handLandmarker = await HandLandmarker.createFromOptions(
        wasmFileset,
        {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numHands: 2,
          minHandDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        }
      );

      this._isInitialized = true;
    } catch (error) {
      throw new Error(`MediaPipe initialization failed: ${error}`);
    }
  }

  detectForVideo(
    video: HTMLVideoElement,
    timestamp: number
  ): HandLandmarkerResult {
    if (!this._isInitialized || !this._handLandmarker) {
      throw new Error("HandLandmarker not initialized");
    }

    return this._handLandmarker.detectForVideo(video, timestamp);
  }

  detect(image: OffscreenCanvas): HandLandmarkerResult {
    if (!this._isInitialized || !this._handLandmarker) {
      throw new Error("HandLandmarker not initialized");
    }

    return this._handLandmarker.detect(image);
  }

  dispose(): void {
    if (this._handLandmarker) {
      this._handLandmarker.close();
      this._handLandmarker = null;
    }
    this._isInitialized = false;
  }
}
