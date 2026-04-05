import type { PropTipPositions3D } from "../types";

/**
 * Minimal prop state needed to compute tip positions.
 * Mirrors the relevant fields from PropState3D without importing the full type,
 * keeping this interface decoupled from the animation system.
 */
export interface PropState3DLike {
	worldPosition: { x: number; y: number; z: number };
	worldRotation: { x: number; y: number; z: number; w: number };
	staffRotationAngle: number;
	plane: string;
	centerPathAngle: number;
}

/**
 * Converts PropState3D into per-tip world-space positions with velocity and
 * jerk, computed via finite differencing between frames. Every 3D effect
 * (trails, LED, charcoal, fire) consumes this bridge to know where the prop
 * tips are in 3D space.
 */
export interface SceneTransforms {
	avatarPosition: { x: number; y: number; z: number };
	facingAngle: number;
	gridOffset: number;
}

export interface ITipPositionBridge3D {
	update(
		propIndex: number,
		propState: PropState3DLike,
		staffHalfLength: number,
		deltaTime: number,
		sceneTransforms?: SceneTransforms,
	): PropTipPositions3D;

	reset(): void;
}
