/**
 * HandAssigner - Hand slot assignment logic
 *
 * Responsibility: Assign detected hands to blue (left) and red (right) slots
 * using spatial position for two-hand detection and proximity matching for
 * single-hand detection. Also handles hand persistence.
 */

import type { HandTrackingStabilizer } from "./hand-tracking-stabilizer";
import type { DetectedPosition } from "$lib/shared/train/domain/detection-frame";

export interface DetectedHandData {
  position: DetectedPosition;
  wristX: number;
  isUserLeftHand: boolean;
  confidence: number;
}

export interface HandAssignmentResult {
  blue: DetectedPosition | null;
  red: DetectedPosition | null;
}
import { mapToQuadrant } from "./quadrant-mapper";

// How many frames to persist a hand after it disappears
const HAND_PERSISTENCE_FRAMES = 5;

export class HandAssigner {
  // Track last known positions for persistence
  private _lastBluePosition: DetectedPosition | null = null;
  private _lastRedPosition: DetectedPosition | null = null;
  private _blueFramesMissing = 0;
  private _redFramesMissing = 0;

  constructor(private _stabilizer: HandTrackingStabilizer) {}

  /**
   * Assign detected hands to blue/red slots
   */
  assignHands(
    detectedHands: DetectedHandData[],
    isMirrored: boolean,
    timestamp: number
  ): HandAssignmentResult {
    let bluePosition: DetectedPosition | null = null;
    let redPosition: DetectedPosition | null = null;

    if (detectedHands.length === 2) {
      // Two hands detected - use position to disambiguate (most reliable)
      const result = this._assignTwoHands(detectedHands, isMirrored, timestamp);
      bluePosition = result.blue;
      redPosition = result.red;
    } else if (detectedHands.length === 1) {
      // Single hand - use proximity matching
      const result = this._assignSingleHand(
        detectedHands[0]!,
        isMirrored,
        timestamp
      );
      bluePosition = result.blue;
      redPosition = result.red;
    }

    // Clear history for hands that aren't detected
    if (!bluePosition) {
      this._stabilizer.clearHistory("blue");
    }
    if (!redPosition) {
      this._stabilizer.clearHistory("red");
    }

    return { blue: bluePosition, red: redPosition };
  }

  /**
   * Handle two-hand assignment using spatial position
   */
  private _assignTwoHands(
    detectedHands: DetectedHandData[],
    isMirrored: boolean,
    timestamp: number
  ): HandAssignmentResult {
    // Sort by wrist X position (in raw camera space, not mirrored)
    const sorted = [...detectedHands].sort((a, b) => a.wristX - b.wristX);

    const hand0 = sorted[0];
    const hand1 = sorted[1];

    if (!hand0 || !hand1) {
      return { blue: null, red: null };
    }

    let bluePosition: DetectedPosition;
    let redPosition: DetectedPosition;

    // In camera space: lower X = left side of image
    // When mirrored: left side of image = right side of screen = user's right hand
    // When mirrored: right side of image = left side of screen = user's left hand
    if (isMirrored) {
      redPosition = hand0.position; // Lower X = right side of screen = user's right hand
      bluePosition = hand1.position; // Higher X = left side of screen = user's left hand
    } else {
      bluePosition = hand0.position;
      redPosition = hand1.position;
    }

    bluePosition = this._applySmoothingToPosition(
      bluePosition,
      "blue",
      timestamp
    );
    redPosition = this._applySmoothingToPosition(redPosition, "red", timestamp);

    return { blue: bluePosition, red: redPosition };
  }

  /**
   * Handle single-hand assignment using proximity matching
   */
  private _assignSingleHand(
    hand: DetectedHandData,
    _isMirrored: boolean,
    timestamp: number
  ): HandAssignmentResult {
    const handX = hand.position.rawPosition.x;
    const handY = hand.position.rawPosition.y;

    let assignToBlue = false;

    // Match to existing hand based on SPATIAL PROXIMITY
    const hasBlueHistory = this._stabilizer.hasHistory("blue");
    const hasRedHistory = this._stabilizer.hasHistory("red");

    if (hasBlueHistory && hasRedHistory) {
      // Both hands have history - match to closest
      const lastBlue = this._stabilizer.getLastPosition("blue");
      const lastRed = this._stabilizer.getLastPosition("red");

      if (lastBlue && lastRed) {
        const distToBlue = this._calculateDistance(
          handX,
          handY,
          lastBlue.x,
          lastBlue.y
        );
        const distToRed = this._calculateDistance(
          handX,
          handY,
          lastRed.x,
          lastRed.y
        );
        assignToBlue = distToBlue < distToRed;
      }
    } else if (hasBlueHistory) {
      // Only blue history - check if close enough
      const lastBlue = this._stabilizer.getLastPosition("blue");
      if (lastBlue) {
        const distToBlue = this._calculateDistance(
          handX,
          handY,
          lastBlue.x,
          lastBlue.y
        );
        assignToBlue = distToBlue < 0.3; // Within 30% of screen
      }
    } else if (hasRedHistory) {
      // Only red history - check if close enough
      const lastRed = this._stabilizer.getLastPosition("red");
      if (lastRed) {
        const distToRed = this._calculateDistance(
          handX,
          handY,
          lastRed.x,
          lastRed.y
        );
        assignToBlue = distToRed >= 0.3; // Too far from red, must be blue
      }
    } else {
      // No history - use screen position to guess
      // Hand on right side of screen (in mirrored view) = left hand = blue
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
   * Handle hand persistence (showing hands briefly after they disappear)
   */
  applyPersistence(
    currentBlue: DetectedPosition | null,
    currentRed: DetectedPosition | null
  ): HandAssignmentResult {
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
   * Reset all tracking state
   */
  reset(): void {
    this._stabilizer.resetAll();
    this._lastBluePosition = null;
    this._lastRedPosition = null;
    this._blueFramesMissing = 0;
    this._redFramesMissing = 0;
  }

  /**
   * Calculate distance between two points
   */
  private _calculateDistance(
    x1: number,
    y1: number,
    x2: number,
    y2: number
  ): number {
    return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
  }
}
