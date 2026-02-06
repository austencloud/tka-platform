/**
 * Interface for analyzing hand state (open, closed, partial)
 * Determines finger extension based on landmark positions
 */

import type { HandLandmark } from "./IHandLandmarker";
import type { HandState } from "../../domain/models/DetectionFrame";

export interface HandStateAnalysisResult {
  /** The detected hand state */
  state: HandState;
  /** Number of extended fingers (0-4, not counting thumb) */
  extendedFingerCount: number;
}

export interface IHandStateAnalyzer {
  /**
   * Analyze hand landmarks to determine hand state (open/closed/partial)
   *
   * @param landmarks - Array of 21 hand landmarks from MediaPipe
   * @returns Hand state and extended finger count
   */
  analyzeHandState(landmarks: HandLandmark[]): HandStateAnalysisResult;

  /**
   * Get the appropriate reference point based on hand state
   * - Closed hand: middle finger PIP (knuckle)
   * - Open hand: middle finger tip
   *
   * @param landmarks - Array of hand landmarks
   * @param handState - Current hand state
   * @returns Reference landmark or null if not available
   */
  getReferencePoint(
    landmarks: HandLandmark[],
    handState: HandState
  ): HandLandmark | null;

  /**
   * Calculate palm center position based on hand state
   * Uses weighted average between wrist and reference point
   *
   * @param landmarks - Array of hand landmarks
   * @param handState - Current hand state
   * @returns Palm center coordinates
   */
  calculatePalmCenter(
    landmarks: HandLandmark[],
    handState: HandState
  ): HandLandmark;
}
