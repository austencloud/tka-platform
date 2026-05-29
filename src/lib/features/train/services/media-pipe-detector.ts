/**
 * MediaPipeDetector (Refactored) - Hand Detection Orchestrator
 *
 * This service orchestrates multiple focused sub-services for hand detection:
 * - HandLandmarker: MediaPipe initialization and raw detection
 * - HandednessAnalyzer: Anatomical left/right hand detection
 * - HandStateAnalyzer: Open/closed/partial state detection
 * - HandTrackingStabilizer: Temporal smoothing and history
 * - HandAssigner: Blue/red slot assignment
 *
 * This orchestrator maintains backward compatibility with IPositionDetector
 * while internally using decomposed, single-responsibility services.
 */

import type { HandLandmark } from "./hand-landmarker";
import type { DetectedHandData } from "./hand-assigner";

export interface DetectionCapabilities {
  supportsRealtime: boolean;
  supportsPostRecording: boolean;
  requiresCalibration: boolean;
}

export interface DetectionOptions {
  mirrored?: boolean;
  gridMode?: GridMode;
}
import type {
  DetectionFrame,
  DetectedPosition,
} from "$lib/shared/train/domain/DetectionFrame";
import type { HandLandmarker } from "./hand-landmarker";
import type { HandTrackingStabilizer } from "./hand-tracking-stabilizer";
import { analyzeHandedness } from "./handedness-analyzer";
import { analyzeHandState, calculatePalmCenter, getReferencePoint } from "./hand-state-analyzer";
import { mapToQuadrant, isValidForMode } from "./quadrant-mapper";
import type { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";

// How many frames to persist a hand after it disappears (for stability)
const HAND_PERSISTENCE_FRAMES = 5;

export class MediaPipeDetector {
  private _landmarker: HandLandmarker;
  private _stabilizer: HandTrackingStabilizer;

  // State
  private _isDetecting = false;
  private _frameCallback: ((frame: DetectionFrame) => void) | null = null;
  private _animationFrameId: number | null = null;
  private _videoElement: HTMLVideoElement | null = null;
  private _isMirrored = true;
  private _gridMode: GridMode | undefined = undefined;

  // Performance monitoring
  private _frameCount = 0;
  private _lastFpsUpdate = 0;
  private _detectionTimes: number[] = [];
  private _currentFps = 0;

  // Persistence tracking
  private _lastBluePosition: DetectedPosition | null = null;
  private _lastRedPosition: DetectedPosition | null = null;
  private _blueFramesMissing = 0;
  private _redFramesMissing = 0;

  constructor(
    landmarker: HandLandmarker,
    stabilizer: HandTrackingStabilizer
  ) {
    this._landmarker = landmarker;
    this._stabilizer = stabilizer;
  }

  get isInitialized(): boolean {
    return this._landmarker.isInitialized;
  }

  get isDetecting(): boolean {
    return this._isDetecting;
  }

  getCapabilities(): DetectionCapabilities {
    return {
      supportsRealtime: true,
      supportsPostRecording: true,
      requiresCalibration: false,
    };
  }

  async initialize(): Promise<void> {
    await this._landmarker.initialize();
  }

  async startRealTimeDetection(
    video: HTMLVideoElement,
    onFrame: (frame: DetectionFrame) => void,
    options?: { mirrored?: boolean; gridMode?: GridMode }
  ): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (this._isDetecting) {
      this.stopDetection();
    }

    this._videoElement = video;
    this._frameCallback = onFrame;
    this._isMirrored = options?.mirrored ?? true;
    this._gridMode = options?.gridMode;
    this._isDetecting = true;

    this._processVideoFrame();
  }

  private _processVideoFrame(): void {
    if (!this._isDetecting || !this._videoElement || !this._frameCallback) {
      return;
    }

    if (this._videoElement.readyState < 2) {
      this._animationFrameId = requestAnimationFrame(() =>
        this._processVideoFrame()
      );
      return;
    }

    const now = performance.now();
    const frameStart = now;

    // Detection
    const result = this._landmarker.detectForVideo(this._videoElement, now);
    const frame = this._processResult(result, now);
    this._frameCallback(frame);

    // Track performance
    const totalTime = performance.now() - frameStart;
    this._detectionTimes.push(totalTime);
    if (this._detectionTimes.length > 60) {
      this._detectionTimes.shift();
    }

    // Update FPS counter
    this._frameCount++;
    if (now - this._lastFpsUpdate >= 1000) {
      this._currentFps = this._frameCount;
      this._frameCount = 0;
      this._lastFpsUpdate = now;
    }

    this._animationFrameId = requestAnimationFrame(() =>
      this._processVideoFrame()
    );
  }

  private _processResult(
    result: {
      landmarks: HandLandmark[][];
      handedness: Array<Array<{ categoryName: string; score: number }>>;
    },
    timestamp: number
  ): DetectionFrame {
    let bluePosition: DetectedPosition | null = null;
    let redPosition: DetectedPosition | null = null;

    if (result.landmarks && result.landmarks.length > 0) {
      // Extract hand data using sub-services
      const detectedHands: DetectedHandData[] = [];

      for (let i = 0; i < result.landmarks.length; i++) {
        const landmarks = result.landmarks[i];
        if (!landmarks || landmarks.length < 1) continue;

        const wrist = landmarks[0];
        if (!wrist) continue;

        // Use HandStateAnalyzer to detect hand state
        const stateResult = analyzeHandState(landmarks);
        const handState = stateResult.state;

        // Use HandStateAnalyzer to calculate palm center
        const palmCenter = calculatePalmCenter(
          landmarks,
          handState
        );
        const referencePoint = getReferencePoint(
          landmarks,
          handState
        );

        // Transform debug landmarks from full video space to crop space
        const wristTransformed = this._transformCropCoordinates(
          wrist.x,
          wrist.y
        );
        const fingerTransformed = this._transformCropCoordinates(
          referencePoint?.x ?? wrist.x,
          referencePoint?.y ?? wrist.y
        );
        const palmTransformed = this._transformCropCoordinates(
          palmCenter.x,
          palmCenter.y
        );

        // Create debug landmarks (apply mirroring AFTER crop transformation)
        const debugLandmarks = {
          wrist: {
            x: this._isMirrored ? 1 - wristTransformed.x : wristTransformed.x,
            y: wristTransformed.y,
          },
          middleFingerTip: {
            x: this._isMirrored ? 1 - fingerTransformed.x : fingerTransformed.x,
            y: fingerTransformed.y,
          },
          palmCenter: {
            x: this._isMirrored ? 1 - palmTransformed.x : palmTransformed.x,
            y: palmTransformed.y,
          },
        };

        // Use HandednessAnalyzer for anatomical detection
        const handednessResult =
          analyzeHandedness(landmarks);
        const anatomicalHandedness = handednessResult.anatomicalHandedness;

        // Determine final handedness
        const handednessData = result.handedness[i]?.[0];
        let isUserLeftHand: boolean;
        let confidence: number;

        if (anatomicalHandedness) {
          isUserLeftHand = anatomicalHandedness === "left";
          confidence = handednessResult.confidence;
        } else {
          // Fallback to MediaPipe
          const rawHandedness = handednessData?.categoryName;
          isUserLeftHand = this._isMirrored
            ? rawHandedness === "Left"
            : rawHandedness === "Right";
          confidence = handednessData?.score ?? 0;
        }

        // Create detected position
        const position = this._createDetectedPosition(
          palmCenter,
          timestamp,
          debugLandmarks,
          handState
        );

        // Only add hand if position is valid for current grid mode
        if (position) {
          detectedHands.push({
            position,
            wristX: wrist.x,
            isUserLeftHand,
            confidence,
          });
        }
      }

      // Assign hands to blue/red slots
      const assignment = this._assignHands(detectedHands, timestamp);
      bluePosition = assignment.blue;
      redPosition = assignment.red;
    }

    // Clear history for undetected hands
    if (!bluePosition) {
      this._stabilizer.clearHistory("blue");
    }
    if (!redPosition) {
      this._stabilizer.clearHistory("red");
    }

    // Apply persistence
    const persisted = this._applyPersistence(bluePosition, redPosition);
    bluePosition = persisted.blue;
    redPosition = persisted.red;

    return {
      timestamp,
      blue: bluePosition,
      red: redPosition,
      source: "mediapipe",
    };
  }

  /**
   * Assign detected hands to blue (left) and red (right) slots
   */
  private _assignHands(
    detectedHands: DetectedHandData[],
    timestamp: number
  ): { blue: DetectedPosition | null; red: DetectedPosition | null } {
    let bluePosition: DetectedPosition | null = null;
    let redPosition: DetectedPosition | null = null;

    if (detectedHands.length === 2) {
      // Two hands - use position to disambiguate
      const sorted = [...detectedHands].sort((a, b) => a.wristX - b.wristX);
      const hand0 = sorted[0];
      const hand1 = sorted[1];

      if (hand0 && hand1) {
        if (this._isMirrored) {
          redPosition = hand0.position;
          bluePosition = hand1.position;
        } else {
          bluePosition = hand0.position;
          redPosition = hand1.position;
        }
      }

      // Apply smoothing
      if (bluePosition) {
        bluePosition = this._applySmoothingToPosition(
          bluePosition,
          "blue",
          timestamp
        );
      }
      if (redPosition) {
        redPosition = this._applySmoothingToPosition(
          redPosition,
          "red",
          timestamp
        );
      }
    } else if (detectedHands.length === 1) {
      const hand = detectedHands[0];
      if (hand) {
        const assigned = this._assignSingleHand(hand, timestamp);
        bluePosition = assigned.blue;
        redPosition = assigned.red;
      }
    }

    return { blue: bluePosition, red: redPosition };
  }

  /**
   * Assign a single detected hand using proximity matching
   */
  private _assignSingleHand(
    hand: DetectedHandData,
    timestamp: number
  ): { blue: DetectedPosition | null; red: DetectedPosition | null } {
    const handX = hand.position.rawPosition.x;
    const handY = hand.position.rawPosition.y;

    let assignToBlue = false;

    const hasBlueHistory = this._stabilizer.hasHistory("blue");
    const hasRedHistory = this._stabilizer.hasHistory("red");

    if (hasBlueHistory && hasRedHistory) {
      const lastBlue = this._stabilizer.getLastPosition("blue");
      const lastRed = this._stabilizer.getLastPosition("red");

      if (lastBlue && lastRed) {
        const distToBlue = this._stabilizer.calculateDistance(
          handX,
          handY,
          lastBlue.x,
          lastBlue.y
        );
        const distToRed = this._stabilizer.calculateDistance(
          handX,
          handY,
          lastRed.x,
          lastRed.y
        );
        assignToBlue = distToBlue < distToRed;
      }
    } else if (hasBlueHistory) {
      const lastBlue = this._stabilizer.getLastPosition("blue");
      if (lastBlue) {
        const distToBlue = this._stabilizer.calculateDistance(
          handX,
          handY,
          lastBlue.x,
          lastBlue.y
        );
        assignToBlue = distToBlue < 0.3;
      }
    } else if (hasRedHistory) {
      const lastRed = this._stabilizer.getLastPosition("red");
      if (lastRed) {
        const distToRed = this._stabilizer.calculateDistance(
          handX,
          handY,
          lastRed.x,
          lastRed.y
        );
        assignToBlue = distToRed >= 0.3;
      }
    } else {
      assignToBlue = handX > 0.5;
    }

    if (assignToBlue) {
      const smoothedPosition = this._applySmoothingToPosition(
        hand.position,
        "blue",
        timestamp
      );
      this._stabilizer.setAssignedHand("blue", "left");
      return { blue: smoothedPosition, red: null };
    } else {
      const smoothedPosition = this._applySmoothingToPosition(
        hand.position,
        "red",
        timestamp
      );
      this._stabilizer.setAssignedHand("red", "right");
      return { blue: null, red: smoothedPosition };
    }
  }

  /**
   * Apply temporal smoothing to a position
   */
  private _applySmoothingToPosition(
    position: DetectedPosition,
    handId: "blue" | "red",
    timestamp: number
  ): DetectedPosition {
    const smoothed = this._stabilizer.addPosition(
      handId,
      position.rawPosition.x,
      position.rawPosition.y,
      timestamp
    );

    return {
      ...position,
      rawPosition: smoothed,
      quadrant: mapToQuadrant(smoothed.x, smoothed.y),
    };
  }

  /**
   * Apply hand persistence (show hands briefly after they disappear)
   */
  private _applyPersistence(
    currentBlue: DetectedPosition | null,
    currentRed: DetectedPosition | null
  ): { blue: DetectedPosition | null; red: DetectedPosition | null } {
    let blue = currentBlue;
    let red = currentRed;

    // Blue hand persistence
    if (blue) {
      this._lastBluePosition = blue;
      this._blueFramesMissing = 0;
    } else if (
      this._lastBluePosition &&
      this._blueFramesMissing < HAND_PERSISTENCE_FRAMES
    ) {
      blue = this._lastBluePosition;
      this._blueFramesMissing++;
    } else {
      this._lastBluePosition = null;
    }

    // Red hand persistence
    if (red) {
      this._lastRedPosition = red;
      this._redFramesMissing = 0;
    } else if (
      this._lastRedPosition &&
      this._redFramesMissing < HAND_PERSISTENCE_FRAMES
    ) {
      red = this._lastRedPosition;
      this._redFramesMissing++;
    } else {
      this._lastRedPosition = null;
    }

    return { blue, red };
  }

  /**
   * Transform coordinates from full video space to displayed crop space.
   *
   * When video uses object-fit: cover, the displayed area may be a crop of the full frame.
   * MediaPipe returns coordinates normalized to the full video dimensions.
   * We need to transform these to the visible crop region.
   *
   * For example, if video is 1920x1080 (16:9) displayed in a square container:
   * - object-fit: cover crops the sides, showing center 1080x1080 pixels
   * - Visible x range: (1920-1080)/2 / 1920 = 0.219 to 0.781
   * - Transform: x_crop = (x - 0.219) / 0.562
   */
  private _transformCropCoordinates(
    x: number,
    y: number
  ): { x: number; y: number } {
    if (!this._videoElement) {
      return { x, y };
    }

    const videoWidth = this._videoElement.videoWidth;
    const videoHeight = this._videoElement.videoHeight;
    const displayWidth = this._videoElement.clientWidth;
    const displayHeight = this._videoElement.clientHeight;

    if (!videoWidth || !videoHeight || !displayWidth || !displayHeight) {
      return { x, y };
    }

    const videoAspect = videoWidth / videoHeight;
    const displayAspect = displayWidth / displayHeight;

    // object-fit: cover behavior
    if (videoAspect > displayAspect) {
      // Video is wider - crop sides
      const visibleWidth = videoHeight * displayAspect;
      const cropLeft = (videoWidth - visibleWidth) / 2;
      const cropRight = cropLeft + visibleWidth;

      // Transform x coordinate
      const cropLeftNorm = cropLeft / videoWidth;
      const cropRightNorm = cropRight / videoWidth;
      const xTransformed = (x - cropLeftNorm) / (cropRightNorm - cropLeftNorm);

      return { x: xTransformed, y };
    } else if (videoAspect < displayAspect) {
      // Video is taller - crop top/bottom
      const visibleHeight = videoWidth / displayAspect;
      const cropTop = (videoHeight - visibleHeight) / 2;
      const cropBottom = cropTop + visibleHeight;

      // Transform y coordinate
      const cropTopNorm = cropTop / videoHeight;
      const cropBottomNorm = cropBottom / videoHeight;
      const yTransformed = (y - cropTopNorm) / (cropBottomNorm - cropTopNorm);

      return { x, y: yTransformed };
    }

    // Same aspect ratio - no crop needed
    return { x, y };
  }

  private _createDetectedPosition(
    landmark: HandLandmark,
    timestamp: number,
    debugLandmarks?: {
      wrist: { x: number; y: number };
      middleFingerTip: { x: number; y: number };
      palmCenter: { x: number; y: number };
    },
    handState?: "open" | "closed" | "partial"
  ): DetectedPosition | null {
    // Transform coordinates from full video space to visible crop space
    const transformed = this._transformCropCoordinates(landmark.x, landmark.y);

    // Apply mirroring AFTER crop transformation
    const x = this._isMirrored ? 1 - transformed.x : transformed.x;
    const y = transformed.y;

    const quadrant = mapToQuadrant(x, y);

    // Check if this quadrant is valid for the current grid mode
    if (!isValidForMode(quadrant, this._gridMode)) {
      // Position detected but not valid for current mode - reject it
      return null;
    }

    return {
      quadrant,
      confidence: 1.0,
      rawPosition: { x, y },
      timestamp,
      debug: debugLandmarks,
      handState,
    };
  }

  getPerformanceStats(): {
    fps: number;
    avgFrameTime: number;
    videoResolution: string;
  } {
    const avgTime =
      this._detectionTimes.length > 0
        ? this._detectionTimes.reduce((a, b) => a + b, 0) /
          this._detectionTimes.length
        : 0;
    const resolution = this._videoElement
      ? `${this._videoElement.videoWidth}x${this._videoElement.videoHeight}`
      : "N/A";
    return {
      fps: this._currentFps,
      avgFrameTime: avgTime,
      videoResolution: resolution,
    };
  }

  stopDetection(): void {
    this._isDetecting = false;
    this._frameCallback = null;
    this._videoElement = null;

    // Reset persistence state
    this._lastBluePosition = null;
    this._lastRedPosition = null;
    this._blueFramesMissing = 0;
    this._redFramesMissing = 0;

    // Reset stabilizer
    this._stabilizer.resetAll();

    // Reset performance tracking
    this._frameCount = 0;
    this._detectionTimes = [];
    this._currentFps = 0;

    if (this._animationFrameId !== null) {
      cancelAnimationFrame(this._animationFrameId);
      this._animationFrameId = null;
    }
  }

  async processFrame(
    imageData: ImageData,
    timestamp: number
  ): Promise<DetectionFrame> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const canvas = new OffscreenCanvas(imageData.width, imageData.height);
    const ctx = canvas.getContext("2d")!;
    ctx.putImageData(imageData, 0, 0);

    const result = this._landmarker.detect(canvas);
    return this._processResult(result, timestamp);
  }

  dispose(): void {
    this.stopDetection();
    this._landmarker.dispose();
  }
}
