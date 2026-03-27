/**
 * ICameraMovementController
 *
 * Framework-agnostic interface for camera and movement control.
 * Can be used by Threlte components, raw Three.js, or ECS systems.
 *
 * Handles:
 * - Camera mode (Orbit/Third Person/First Person)
 * - Movement input (WASD)
 * - Look input (mouse/touch)
 * - Physics integration (optional)
 * - Mode cycling (V key)
 * - Pointer lock state
 */

import type { PerspectiveCamera } from "three";
import type { CameraMode, PhysicsProvider, Vector3 } from "../../types";

/**
 * Movement input state
 */
export interface MovementInput {
	forward: boolean;
	backward: boolean;
	left: boolean;
	right: boolean;
	sprint: boolean;
	crouch: boolean;
	jump: boolean;
}

/**
 * Look input (from mouse movement, touch, or gamepad)
 */
export interface LookInput {
	deltaYaw: number; // Horizontal rotation delta (radians)
	deltaPitch: number; // Vertical rotation delta (radians)
}

/**
 * Camera state for external consumers
 */
export interface CameraState {
	mode: CameraMode;
	yaw: number;
	pitch: number;
	isPointerLocked: boolean;
	position: Vector3;
}

/**
 * Configuration for camera movement controller
 */
export interface CameraMovementConfig {
	/** Destination ID for preference persistence */
	destinationId: string;
	/** Movement speed (units per second) */
	moveSpeed?: number;
	/** Sprint multiplier */
	sprintMultiplier?: number;
	/** Crouch speed multiplier */
	crouchMultiplier?: number;
	/** Jump force (vertical velocity) */
	jumpForce?: number;
	/** Gravity (units per second squared) */
	gravity?: number;
	/** Look sensitivity */
	lookSensitivity?: number;
	/** Third person camera distance */
	thirdPersonDistance?: number;
	/** Third person camera height offset */
	thirdPersonHeight?: number;
	/** First person eye height */
	firstPersonHeight?: number;
	/** Orbit camera settings */
	orbitMinDistance?: number;
	orbitMaxDistance?: number;
}

/**
 * ICameraMovementController
 *
 * Pure logic controller for camera and movement.
 * Framework-agnostic - works with any renderer.
 */
export interface ICameraMovementController {
	/**
	 * Initialize the controller with a camera
	 */
	init(camera: PerspectiveCamera): void;

	/**
	 * Dispose of the controller and clean up resources
	 */
	dispose(): void;

	/**
	 * Set physics provider for physics-based movement
	 * If null, uses kinematic movement
	 */
	setPhysicsProvider(provider: PhysicsProvider | null): void;

	/**
	 * Update movement and camera position
	 * Call this every frame with delta time
	 */
	update(
		deltaTime: number,
		movementInput: MovementInput,
		lookInput: LookInput
	): void;

	/**
	 * Get current camera state
	 */
	getState(): CameraState;

	/**
	 * Get current camera mode
	 */
	getMode(): CameraMode;

	/**
	 * Set camera mode directly
	 */
	setMode(mode: CameraMode): void;

	/**
	 * Cycle to next camera mode (Orbit → Third → First → Orbit)
	 */
	cycleMode(): CameraMode;

	/**
	 * Return to Orbit mode (used when ESC is pressed or pointer lock lost)
	 */
	returnToOrbit(): void;

	/**
	 * Set pointer lock state
	 */
	setPointerLocked(locked: boolean): void;

	/**
	 * Check if pointer is locked
	 */
	isPointerLocked(): boolean;

	/**
	 * Set target position (for orbit/third person modes)
	 */
	setTargetPosition(position: Vector3): void;

	/**
	 * Teleport the camera/player to a position
	 */
	teleport(position: Vector3): void;

	/**
	 * Get player position (from physics or kinematic state)
	 */
	getPlayerPosition(): Vector3;
}
