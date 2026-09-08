/**
 * HandTrackingStabilizer - Temporal smoothing and history tracking
 *
 * Responsibility: Maintain position history for each hand,
 * apply temporal smoothing to reduce jitter, and track hand identity.
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
  smoothingWindow: number;
  persistenceFrames: number;
  handednessSwitchThreshold: number;
}

const DEFAULT_CONFIG: StabilizerConfig = {
  smoothingWindow: 3,
  persistenceFrames: 5,
  handednessSwitchThreshold: 0.4,
};

export class HandTrackingStabilizer {
  private _leftHistory: HandHistory = {
    positions: [],
    assignedHand: "left",
    confidenceFrames: 0,
  };

  private _rightHistory: HandHistory = {
    positions: [],
    assignedHand: "right",
    confidenceFrames: 0,
  };

  private _config: StabilizerConfig;

  constructor(config?: Partial<StabilizerConfig>) {
    this._config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Get the history object for a hand
   */
  private _getHistory(handId: "left" | "right"): HandHistory {
    return handId === "left" ? this._leftHistory : this._rightHistory;
  }

  /**
   * Add a position to tracking history and get smoothed result
   */
  addPosition(
    handId: "left" | "right",
    x: number,
    y: number,
    timestamp: number
  ): SmoothedPosition {
    const history = this._getHistory(handId);

    // Add new position
    history.positions.push({ x, y, timestamp });

    // Keep only recent positions
    if (history.positions.length > this._config.smoothingWindow) {
      history.positions.shift();
    }

    // Calculate smoothed position (weighted average favoring recent frames)
    let totalWeight = 0;
    let smoothedX = 0;
    let smoothedY = 0;

    for (let i = 0; i < history.positions.length; i++) {
      // More recent frames get higher weight
      const weight = i + 1;
      const pos = history.positions[i];
      if (pos) {
        smoothedX += pos.x * weight;
        smoothedY += pos.y * weight;
        totalWeight += weight;
      }
    }

    return {
      x: smoothedX / totalWeight,
      y: smoothedY / totalWeight,
    };
  }

  /**
   * Get the last known position for a hand
   */
  getLastPosition(handId: "left" | "right"): { x: number; y: number } | null {
    const history = this._getHistory(handId);
    if (history.positions.length === 0) return null;

    const lastPos = history.positions[history.positions.length - 1];
    return lastPos ? { x: lastPos.x, y: lastPos.y } : null;
  }

  /**
   * Clear tracking history for a specific hand
   */
  clearHistory(handId: "left" | "right"): void {
    const history = this._getHistory(handId);
    history.positions = [];
    history.confidenceFrames = 0;
  }

  /**
   * Clear all tracking history
   */
  resetAll(): void {
    this._leftHistory = {
      positions: [],
      assignedHand: "left",
      confidenceFrames: 0,
    };
    this._rightHistory = {
      positions: [],
      assignedHand: "right",
      confidenceFrames: 0,
    };
  }

  getAssignedHand(handId: "left" | "right"): "left" | "right" {
    return this._getHistory(handId).assignedHand;
  }

  /**
   * Update the hand assignment
   */
  setAssignedHand(handId: "left" | "right", hand: "left" | "right"): void {
    this._getHistory(handId).assignedHand = hand;
  }

  /**
   * Check if there's any position history for a hand
   */
  hasHistory(handId: "left" | "right"): boolean {
    return this._getHistory(handId).positions.length > 0;
  }

  getHistoryLength(handId: "left" | "right"): number {
    return this._getHistory(handId).positions.length;
  }

  /**
   * Calculate distance between two points
   */
  calculateDistance(x1: number, y1: number, x2: number, y2: number): number {
    return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
  }

  /**
   * Get the persistence frames config
   */
  get persistenceFrames(): number {
    return this._config.persistenceFrames;
  }
}
