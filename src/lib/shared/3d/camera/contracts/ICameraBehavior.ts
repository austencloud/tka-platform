/**
 * ICameraBehavior
 *
 * Interface for composable camera behaviors.
 * Behaviors are applied in priority order (lower first, higher last).
 *
 * Design principles:
 * - Behaviors are pure transformations of CameraState
 * - No side effects (don't modify Three.js camera directly)
 * - Composable via priority ordering
 */

import type { Vector3 } from "three";

/**
 * Camera rotation in Euler angles
 */
export interface CameraRotation {
	/** Horizontal rotation in radians (0 = forward, positive = right) */
	yaw: number;
	/** Vertical rotation in radians (0 = level, positive = looking up) */
	pitch: number;
}

/**
 * Complete camera state
 */
export interface CameraState {
	/** Camera position in world space */
	position: Vector3;
	/** Camera rotation */
	rotation: CameraRotation;
	/** Optional target to follow (for third-person modes) */
	target?: Vector3;
	/** Distance from target (for orbit modes) */
	distance?: number;
	/** Field of view in degrees */
	fov?: number;
}

/**
 * Input for camera behaviors
 */
export interface CameraBehaviorInput {
	/** Look delta from input provider */
	lookDelta: { yaw: number; pitch: number };
	/** Time since last frame in seconds */
	deltaTime: number;
	/** Current camera distance (for distance-scaled sensitivity) */
	currentDistance?: number;
}

/**
 * Composable camera behavior
 */
export interface ICameraBehavior {
	/**
	 * Priority determines application order.
	 * Lower priority = applied first
	 * Higher priority = applied last (good for damping, constraints)
	 */
	readonly priority: number;

	/**
	 * Apply this behavior to the camera state.
	 * Returns a new state (should not mutate input).
	 */
	apply(state: CameraState, input: CameraBehaviorInput): CameraState;

	/**
	 * Optional: Reset any internal state (e.g., smoothing accumulators)
	 */
	reset?(): void;
}
