/**
 * Camera Sensitivity Utilities
 *
 * Distance-scaled sensitivity ensures consistent feel regardless of zoom level.
 * When zoomed in (close), small movements have big effect.
 * When zoomed out (far), same movement has proportionally smaller effect.
 */

/**
 * Calculate sensitivity multiplier based on camera distance.
 *
 * @param currentDistance - Current distance from target
 * @param referenceDistance - The "normal" distance where sensitivity = 1
 * @param minMultiplier - Minimum sensitivity (prevents too slow when close)
 * @param maxMultiplier - Maximum sensitivity (prevents too fast when far)
 */
export function getDistanceScaledSensitivity(
	currentDistance: number,
	referenceDistance: number = 5,
	minMultiplier: number = 0.3,
	maxMultiplier: number = 2.0
): number {
	if (referenceDistance <= 0) return 1;

	const ratio = currentDistance / referenceDistance;
	return Math.max(minMultiplier, Math.min(maxMultiplier, ratio));
}

/**
 * Linear interpolation
 */
export function lerp(a: number, b: number, t: number): number {
	return a + (b - a) * t;
}

/**
 * Clamp value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}

/**
 * Smooth damping factor that's frame-rate independent.
 * Returns a lerp factor to use each frame.
 *
 * @param smoothTime - Approximate time to reach target (seconds)
 * @param deltaTime - Time since last frame (seconds)
 */
export function smoothDampFactor(smoothTime: number, deltaTime: number): number {
	// This formula gives frame-rate independent smoothing
	// At 60fps with smoothTime=0.1, this returns ~0.15 per frame
	return 1 - Math.pow(1 - 1 / (smoothTime * 60), deltaTime * 60);
}
