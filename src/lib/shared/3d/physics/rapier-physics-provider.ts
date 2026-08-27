/**
 * RapierPhysicsProvider
 *
 * Adapter that wraps Rapier's PlayerControllerState to implement
 * the PhysicsProvider interface for UnifiedCameraController.
 *
 * This allows the camera controller to work with Rapier physics
 * in destinations like Infinite Worlds while maintaining compatibility
 * with kinematic movement in destinations like Stage.
 */

import type { PhysicsProvider, Vector3 } from "../camera/types";
import type { PhysicsWorldState, PlayerControllerState } from "./types";
import { movePlayer, getPlayerPosition, teleportPlayer, toggleNoclip, setNoclip, setCrouch } from "./player-controller";

export class RapierPhysicsProvider implements PhysicsProvider {
	constructor(
		private physicsState: PhysicsWorldState,
		private playerState: PlayerControllerState
	) {}

	/**
	 * Move the player with physics-based collision detection
	 */
	movePlayer(desiredMovement: Vector3, deltaTime: number): void {
		movePlayer(this.physicsState, this.playerState, desiredMovement, deltaTime);
	}

	/**
	 * Get current player position in world space
	 */
	getPlayerPosition(): Vector3 {
		const pos = getPlayerPosition(this.playerState);
		return pos ?? { x: 0, y: 0, z: 0 };
	}

	/**
	 * Check if player is on the ground (for jump logic)
	 */
	isGrounded(): boolean {
		return this.playerState.isGrounded;
	}

	getVelocity(): Vector3 {
		return this.playerState.velocity;
	}

	/**
	 * Teleport the player to a position (bypasses physics)
	 */
	teleport(position: Vector3): void {
		teleportPlayer(this.playerState, position);
	}

	/**
	 * Toggle noclip mode (fly through terrain, no gravity)
	 */
	toggleNoclip(): boolean {
		return toggleNoclip(this.playerState);
	}

	/**
	 * Check if noclip mode is enabled
	 */
	isNoclipEnabled(): boolean {
		return this.playerState.noclipEnabled;
	}

	/**
	 * Set noclip mode explicitly
	 */
	setNoclip(enabled: boolean): void {
		setNoclip(this.playerState, enabled);
	}

	/**
	 * Swap the player capsule between standing and crouching heights.
	 * Keeps feet at the same world Y so the transition feels grounded.
	 */
	setCrouch(crouching: boolean): void {
		setCrouch(this.physicsState, this.playerState, crouching);
	}
}

/**
 * Factory function to create a RapierPhysicsProvider
 */
export function createRapierPhysicsProvider(
	physicsState: PhysicsWorldState,
	playerState: PlayerControllerState
): PhysicsProvider {
	return new RapierPhysicsProvider(physicsState, playerState);
}
