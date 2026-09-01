/**
 * Effect State for 3D Animation
 *
 * Tracks position history for props to enable trail, particle, and other effects.
 * Maintains a rolling buffer of recent positions with velocity calculations.
 */

import type { Vector3 } from "three";
import type { TrailPoint, PropPositionHistory, PropId } from "../types";

// Configuration

/**
 * Configuration for effect state
 */
export interface EffectStateConfig {
  /** Maximum number of positions to track (default: 60 = 1 second at 60fps) */
  maxHistoryLength: number;
  /** Minimum time between position updates in ms (default: 16 = ~60fps) */
  minUpdateInterval: number;
}

const DEFAULT_CONFIG: EffectStateConfig = {
  maxHistoryLength: 60,
  minUpdateInterval: 16,
};

// Effect State Factory

/**
 * Create effect state for tracking prop position history
 */
export function createEffectState(config: Partial<EffectStateConfig> = {}) {
  const mergedConfig: EffectStateConfig = { ...DEFAULT_CONFIG, ...config };

  // Position history for each prop
  let leftHistory = $state<TrailPoint[]>([]);
  let rightHistory = $state<TrailPoint[]>([]);

  // Last update timestamps for throttling
  let lastLeftUpdate = 0;
  let lastRightUpdate = 0;

  // Previous positions for velocity calculation
  let prevLeftPos: Vector3 | null = null;
  let prevRightPos: Vector3 | null = null;

  // Derived current velocities
  const leftVelocity = $derived(
    leftHistory.length > 0 ? (leftHistory[0]?.velocity ?? 0) : 0
  );
  const rightVelocity = $derived(
    rightHistory.length > 0 ? (rightHistory[0]?.velocity ?? 0) : 0
  );

  // Derived full history objects
  const leftPositionHistory = $derived<PropPositionHistory>({
    points: leftHistory,
    currentVelocity: leftVelocity,
  });

  const rightPositionHistory = $derived<PropPositionHistory>({
    points: rightHistory,
    currentVelocity: rightVelocity,
  });

  /**
   * Calculate velocity between two positions over a time delta
   */
  function calculateVelocity(
    prevPos: Vector3 | null,
    currentPos: Vector3,
    deltaTime: number
  ): number {
    if (!prevPos || deltaTime <= 0) return 0;

    const distance = prevPos.distanceTo(currentPos);
    // Convert to units per second (deltaTime is in ms)
    return (distance / deltaTime) * 1000;
  }

  /**
   * Add a position to history, maintaining max length
   */
  function addToHistory(
    history: TrailPoint[],
    position: Vector3,
    timestamp: number,
    velocity: number
  ): TrailPoint[] {
    const newPoint: TrailPoint = {
      position: position.clone(),
      timestamp,
      velocity,
    };

    // Prepend new point, slice to max length
    const updated = [newPoint, ...history];
    if (updated.length > mergedConfig.maxHistoryLength) {
      return updated.slice(0, mergedConfig.maxHistoryLength);
    }
    return updated;
  }

  /**
   * Update positions for both props (call each frame)
   */
  function updatePositions(leftPos: Vector3 | null, rightPos: Vector3 | null) {
    const now = performance.now();

    // Update blue prop
    if (leftPos) {
      const deltaTime = now - lastLeftUpdate;
      if (deltaTime >= mergedConfig.minUpdateInterval) {
        const velocity = calculateVelocity(prevLeftPos, leftPos, deltaTime);
        leftHistory = addToHistory(leftHistory, leftPos, now, velocity);
        prevLeftPos = leftPos.clone();
        lastLeftUpdate = now;
      }
    }

    // Update red prop
    if (rightPos) {
      const deltaTime = now - lastRightUpdate;
      if (deltaTime >= mergedConfig.minUpdateInterval) {
        const velocity = calculateVelocity(prevRightPos, rightPos, deltaTime);
        rightHistory = addToHistory(rightHistory, rightPos, now, velocity);
        prevRightPos = rightPos.clone();
        lastRightUpdate = now;
      }
    }
  }

  /**
   * Get trail points for a prop
   * @param prop - Which prop to get trail for
   * @param count - Optional limit on number of points (default: all)
   */
  function getTrailPoints(prop: PropId, count?: number): TrailPoint[] {
    const history = prop === "left" ? leftHistory : rightHistory;
    if (count === undefined || count >= history.length) {
      return history;
    }
    return history.slice(0, count);
  }

  /**
   * Get just the positions as Vector3 array (for mesh geometry)
   * @param prop - Which prop to get positions for
   * @param count - Optional limit on number of positions
   */
  function getPositions(prop: PropId, count?: number): Vector3[] {
    const points = getTrailPoints(prop, count);
    return points.map((p) => p.position);
  }

  /**
   * Get current velocity for a prop
   * @param prop - Which prop to get velocity for
   */
  function getVelocity(prop: PropId): number {
    return prop === "left" ? leftVelocity : rightVelocity;
  }

  /**
   * Get average velocity over recent history
   * @param prop - Which prop to get velocity for
   * @param sampleCount - Number of recent samples to average (default: 10)
   */
  function getAverageVelocity(prop: PropId, sampleCount = 10): number {
    const history = prop === "left" ? leftHistory : rightHistory;
    if (history.length === 0) return 0;

    const samples = history.slice(0, Math.min(sampleCount, history.length));
    const sum = samples.reduce((acc, p) => acc + p.velocity, 0);
    return sum / samples.length;
  }

  /**
   * Get the full position history for a prop
   * @param prop - Which prop to get history for
   */
  function getHistory(prop: PropId): PropPositionHistory {
    return prop === "left" ? leftPositionHistory : rightPositionHistory;
  }

  /**
   * Clear all position history (call on sequence change)
   */
  function clear() {
    leftHistory = [];
    rightHistory = [];
    prevLeftPos = null;
    prevRightPos = null;
    lastLeftUpdate = 0;
    lastRightUpdate = 0;
  }

  /**
   * Clear history for a specific prop
   */
  function clearProp(prop: PropId) {
    if (prop === "left") {
      leftHistory = [];
      prevLeftPos = null;
      lastLeftUpdate = 0;
    } else {
      rightHistory = [];
      prevRightPos = null;
      lastRightUpdate = 0;
    }
  }

  /**
   * Check if there's enough history for effects
   * @param prop - Which prop to check
   * @param minPoints - Minimum points needed (default: 2)
   */
  function hasEnoughHistory(prop: PropId, minPoints = 2): boolean {
    const history = prop === "left" ? leftHistory : rightHistory;
    return history.length >= minPoints;
  }

  return {
    // Reactive state
    get leftHistory() {
      return leftPositionHistory;
    },
    get rightHistory() {
      return rightPositionHistory;
    },
    get leftVelocity() {
      return leftVelocity;
    },
    get rightVelocity() {
      return rightVelocity;
    },

    // Methods
    updatePositions,
    getTrailPoints,
    getPositions,
    getVelocity,
    getAverageVelocity,
    getHistory,
    clear,
    clearProp,
    hasEnoughHistory,

    // Configuration (read-only)
    config: mergedConfig,
  };
}

// Type Export

export type EffectState = ReturnType<typeof createEffectState>;

// Singleton Instance

/**
 * Singleton effect state instance for global access
 * Create via createEffectState() for isolated instances
 */
let singletonInstance: EffectState | null = null;

export function getEffectState(): EffectState {
  if (!singletonInstance) {
    singletonInstance = createEffectState();
  }
  return singletonInstance;
}

/**
 * Reset the singleton instance (for testing or cleanup)
 */
export function resetEffectState(): void {
  if (singletonInstance) {
    singletonInstance.clear();
    singletonInstance = null;
  }
}
