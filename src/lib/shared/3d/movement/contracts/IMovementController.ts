/**
 * IMovementController
 *
 * Interface for movement calculation.
 * Converts input into velocity vectors.
 */

import type { Vector3 } from "three";

/**
 * Movement input from input provider
 */
export interface MovementInput {
	/** Forward/backward (-1 to 1) */
	forward: number;
	/** Left/right strafe (-1 to 1) */
	strafe: number;
}

/**
 * Movement configuration
 */
export interface MovementConfig {
	/** Walking speed in units per second */
	walkSpeed: number;
	/** Running speed in units per second */
	runSpeed: number;
	/** Jump force/velocity */
	jumpForce: number;
	/** Gravity acceleration */
	gravity?: number;
}

/**
 * Animation parameters derived from movement
 */
export interface AnimationParameters {
	/** Current movement speed */
	speed: number;
	/** Movement direction in radians (relative to camera) */
	direction: number;
	/** Is the character running? */
	isRunning: boolean;
	/** Is the character on the ground? */
	isGrounded: boolean;
	/** Is the character moving? */
	isMoving: boolean;
	/** Vertical velocity (for jump/fall animations) */
	verticalVelocity?: number;
}

export interface IMovementController {
	/**
	 * Calculate velocity from input.
	 *
	 * @param input - Movement input from input provider
	 * @param cameraYaw - Camera horizontal rotation (for camera-relative movement)
	 * @param isSprinting - Whether sprint is held
	 * @returns Velocity vector in world space
	 */
	calculateVelocity(input: MovementInput, cameraYaw: number, isSprinting: boolean): Vector3;

	/**
	 * Get animation parameters from current movement state.
	 */
	getAnimationParameters(
		velocity: Vector3,
		isGrounded: boolean,
		isSprinting: boolean
	): AnimationParameters;

	/**
	 * Get current configuration
	 */
	getConfig(): MovementConfig;

	/**
	 * Update configuration
	 */
	setConfig(config: Partial<MovementConfig>): void;
}
