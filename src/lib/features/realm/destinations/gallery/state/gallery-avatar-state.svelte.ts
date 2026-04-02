/**
 * Gallery Avatar State
 *
 * Adapter that implements AvatarState interface for the gallery.
 * Connects UnifiedCameraController to gallery's player position tracking.
 */

import type { AvatarState } from "$lib/shared/3d/camera/types";
import type { GalleryState } from "./gallery-state.svelte";

/**
 * Creates an AvatarState that syncs with GalleryState
 */
export function createGalleryAvatarState(galleryState: GalleryState): AvatarState {
	// Movement state
	let moveInput = $state({ x: 0, z: 0 });
	let facingAngle = $state(0);
	let targetFacingAngle = $state(0);
	let isMoving = $state(false);

	// Movement speed (units per second)
	const MOVE_SPEED = 5;
	const ROTATION_SPEED = 12;

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

		get moveDirection() {
			return moveInput;
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
			targetFacingAngle = angle;
		},

		snapFacingAngle(angle: number) {
			facingAngle = angle;
			targetFacingAngle = angle;
		},

		updateLocomotion(delta: number) {
			let diff = targetFacingAngle - facingAngle;
			while (diff > Math.PI) diff -= 2 * Math.PI;
			while (diff < -Math.PI) diff += 2 * Math.PI;
			if (Math.abs(diff) < 0.01) {
				facingAngle = targetFacingAngle;
			} else {
				const maxStep = ROTATION_SPEED * delta;
				facingAngle += Math.sign(diff) * Math.min(Math.abs(diff), maxStep);
			}
		},
	};
}

export type GalleryAvatarState = ReturnType<typeof createGalleryAvatarState>;
