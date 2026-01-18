/**
 * IPhysicsAdapter
 *
 * Interface for physics adapters.
 * Allows different physics implementations to be swapped:
 * - KinematicAdapter: No physics, direct position control
 * - RaycastAdapter: Three.js raycasting for ground detection
 * - RapierAdapter: Full Rapier physics simulation
 */

import type { Vector3 } from "three";

export interface IPhysicsAdapter {
	/**
	 * Apply velocity to the physics body.
	 * Returns the actual position after physics simulation.
	 *
	 * @param velocity - Desired velocity in world space
	 * @param deltaTime - Time since last frame in seconds
	 * @returns New position after physics
	 */
	move(velocity: Vector3, deltaTime: number): Vector3;

	/**
	 * Apply a jump impulse.
	 *
	 * @param force - Jump force/velocity
	 */
	jump(force: number): void;

	/**
	 * Check if the physics body is on the ground.
	 */
	isGrounded(): boolean;

	/**
	 * Get current position.
	 */
	getPosition(): Vector3;

	/**
	 * Set position directly (teleport).
	 */
	setPosition(position: Vector3): void;

	/**
	 * Get current velocity.
	 */
	getVelocity(): Vector3;

	/**
	 * Clean up physics resources.
	 */
	dispose(): void;
}

/**
 * Configuration for physics adapters
 */
export interface PhysicsAdapterConfig {
	/** Gravity acceleration (units per second squared) */
	gravity?: number;
	/** Player height for ground check */
	playerHeight?: number;
	/** Player radius for collision */
	playerRadius?: number;
	/** Ground check distance */
	groundCheckDistance?: number;
}

export const DEFAULT_PHYSICS_CONFIG: Required<PhysicsAdapterConfig> = {
	gravity: 20,
	playerHeight: 1.8,
	playerRadius: 0.4,
	groundCheckDistance: 0.1,
};
