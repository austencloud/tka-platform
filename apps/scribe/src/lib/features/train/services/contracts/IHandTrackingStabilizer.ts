/**
 * Interface for temporal smoothing and hand persistence
 * Reduces jitter and maintains hand identity across frames
 */

export interface HandHistory {
  positions: Array<{ x: number; y: number; timestamp: number }>;
  assignedHand: "left" | "right";
  confidenceFrames: number;
}

export interface SmoothedPosition {
  x: number;
  y: number;
}

export interface StabilizerConfig {
  /** Number of frames to keep in history for smoothing */
  smoothingWindow: number;
  /** Number of frames to persist a hand after it disappears */
  persistenceFrames: number;
  /** Minimum distance to switch handedness assignment (normalized 0-1) */
  handednessSwitchThreshold: number;
}

export interface IHandTrackingStabilizer {
  /**
   * Add a position to tracking history and get smoothed result
   * Uses weighted average favoring recent frames
   *
   * @param handId - "blue" or "red"
   * @param x - X coordinate (0-1)
   * @param y - Y coordinate (0-1)
   * @param timestamp - Frame timestamp
   * @returns Smoothed position
   */
  addPosition(
    handId: "blue" | "red",
    x: number,
    y: number,
    timestamp: number
  ): SmoothedPosition;

  /**
   * Get the last known position for a hand
   *
   * @param handId - "blue" or "red"
   * @returns Last position or null if no history
   */
  getLastPosition(handId: "blue" | "red"): { x: number; y: number } | null;

  /**
   * Clear tracking history for a specific hand
   *
   * @param handId - "blue" or "red"
   */
  clearHistory(handId: "blue" | "red"): void;

  /**
   * Clear all tracking history
   */
  resetAll(): void;

  /**
   * Get the current hand assignment
   *
   * @param handId - "blue" or "red"
   * @returns "left" or "right"
   */
  getAssignedHand(handId: "blue" | "red"): "left" | "right";

  /**
   * Update the hand assignment
   *
   * @param handId - "blue" or "red"
   * @param hand - "left" or "right"
   */
  setAssignedHand(handId: "blue" | "red", hand: "left" | "right"): void;

  /**
   * Check if there's any position history for a hand
   *
   * @param handId - "blue" or "red"
   */
  hasHistory(handId: "blue" | "red"): boolean;

  /**
   * Get the history length for a hand
   *
   * @param handId - "blue" or "red"
   */
  getHistoryLength(handId: "blue" | "red"): number;

  /**
   * Calculate Euclidean distance between two points
   *
   * @param x1 - First X coordinate
   * @param y1 - First Y coordinate
   * @param x2 - Second X coordinate
   * @param y2 - Second Y coordinate
   * @returns Distance between the points
   */
  calculateDistance(x1: number, y1: number, x2: number, y2: number): number;
}
