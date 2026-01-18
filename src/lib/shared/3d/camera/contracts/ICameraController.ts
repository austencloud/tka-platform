/**
 * ICameraController
 *
 * Interface for the main camera controller that orchestrates behaviors.
 */

import type { Camera } from "three";
import type { ICameraBehavior, CameraState } from "./ICameraBehavior";

export interface ICameraController {
	/**
	 * Add a behavior to the controller.
	 * Behaviors are sorted by priority automatically.
	 */
	addBehavior(behavior: ICameraBehavior): void;

	/**
	 * Remove a behavior from the controller.
	 */
	removeBehavior(behavior: ICameraBehavior): void;

	/**
	 * Update the camera state by applying all behaviors.
	 * Call this each frame with look delta from input provider.
	 */
	update(deltaTime: number, lookDelta: { yaw: number; pitch: number }): void;

	/**
	 * Apply current state to a Three.js camera.
	 */
	applyToCamera(camera: Camera): void;

	/**
	 * Get current camera state (read-only).
	 */
	getState(): Readonly<CameraState>;

	/**
	 * Get current yaw (useful for movement direction).
	 */
	getYaw(): number;

	/**
	 * Set the follow target (for third-person modes).
	 */
	setTarget(target: { x: number; y: number; z: number } | null): void;

	/**
	 * Reset all behaviors and state.
	 */
	reset(): void;
}
