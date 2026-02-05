/**
 * Shared Pictograph Types
 *
 * Single source of truth for pictograph and motion data structures
 * used throughout the MCP server.
 */

/**
 * Motion data for a single hand/prop in a pictograph.
 */
export interface MotionData {
  color: string;
  startLocation: string;
  endLocation: string;
  motionType: string;
  rotationDirection: string;
  startOrientation: string; // "in" | "out" | "clock" | "counter" | "clockIn" | "clockOut" | "counterIn" | "counterOut"
  endOrientation: string; // "in" | "out" | "clock" | "counter" | "clockIn" | "clockOut" | "counterIn" | "counterOut"
  /** Spinning plane (Level 6). Defaults to "wall" when omitted. */
  plane?: "wall" | "wheel" | "overhead";
}

/**
 * Complete pictograph data representing one beat of motion.
 */
export interface PictographData {
  letter: string;
  startPosition: string;
  endPosition: string;
  timing: string;
  direction: string;
  blueMotion: MotionData;
  redMotion: MotionData;
}

/**
 * Grid modes supported by the pictograph system.
 */
export type GridMode = "diamond" | "box" | "skewed";
