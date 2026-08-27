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
  let blueHistory = $state<TrailPoint[]>([]);
  let redHistory = $state<TrailPoint[]>([]);

  // Last update timestamps for throttling
  let lastBlueUpdate = 0;
  let lastRedUpdate = 0;

  // Previous positions for velocity calculation
  let prevBluePos: Vector3 | null = null;
  let prevRedPos: Vector3 | null = null;

  // Derived current velocities
  const blueVelocity = $derived(
    blueHistory.length > 0 ? (blueHistory[0]?.velocity ?? 0) : 0
  );
  const redVelocity = $derived(
    redHistory.length > 0 ? (redHistory[0]?.velocity ?? 0) : 0
  );

  // Derived full history objects
  const bluePositionHistory = $derived<PropPositionHistory>({
    points: blueHistory,
    currentVelocity: blueVelocity,
  });

  const redPositionHistory = $derived<PropPositionHistory>({
    points: redHistory,
    currentVelocity: redVelocity,
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
  function updatePositions(bluePos: Vector3 | null, redPos: Vector3 | null) {
    const now = performance.now();

    // Update blue prop
    if (bluePos) {
      const deltaTime = now - lastBlueUpdate;
      if (deltaTime >= mergedConfig.minUpdateInterval) {
        const velocity = calculateVelocity(prevBluePos, bluePos, deltaTime);
        blueHistory = addToHistory(blueHistory, bluePos, now, velocity);
        prevBluePos = bluePos.clone();
        lastBlueUpdate = now;
      }
    }

    // Update red prop
    if (redPos) {
      const deltaTime = now - lastRedUpdate;
      if (deltaTime >= mergedConfig.minUpdateInterval) {
        const velocity = calculateVelocity(prevRedPos, redPos, deltaTime);
        redHistory = addToHistory(redHistory, redPos, now, velocity);
        prevRedPos = redPos.clone();
        lastRedUpdate = now;
      }
    }
  }

  /**
   * Get trail points for a prop
   * @param prop - Which prop to get trail for
   * @param count - Optional limit on number of points (default: all)
   */
  function getTrailPoints(prop: PropId, count?: number): TrailPoint[] {
    const history = prop === "blue" ? blueHistory : redHistory;
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
    return prop === "blue" ? blueVelocity : redVelocity;
  }

  /**
   * Get average velocity over recent history
   * @param prop - Which prop to get velocity for
   * @param sampleCount - Number of recent samples to average (default: 10)
   */
  function getAverageVelocity(prop: PropId, sampleCount = 10): number {
    const history = prop === "blue" ? blueHistory : redHistory;
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
    return prop === "blue" ? bluePositionHistory : redPositionHistory;
  }

  /**
   * Clear all position history (call on sequence change)
   */
  function clear() {
    blueHistory = [];
    redHistory = [];
    prevBluePos = null;
    prevRedPos = null;
    lastBlueUpdate = 0;
    lastRedUpdate = 0;
  }

  /**
   * Clear history for a specific prop
   */
  function clearProp(prop: PropId) {
    if (prop === "blue") {
      blueHistory = [];
      prevBluePos = null;
      lastBlueUpdate = 0;
    } else {
      redHistory = [];
      prevRedPos = null;
      lastRedUpdate = 0;
    }
  }

  /**
   * Check if there's enough history for effects
   * @param prop - Which prop to check
   * @param minPoints - Minimum points needed (default: 2)
   */
  function hasEnoughHistory(prop: PropId, minPoints = 2): boolean {
    const history = prop === "blue" ? blueHistory : redHistory;
    return history.length >= minPoints;
  }

  return {
    // Reactive state
    get blueHistory() {
      return bluePositionHistory;
    },
    get redHistory() {
      return redPositionHistory;
    },
    get blueVelocity() {
      return blueVelocity;
    },
    get redVelocity() {
      return redVelocity;
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
