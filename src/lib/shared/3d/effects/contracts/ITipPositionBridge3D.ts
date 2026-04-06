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
 * Converts PropState3D into per-tip rig-local positions with velocity and
 * jerk, computed via finite differencing between frames. Every 3D effect
 * (trails, LED, charcoal, fire) consumes this bridge to know where the prop
 * tips are in rig-local space.
 *
 * The bridge receives a rig-local center position (handAnchorPos + propState.worldPosition)
 * instead of reading from scene graph refs. This allows effects to render inside the
 * rig hierarchy without double-applying the rig's transform.
 */
export interface ITipPositionBridge3D {
	update(
		propIndex: number,
		propState: PropState3DLike,
		rigLocalCenter: { x: number; y: number; z: number },
		staffHalfLength: number,
		deltaTime: number,
	): PropTipPositions3D;

	reset(): void;
}
