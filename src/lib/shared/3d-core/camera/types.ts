/**
 * Camera Types - Unified camera system for all 3D destinations
 *
 * Defines camera modes, state, and configuration for switching between
 * first-person and third-person perspectives across all 3D experiences.
 */

export enum CameraMode {
	FIRST_PERSON = "first_person",
	THIRD_PERSON = "third_person",
}

export interface Vector3 {
	x: number;
	y: number;
	z: number;
}

export interface Rotation {
	yaw: number; // Y-axis rotation (radians)
	pitch: number; // X-axis rotation (radians)
}

export interface CameraState {
	mode: CameraMode;
	position: Vector3;
	rotation: Rotation;
	target: Vector3 | null; // For 3rd person follow target

	// Transition state
	isTransitioning: boolean;
	transitionProgress: number; // 0-1
}

export interface CameraConfig {
	// First person
	eyeHeight: number; // 1.7m default
	mouseSensitivity: number; // 0.002 default
	lookAngleLimitDown: number; // Pitch clamp (radians)
	lookAngleLimitUp: number; // Pitch clamp (radians)

	// Third person
	distance: number; // 400 default (from target)
	height: number; // 200 default (above target)
	positionDamping: number; // 0.1 default (smooth following)
	minPitch: number; // -0.2 radians default
	maxPitch: number; // 1.2 radians default

	// Transition
	blendDuration: number; // 0.3s default
	fovTransition: boolean; // Adjust FOV during transition
	fovFirstPerson: number; // 75 default
	fovThirdPerson: number; // 60 default
}

/**
 * Physics Provider Interface
 *
 * Abstracts physics implementation so camera can work with both
 * Rapier physics (Gallery, Worlds) and kinematic movement (Stage)
 */
export interface PhysicsProvider {
	/**
	 * Move the player in the specified direction
	 * @param direction - Normalized movement vector
	 * @param deltaTime - Time since last frame (seconds)
	 */
	movePlayer(direction: Vector3, deltaTime: number): void;

	/**
	 * Get current player position in world space
	 */
	getPlayerPosition(): Vector3;

	/**
	 * Check if player is on the ground (for jump logic)
	 */
	isGrounded(): boolean;

	/**
	 * Get player velocity (for movement state)
	 */
	getVelocity(): Vector3;
}

/**
 * Camera Preset for quick camera positioning
 */
export interface CameraPreset {
	name: string;
	position: Vector3;
	rotation: Rotation;
	fov?: number;
}

/**
 * Default camera configuration values
 */
export const DEFAULT_CAMERA_CONFIG: CameraConfig = {
	// First person
	eyeHeight: 1.7,
	mouseSensitivity: 0.002,
	lookAngleLimitDown: -Math.PI / 2 + 0.1, // Almost straight down
	lookAngleLimitUp: Math.PI / 2 - 0.1, // Almost straight up

	// Third person
	distance: 400,
	height: 200,
	positionDamping: 0.1,
	minPitch: -0.2,
	maxPitch: 1.2,

	// Transition
	blendDuration: 0.3,
	fovTransition: true,
	fovFirstPerson: 75,
	fovThirdPerson: 60,
};
