/**
 * Anatomical hand detection
 *
 * Analyzes hand landmarks to determine left vs right hand using anatomical
 * features (thumb position, palm orientation) rather than relying solely on
 * MediaPipe's handedness classification.
 */

import type { HandLandmark } from "./hand-landmarker";

export type PalmOrientation = "facing" | "away" | "unknown";
export type AnatomicalHandedness = "left" | "right" | null;

export interface HandednessAnalysisResult {
  anatomicalHandedness: AnatomicalHandedness;
  palmOrientation: PalmOrientation;
  confidence: number;
}

/**
 * Detect if palm is facing the camera or facing away
 * Uses Z-coordinates - palm facing camera has fingertips with lower Z than wrist
 */
export function detectPalmOrientation(landmarks: HandLandmark[]): PalmOrientation {
  if (landmarks.length < 13) return "unknown";

  const wrist = landmarks[0];
  const middleTip = landmarks[12];
  const indexTip = landmarks[8];

  if (!wrist || !middleTip || !indexTip) return "unknown";

  // Average Z of fingertips vs wrist
  const avgFingerZ = (middleTip.z + indexTip.z) / 2;

  // If fingers are in front of wrist (lower Z), palm facing camera
  // If fingers are behind wrist (higher Z), palm facing away
  const zDiff = avgFingerZ - wrist.z;

  if (Math.abs(zDiff) < 0.02) return "unknown"; // Too close to call

  return zDiff < 0 ? "facing" : "away";
}

/**
 * Analyze hand landmarks to determine left vs right hand
 * Uses anatomical features like thumb position and palm orientation
 */
export function analyzeHandedness(landmarks: HandLandmark[]): HandednessAnalysisResult {
  const palmOrientation = detectPalmOrientation(landmarks);
  const anatomicalHandedness = detectHandednessFromAnatomy(
    landmarks,
    palmOrientation
  );

  return {
    anatomicalHandedness,
    palmOrientation,
    confidence: anatomicalHandedness ? 0.95 : 0,
  };
}

/**
 * Detect left vs right hand based on ANATOMICAL features (thumb position)
 * This works regardless of where the hand is on screen or if crossed over body
 *
 * MUST detect palm orientation first to correctly interpret thumb position
 */
function detectHandednessFromAnatomy(
  landmarks: HandLandmark[],
  palmOrientation: PalmOrientation
): AnatomicalHandedness {
  if (landmarks.length < 18) return null;

  const thumbTip = landmarks[4]; // Thumb tip
  const indexBase = landmarks[5]; // Index finger MCP
  const pinkyBase = landmarks[17]; // Pinky MCP

  if (!thumbTip || !indexBase || !pinkyBase) return null;

  // Calculate cross product to determine which side thumb is on
  // Vector from pinky to index
  const pinkyToIndexX = indexBase.x - pinkyBase.x;
  const pinkyToIndexY = indexBase.y - pinkyBase.y;

  // Vector from pinky to thumb
  const pinkyToThumbX = thumbTip.x - pinkyBase.x;
  const pinkyToThumbY = thumbTip.y - pinkyBase.y;

  // Cross product (z-component)
  const crossProduct =
    pinkyToIndexX * pinkyToThumbY - pinkyToIndexY * pinkyToThumbX;

  // Interpret based on palm orientation
  let isLeftHand: boolean;

  if (palmOrientation === "facing") {
    // Palm facing camera:
    // MediaPipe gives us UN-mirrored coordinates (from camera's perspective)
    // Positive cross product = thumb on RIGHT in camera coords = LEFT hand in real world
    // Negative cross product = thumb on LEFT in camera coords = RIGHT hand in real world
    isLeftHand = crossProduct > 0;
  } else if (palmOrientation === "away") {
    // Palm facing away (back of hand):
    // The logic is INVERTED from facing
    isLeftHand = crossProduct < 0;
  } else {
    // Can't determine orientation - fall back to MediaPipe
    return null;
  }

  return isLeftHand ? "left" : "right";
}
