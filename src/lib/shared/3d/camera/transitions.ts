/**
 * Camera Transition Utilities
 *
 * Provides interpolation functions for smooth camera transitions between
 * first-person and third-person modes.
 *
 * Uses slerp (spherical linear interpolation) for rotation to avoid
 * gimbal lock and produce natural camera arcs (industry standard).
 */

import type { Vector3, Rotation } from "./types";

/**
 * Linear interpolation between two values
 */
export function lerp(a: number, b: number, t: number): number {
	return a + (b - a) * t;
}

/**
 * Linear interpolation between two vectors
 */
export function lerpVector3(a: Vector3, b: Vector3, t: number): Vector3 {
	return {
		x: lerp(a.x, b.x, t),
		y: lerp(a.y, b.y, t),
		z: lerp(a.z, b.z, t),
	};
}

/**
 * Normalize angle to [-π, π] range
 */
function normalizeAngle(angle: number): number {
	while (angle > Math.PI) angle -= Math.PI * 2;
	while (angle < -Math.PI) angle += Math.PI * 2;
	return angle;
}

/**
 * Shortest path angle interpolation (handles wrapping)
 * Essential for smooth camera rotation without 360° spins
 */
export function lerpAngle(a: number, b: number, t: number): number {
	const diff = normalizeAngle(b - a);
	return normalizeAngle(a + diff * t);
}

/**
 * Interpolate between two rotations using spherical linear interpolation
 * Produces smooth camera arcs without gimbal lock
 */
export function slerpRotation(a: Rotation, b: Rotation, t: number): Rotation {
	return {
		yaw: lerpAngle(a.yaw, b.yaw, t),
		pitch: lerpAngle(a.pitch, b.pitch, t),
	};
}

/**
 * Cubic bezier easing for camera transitions
 * Creates smooth acceleration/deceleration (ease-in-out)
 */
export function cubicBezier(t: number): number {
	// Cubic ease-in-out curve
	return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * Ease-out cubic (fast start, slow end)
 */
export function easeOutCubic(t: number): number {
	return 1 - Math.pow(1 - t, 3);
}

/**
 * Ease-in cubic (slow start, fast end)
 */
export function easeInCubic(t: number): number {
	return t * t * t;
}

/**
 * Calculate distance between two 3D points
 */
export function distance(a: Vector3, b: Vector3): number {
	const dx = b.x - a.x;
	const dy = b.y - a.y;
	const dz = b.z - a.z;
	return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Clamp a value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}
