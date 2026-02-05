/**
 * Interface for analyzing hand anatomical features to determine left vs right hand
 * This uses anatomical features (thumb position, palm orientation) rather than
 * relying solely on MediaPipe's handedness classification
 */

import type { HandLandmark } from "./IHandLandmarker";

export type PalmOrientation = "facing" | "away" | "unknown";
export type AnatomicalHandedness = "left" | "right" | null;

export interface HandednessAnalysisResult {
  /** Anatomically detected handedness (null if unable to determine) */
  anatomicalHandedness: AnatomicalHandedness;
  /** Palm orientation relative to camera */
  palmOrientation: PalmOrientation;
  /** Confidence in the anatomical detection (0-1) */
  confidence: number;
}

export interface IHandednessAnalyzer {
  /**
   * Analyze hand landmarks to determine left vs right hand
   * Uses anatomical features like thumb position and palm orientation
   *
   * @param landmarks - Array of 21 hand landmarks from MediaPipe
   * @returns Analysis result with handedness and palm orientation
   */
  analyzeHandedness(landmarks: HandLandmark[]): HandednessAnalysisResult;

  /**
   * Detect if palm is facing the camera or facing away
   * Uses Z-coordinates to determine orientation
   *
   * @param landmarks - Array of hand landmarks
   * @returns Palm orientation
   */
  detectPalmOrientation(landmarks: HandLandmark[]): PalmOrientation;
}
