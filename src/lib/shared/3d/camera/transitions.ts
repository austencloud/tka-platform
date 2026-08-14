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
 * Shared wall-clock timing for an interruptible 3D layout transition.
 * Consumers may keep their own coordinate-specific endpoints, but they sample
 * this exact clock so the camera and scene subjects arrive together.
 */
export interface TimedTransition {
	id: number;
	startTimeMs: number;
	durationMs: number;
}

export interface HermiteSample {
	value: number;
	/** Value units per millisecond. */
	velocity: number;
	progress: number;
	done: boolean;
}

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

/**
 * Sample a cubic Hermite segment with a carried start velocity and a resting
 * endpoint. Retargeting can therefore continue at the velocity visible in the
 * previous frame instead of restarting from zero and producing a hitch.
 */
export function sampleInterruptibleHermite(
	start: number,
	end: number,
	startVelocity: number,
	timing: TimedTransition,
	nowMs: number
): HermiteSample {
	const durationMs = Math.max(1, timing.durationMs);
	const progress = clamp((nowMs - timing.startTimeMs) / durationMs, 0, 1);
	const t2 = progress * progress;
	const t3 = t2 * progress;
	const tangent = startVelocity * durationMs;

	const h00 = 2 * t3 - 3 * t2 + 1;
	const h10 = t3 - 2 * t2 + progress;
	const h01 = -2 * t3 + 3 * t2;

	const dh00 = 6 * t2 - 6 * progress;
	const dh10 = 3 * t2 - 4 * progress + 1;
	const dh01 = -6 * t2 + 6 * progress;

	return {
		value: h00 * start + h10 * tangent + h01 * end,
		velocity: (dh00 * start + dh10 * tangent + dh01 * end) / durationMs,
		progress,
		done: progress >= 1,
	};
}

export function sampleInterruptibleVector3(
	start: Vector3,
	end: Vector3,
	startVelocity: Vector3,
	timing: TimedTransition,
	nowMs: number
): { value: Vector3; velocity: Vector3; progress: number; done: boolean } {
	const x = sampleInterruptibleHermite(start.x, end.x, startVelocity.x, timing, nowMs);
	const y = sampleInterruptibleHermite(start.y, end.y, startVelocity.y, timing, nowMs);
	const z = sampleInterruptibleHermite(start.z, end.z, startVelocity.z, timing, nowMs);

	return {
		value: { x: x.value, y: y.value, z: z.value },
		velocity: { x: x.velocity, y: y.velocity, z: z.velocity },
		progress: x.progress,
		done: x.done,
	};
}

/** Sample an angle along its shortest wrapped path. */
export function sampleInterruptibleAngle(
	start: number,
	end: number,
	startVelocity: number,
	timing: TimedTransition,
	nowMs: number
): HermiteSample {
	const unwrappedEnd = start + normalizeAngle(end - start);
	const sample = sampleInterruptibleHermite(
		start,
		unwrappedEnd,
		startVelocity,
		timing,
		nowMs
	);
	return { ...sample, value: normalizeAngle(sample.value) };
}
