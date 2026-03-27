/**
 * Gallery Avatar State
 *
 * Adapter that implements AvatarState interface for the gallery.
 * Connects UnifiedCameraController to gallery's player position tracking.
 */

import type { AvatarState } from "$lib/shared/3d-animation/camera/types";
import type { GalleryState } from "./gallery-state.svelte";

/**
 * Creates an AvatarState that syncs with GalleryState
 */
export function createGalleryAvatarState(galleryState: GalleryState): AvatarState {
	// Movement state
	let moveInput = $state({ x: 0, z: 0 });
	let facingAngle = $state(0);
	let isMoving = $state(false);

	// Movement speed (units per second)
	const MOVE_SPEED = 5;

	return {
		get position() {
			return galleryState.playerPosition;
		},

		get facingAngle() {
			return facingAngle;
		},

		get isMoving() {
			return isMoving;
		},

		setMoveInput(input: { x: number; z: number }) {
			moveInput = input;
			isMoving = input.x !== 0 || input.z !== 0;
		},

		updateMovement(delta: number, cameraAngle: number) {
			if (!isMoving) return;

			// Calculate movement direction based on camera angle
			const cos = Math.cos(cameraAngle);
			const sin = Math.sin(cameraAngle);

			// Transform input to world space
			const worldX = moveInput.x * cos - moveInput.z * sin;
			const worldZ = moveInput.x * sin + moveInput.z * cos;

			// Apply movement
			const currentPos = galleryState.playerPosition;
			galleryState.setPlayerPosition({
				x: currentPos.x + worldX * MOVE_SPEED * delta,
				y: currentPos.y,
				z: currentPos.z + worldZ * MOVE_SPEED * delta,
			});

			// Update facing angle to match movement direction
			if (moveInput.x !== 0 || moveInput.z !== 0) {
				facingAngle = cameraAngle + Math.atan2(moveInput.x, moveInput.z);
			}
		},

		setFacingAngle(angle: number) {
			facingAngle = angle;
		},
	};
}

export type GalleryAvatarState = ReturnType<typeof createGalleryAvatarState>;
