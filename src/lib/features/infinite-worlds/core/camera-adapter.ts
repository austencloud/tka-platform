/**
 * Camera Adapter for Infinite Worlds ECS
 *
 * Bridges the unified CameraMovementController to the ECS system.
 * Translates between ECS entity state and the controller.
 */

import type { PerspectiveCamera } from "three";
import { CameraMovementController } from "$lib/shared/3d-core/camera/services/implementations/CameraMovementController";
import type {
	MovementInput,
	LookInput,
} from "$lib/shared/3d-core/camera/services/contracts/ICameraMovementController";
import type { PhysicsProvider } from "$lib/shared/3d-core/camera/types";
import { CameraMode } from "$lib/shared/3d-core/camera/types";
import { cameraPreferences } from "$lib/shared/3d-core/camera/camera-preferences.svelte";
import type { Entity } from "./ecs-world";

let controller: CameraMovementController | null = null;

/**
 * Initialize the camera controller for Infinite Worlds
 */
export function initCameraController(camera: PerspectiveCamera): void {
	controller = new CameraMovementController({
		destinationId: "worlds",
		moveSpeed: 5,
		sprintMultiplier: 2,
		jumpForce: 8,
		gravity: 20,
		thirdPersonDistance: 8,
		thirdPersonHeight: 3,
		firstPersonHeight: 1.7,
	});
	controller.init(camera);

	// Load saved camera mode preference
	const savedMode = cameraPreferences.getModeForDestination("worlds");
	if (savedMode) {
		controller.setMode(savedMode);
	}
}

/**
 * Dispose of the camera controller
 */
export function disposeCameraController(): void {
	controller?.dispose();
	controller = null;
}

/**
 * Set physics provider for physics-based movement
 */
export function setCameraPhysicsProvider(provider: PhysicsProvider | null): void {
	controller?.setPhysicsProvider(provider);
}

/**
 * Update camera from ECS entity state
 * Called every frame from the ECS camera system
 */
export function updateCameraFromEntity(
	deltaTime: number,
	entity: Entity,
	lookDelta: { yaw: number; pitch: number }
): void {
	if (!controller || !entity.input || !entity.camera) return;

	// Build movement input from entity
	const movementInput: MovementInput = {
		forward: entity.input.moveForward,
		backward: entity.input.moveBackward,
		left: entity.input.moveLeft,
		right: entity.input.moveRight,
		sprint: entity.input.sprint,
		crouch: entity.input.crouch,
		jump: entity.input.jump,
	};

	// Build look input
	const lookInput: LookInput = {
		deltaYaw: lookDelta.yaw,
		deltaPitch: lookDelta.pitch,
	};

	// Update controller
	controller.update(deltaTime, movementInput, lookInput);

	// Sync controller state back to entity
	const state = controller.getState();
	entity.camera.yaw = state.yaw;
	entity.camera.pitch = state.pitch;
	entity.camera.mode = state.mode;
}

/**
 * Get the current camera mode
 */
export function getCameraMode(): CameraMode {
	return controller?.getMode() ?? CameraMode.FIRST_PERSON;
}

/**
 * Cycle camera mode (V key)
 */
export function cycleCameraMode(): CameraMode {
	if (!controller) return CameraMode.FIRST_PERSON;

	const newMode = controller.cycleMode();
	cameraPreferences.setModeForDestination("worlds", newMode);
	return newMode;
}

/**
 * Set pointer lock state
 */
export function setPointerLocked(locked: boolean): void {
	controller?.setPointerLocked(locked);
}

/**
 * Check if controller is initialized
 */
export function isCameraControllerReady(): boolean {
	return controller !== null;
}

/**
 * Get player position from controller
 */
export function getControllerPlayerPosition(): { x: number; y: number; z: number } {
	return controller?.getPlayerPosition() ?? { x: 0, y: 0, z: 0 };
}

/**
 * Teleport player to position
 */
export function teleportPlayer(x: number, y: number, z: number): void {
	controller?.teleport({ x, y, z });
}
