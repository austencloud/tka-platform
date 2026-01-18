/**
 * Camera Types - Unified camera system for all 3D destinations
 *
 * Three modes available in every 3D context:
 * - ORBIT: View/director mode. Mouse drag rotates around subject. No movement.
 * - THIRD_PERSON: Game mode. Camera behind avatar. WASD moves avatar.
 * - FIRST_PERSON: Game mode. Camera is avatar's eyes. WASD moves avatar.
 *
 * Controls (consistent everywhere):
 * - V: Cycle modes (Orbit → Third → First → Orbit)
 * - Click: Enter pointer lock (for mouse look in game modes)
 * - ESC: Exit pointer lock AND return to Orbit mode
 * - WASD: Move avatar (only in Third/First person modes)
 */

export enum CameraMode {
	ORBIT = "orbit",
	FIRST_PERSON = "first_person",
	THIRD_PERSON = "third_person",
}

/**
 * Cycle to the next camera mode.
 * Order: Orbit → Third Person → First Person → Orbit
 */
export function getNextCameraMode(current: CameraMode): CameraMode {
	switch (current) {
		case CameraMode.ORBIT:
			return CameraMode.THIRD_PERSON;
		case CameraMode.THIRD_PERSON:
			return CameraMode.FIRST_PERSON;
		case CameraMode.FIRST_PERSON:
			return CameraMode.ORBIT;
	}
}

/**
 * Check if a mode allows WASD movement
 */
export function isGameMode(mode: CameraMode): boolean {
	return mode === CameraMode.THIRD_PERSON || mode === CameraMode.FIRST_PERSON;
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
