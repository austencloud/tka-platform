/**
 * AnimationParameters
 *
 * Utilities for working with animation parameters.
 * Helps bridge movement state to animation systems.
 */

import type { AnimationParameters } from "./contracts/IMovementController";

/**
 * Blend weights for locomotion animations
 */
export interface LocomotionBlend {
	/** Idle animation weight (0-1) */
	idle: number;
	/** Walk animation weight (0-1) */
	walk: number;
	/** Run animation weight (0-1) */
	run: number;
	/** Jump animation weight (0-1) */
	jump: number;
	/** Fall animation weight (0-1) */
	fall: number;
}

/**
 * Configuration for animation blending
 */
export interface AnimationBlendConfig {
	/** Speed threshold for walk (below = idle) */
	walkThreshold: number;
	/** Speed threshold for run (above = run) */
	runThreshold: number;
	/** Vertical velocity for jump (above = jump) */
	jumpThreshold: number;
	/** Vertical velocity for fall (below = fall) */
	fallThreshold: number;
}

const DEFAULT_BLEND_CONFIG: AnimationBlendConfig = {
	walkThreshold: 0.1,
	runThreshold: 4,
	jumpThreshold: 2,
	fallThreshold: -2,
};

/**
 * Calculate animation blend weights from parameters
 */
export function calculateLocomotionBlend(
	params: AnimationParameters,
	config: AnimationBlendConfig = DEFAULT_BLEND_CONFIG
): LocomotionBlend {
	const blend: LocomotionBlend = {
		idle: 0,
		walk: 0,
		run: 0,
		jump: 0,
		fall: 0,
	};

	// Airborne animations take priority
	if (!params.isGrounded) {
		const vy = params.verticalVelocity ?? 0;
		if (vy > config.jumpThreshold) {
			blend.jump = 1;
		} else if (vy < config.fallThreshold) {
			blend.fall = 1;
		} else {
			// Transition zone - blend between jump and fall
			const t = (vy - config.fallThreshold) / (config.jumpThreshold - config.fallThreshold);
			blend.jump = t;
			blend.fall = 1 - t;
		}
		return blend;
	}

	// Grounded locomotion
	if (params.speed < config.walkThreshold) {
		blend.idle = 1;
	} else if (params.speed < config.runThreshold) {
		// Blend idle to walk
		const t = (params.speed - config.walkThreshold) / (config.runThreshold - config.walkThreshold);
		blend.idle = 1 - t;
		blend.walk = t;
	} else if (params.isRunning) {
		blend.run = 1;
	} else {
		blend.walk = 1;
	}

	return blend;
}

/**
 * Get animation playback speed multiplier based on movement speed
 */
export function getAnimationSpeedMultiplier(
	params: AnimationParameters,
	walkAnimSpeed: number = 1.5, // Speed the walk animation was created for
	runAnimSpeed: number = 5 // Speed the run animation was created for
): number {
	if (!params.isMoving || !params.isGrounded) {
		return 1;
	}

	const baseSpeed = params.isRunning ? runAnimSpeed : walkAnimSpeed;
	return params.speed / baseSpeed;
}

/**
 * Smooth animation parameter changes to prevent popping
 */
export function smoothAnimationParameters(
	current: AnimationParameters,
	target: AnimationParameters,
	deltaTime: number,
	smoothTime: number = 0.1
): AnimationParameters {
	const factor = 1 - Math.pow(1 - 1 / (smoothTime * 60), deltaTime * 60);

	return {
		speed: lerp(current.speed, target.speed, factor),
		direction: lerpAngle(current.direction, target.direction, factor),
		isRunning: target.isRunning,
		isGrounded: target.isGrounded,
		isMoving: target.isMoving,
		verticalVelocity: lerp(
			current.verticalVelocity ?? 0,
			target.verticalVelocity ?? 0,
			factor
		),
	};
}

// Helper functions
function lerp(a: number, b: number, t: number): number {
	return a + (b - a) * t;
}

function lerpAngle(a: number, b: number, t: number): number {
	// Handle angle wrapping
	let diff = b - a;
	while (diff > Math.PI) diff -= Math.PI * 2;
	while (diff < -Math.PI) diff += Math.PI * 2;
	return a + diff * t;
}
