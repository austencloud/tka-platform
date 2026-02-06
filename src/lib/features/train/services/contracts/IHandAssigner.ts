/**
 * Interface for assigning detected hands to blue/red slots
 * Handles both two-hand and single-hand scenarios using spatial proximity
 */

import type { DetectedPosition } from "../../domain/models/DetectionFrame";

export interface DetectedHandData {
  /** The processed position data */
  position: DetectedPosition;
  /** Raw wrist X coordinate (for position-based sorting) */
  wristX: number;
  /** Whether anatomical analysis indicates user's left hand */
  isUserLeftHand: boolean;
  /** Confidence in the handedness determination */
  confidence: number;
}

export interface HandAssignmentResult {
  /** Position assigned to blue slot (user's left hand) */
  blue: DetectedPosition | null;
  /** Position assigned to red slot (user's right hand) */
  red: DetectedPosition | null;
}

export interface IHandAssigner {
  /**
   * Assign detected hands to blue/red slots
   * Uses spatial position when two hands are detected,
   * and proximity matching when only one hand is detected
   *
   * @param detectedHands - Array of detected hand data
   * @param isMirrored - Whether the video is mirrored
   * @param timestamp - Current frame timestamp
   * @returns Assignment result with blue and red positions
   */
  assignHands(
    detectedHands: DetectedHandData[],
    isMirrored: boolean,
    timestamp: number
  ): HandAssignmentResult;

  /**
   * Handle hand persistence (showing hands briefly after they disappear)
   *
   * @param currentBlue - Currently detected blue position
   * @param currentRed - Currently detected red position
   * @returns Positions with persistence applied
   */
  applyPersistence(
    currentBlue: DetectedPosition | null,
    currentRed: DetectedPosition | null
  ): HandAssignmentResult;

  /**
   * Reset all tracking state (called when stopping detection)
   */
  reset(): void;
}
