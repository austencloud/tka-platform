/**
 * Player Physics Controller - Shared player movement with Rapier
 *
 * Uses Rapier's KinematicCharacterController for smooth, physics-based movement.
 * Handles ground detection, slope climbing, stepping, and collision response.
 *
 * Used by: Gallery, Infinite Worlds, and future 3D destinations
 */

import type {
	PhysicsWorldState,
	PlayerControllerConfig,
	PlayerControllerState,
} from "./types";
import { DEFAULT_PLAYER_CONFIG } from "./types";
import { castRay } from "./rapier-world";
import { SCALE } from "@austencloud/scene-3d";

// ============================================================================
// PLAYER CONTROLLER CREATION
// ============================================================================

/**
 * Create the player physics controller
 */
export function createPlayerController(
	physicsState: PhysicsWorldState,
	config: Partial<PlayerControllerConfig> = {},
): PlayerControllerState {
	const cfg = { ...DEFAULT_PLAYER_CONFIG, ...config };

	const state: PlayerControllerState = {
		rigidBody: null,
		collider: null,
		controller: null,
		isGrounded: false,
		groundNormal: { x: 0, y: 1, z: 0 },
		velocity: { x: 0, y: 0, z: 0 },
		noclipEnabled: false,
	};

	if (!physicsState.rapier || !physicsState.world) {
		console.warn("[PlayerController] Physics not initialized");
		return state;
	}

	const RAPIER = physicsState.rapier;
	const world = physicsState.world;

	// Create kinematic rigid body for the player
	const rigidBodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
		cfg.position.x,
		cfg.position.y,
		cfg.position.z,
	);

	state.rigidBody = world.createRigidBody(rigidBodyDesc);

	// Create capsule collider
	const colliderDesc = RAPIER.ColliderDesc.capsule(cfg.halfHeight, cfg.radius)
		.setFriction(0.0) // Character controller handles friction
		.setRestitution(0.0);

	state.collider = world.createCollider(colliderDesc, state.rigidBody);

	// Create the character controller
	state.controller = world.createCharacterController(cfg.offset);

	// Configure the controller
	state.controller.setSlideEnabled(true);
	state.controller.setMaxSlopeClimbAngle(cfg.maxSlopeClimbAngle);
	state.controller.setMinSlopeSlideAngle(cfg.minSlopeSlideAngle);
	state.controller.enableAutostep(
		cfg.autoStepMaxHeight,
		cfg.autoStepMinWidth,
		true, // Include dynamic bodies
	);
	state.controller.enableSnapToGround(cfg.snapToGroundDistance);
	state.controller.setApplyImpulsesToDynamicBodies(true);


	return state;
}

// ============================================================================
// MOVEMENT
// ============================================================================

/**
 * Move the player using the character controller
 */
export function movePlayer(
	physicsState: PhysicsWorldState,
	playerState: PlayerControllerState,
	desiredMovement: { x: number; y: number; z: number },
	deltaTime: number,
): void {
	if (!playerState.rigidBody) {
		return;
	}

	// Noclip mode: bypass collision detection entirely
	if (playerState.noclipEnabled) {
		const currentPos = playerState.rigidBody.translation();
		playerState.rigidBody.setNextKinematicTranslation({
			x: currentPos.x + desiredMovement.x,
			y: currentPos.y + desiredMovement.y,
			z: currentPos.z + desiredMovement.z,
		});

		// In noclip, we're never grounded
		playerState.isGrounded = false;

		// Store velocity
		if (deltaTime > 0) {
			playerState.velocity = {
				x: desiredMovement.x / deltaTime,
				y: desiredMovement.y / deltaTime,
				z: desiredMovement.z / deltaTime,
			};
		}
		return;
	}

	// Normal mode: use character controller for collision detection
	if (
		!physicsState.world ||
		!playerState.controller ||
		!playerState.collider
	) {
		return;
	}

	// Compute the movement with collision detection
	playerState.controller.computeColliderMovement(
		playerState.collider,
		{ x: desiredMovement.x, y: desiredMovement.y, z: desiredMovement.z },
		undefined, // Filter flags
		undefined, // Filter groups
	);

	// Get the corrected movement (after collision response)
	const correctedMovement = playerState.controller.computedMovement();

	// Get current position
	const currentPos = playerState.rigidBody.translation();

	// Apply the movement
	playerState.rigidBody.setNextKinematicTranslation({
		x: currentPos.x + correctedMovement.x,
		y: currentPos.y + correctedMovement.y,
		z: currentPos.z + correctedMovement.z,
	});

	// Check if grounded
	playerState.isGrounded = playerState.controller.computedGrounded();

	// Get ground normal if grounded
	// Note: Rapier doesn't directly expose ground normal, so we estimate
	if (playerState.isGrounded) {
		// Simple approximation - assume flat ground
		// For slopes, we'd need to raycast down
		playerState.groundNormal = { x: 0, y: 1, z: 0 };
	}

	// Store velocity for next frame calculations
	if (deltaTime > 0) {
		playerState.velocity = {
			x: correctedMovement.x / deltaTime,
			y: correctedMovement.y / deltaTime,
			z: correctedMovement.z / deltaTime,
		};
	}
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Get the player's current position
 */
export function getPlayerPosition(
	playerState: PlayerControllerState,
): { x: number; y: number; z: number } | null {
	if (!playerState.rigidBody) return null;

	const pos = playerState.rigidBody.translation();
	return { x: pos.x, y: pos.y, z: pos.z };
}

/**
 * Teleport the player to a new position
 */
export function teleportPlayer(
	playerState: PlayerControllerState,
	position: { x: number; y: number; z: number },
): void {
	if (!playerState.rigidBody) return;

	playerState.rigidBody.setTranslation(position, true);
	playerState.velocity = { x: 0, y: 0, z: 0 };
}

/**
 * Get the player's velocity
 */
export function getPlayerVelocity(
	playerState: PlayerControllerState,
): { x: number; y: number; z: number } {
	return playerState.velocity;
}

/**
 * Check if the player is grounded
 */
export function isPlayerGrounded(playerState: PlayerControllerState): boolean {
	return playerState.isGrounded;
}

/**
 * Toggle noclip mode (fly through terrain, no gravity)
 */
export function toggleNoclip(playerState: PlayerControllerState): boolean {
	playerState.noclipEnabled = !playerState.noclipEnabled;
	// Reset velocity when toggling to prevent momentum carryover
	playerState.velocity = { x: 0, y: 0, z: 0 };
	return playerState.noclipEnabled;
}

/**
 * Set noclip mode explicitly
 */
export function setNoclip(playerState: PlayerControllerState, enabled: boolean): void {
	playerState.noclipEnabled = enabled;
	if (!enabled) {
		// Reset velocity when disabling to prevent momentum carryover
		playerState.velocity = { x: 0, y: 0, z: 0 };
	}
}

// ============================================================================
// CROUCH COLLIDER
// ============================================================================

/**
 * Resize the player capsule between standing and crouching heights.
 *
 * Uses Rapier's setHalfHeight() to mutate the existing collider in place -
 * no destroy/recreate overhead. The rigid body is repositioned so the capsule
 * bottom (feet) stays at the same world Y. When un-crouching, the body is
 * pushed up by the height difference so it doesn't clip into the floor.
 */
export function setCrouch(
	physicsState: PhysicsWorldState,
	playerState: PlayerControllerState,
	crouching: boolean,
): void {
	if (!playerState.rigidBody || !playerState.collider) return;

	const standHalf = DEFAULT_PLAYER_CONFIG.halfHeight;
	const crouchHalf = SCALE.CROUCH_HALF_HEIGHT;
	const radius = DEFAULT_PLAYER_CONFIG.radius;
	const targetHalf = crouching ? crouchHalf : standHalf;

	// Only resize if the half-height actually changed
	const currentHalf = playerState.collider.halfHeight();
	if (Math.abs(currentHalf - targetHalf) < 0.01) return;

	// Keep feet planted: adjust body Y by the height difference
	const pos = playerState.rigidBody.translation();
	const oldBottom = pos.y - (currentHalf + radius);
	const newY = oldBottom + targetHalf + radius;

	// Mutate collider shape in place (no alloc, no remove/create)
	playerState.collider.setHalfHeight(targetHalf);

	// Reposition so feet stay grounded
	playerState.rigidBody.setTranslation({ x: pos.x, y: newY, z: pos.z }, true);
}

// ============================================================================
// GROUND SNAPPING
// ============================================================================

/**
 * Raycast down to find ground and teleport player to stand on it.
 * Call after terrain colliders exist to ensure correct positioning.
 *
 * @param physicsState - The physics world state
 * @param playerState - The player controller state
 * @param searchHeight - Height to cast ray from (default: 100m)
 * @returns true if ground was found and player was snapped
 */
export function snapToGround(
	physicsState: PhysicsWorldState,
	playerState: PlayerControllerState,
	searchHeight: number = 100,
): boolean {
	if (!playerState.rigidBody || !playerState.collider) return false;

	const pos = playerState.rigidBody.translation();
	const capsuleHeight = DEFAULT_PLAYER_CONFIG.halfHeight + DEFAULT_PLAYER_CONFIG.radius;

	// Cast ray from high above current XZ position, excluding player's own collider
	const rayStart = { x: pos.x, y: searchHeight, z: pos.z };
	const result = castRay(
		physicsState,
		rayStart,
		{ x: 0, y: -1, z: 0 },
		searchHeight * 2,
		playerState.collider, // Exclude player's collider from raycast
	);

	if (result) {
		// Position capsule so bottom touches ground + small margin
		const groundY = result.point.y;
		const targetY = groundY + capsuleHeight + 0.05;
		teleportPlayer(playerState, { x: pos.x, y: targetY, z: pos.z });
		return true;
	}
	return false;
}

// ============================================================================
// CLEANUP
// ============================================================================

/**
 * Dispose the player controller
 *
 * Uses try-catch to handle HMR scenarios where Rapier's WASM objects
 * may already be freed before this cleanup runs.
 */
export function disposePlayerController(
	physicsState: PhysicsWorldState,
	playerState: PlayerControllerState,
): void {
	try {
		if (physicsState.world) {
			if (playerState.controller) {
				physicsState.world.removeCharacterController(playerState.controller);
			}
			if (playerState.rigidBody) {
				physicsState.world.removeRigidBody(playerState.rigidBody);
			}
		}
	} catch (e) {
		// Rapier WASM objects may already be freed during HMR - this is expected
		if (import.meta.hot) {
			console.debug('[PlayerController] Rapier cleanup during HMR:', e);
		}
	}

	playerState.rigidBody = null;
	playerState.collider = null;
	playerState.controller = null;
}
