/**
 * GalleryPositionSyncer Tests
 *
 * Tests the position interpolation logic used for smooth remote player movement.
 * This is pure math that could have subtle bugs - exactly what should be tested.
 */

import { describe, it, expect } from 'vitest';

// ============================================================================
// Interpolation Functions (extracted for testing)
// ============================================================================

/**
 * Linear interpolation between two values
 */
function lerp(start: number, end: number, t: number): number {
	return start + (end - start) * t;
}

/**
 * Linear interpolation for 3D positions
 */
function lerpPosition(
	start: { x: number; y: number; z: number },
	end: { x: number; y: number; z: number },
	t: number
): { x: number; y: number; z: number } {
	return {
		x: lerp(start.x, end.x, t),
		y: lerp(start.y, end.y, t),
		z: lerp(start.z, end.z, t)
	};
}

/**
 * Spherical linear interpolation for angles (handles wrap-around)
 */
function slerpAngle(start: number, end: number, t: number): number {
	// Normalize angles to [-PI, PI]
	let diff = end - start;

	// Handle wrap-around (e.g., going from 350° to 10°)
	while (diff > Math.PI) diff -= 2 * Math.PI;
	while (diff < -Math.PI) diff += 2 * Math.PI;

	return start + diff * t;
}

/**
 * Clamp a value between min and max
 */
function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}

/**
 * Calculate interpolation factor based on time elapsed
 * Uses exponential smoothing for natural-looking movement
 */
function calculateInterpolationFactor(
	deltaTime: number,
	interpolationSpeed: number = 10
): number {
	// Exponential smoothing: approaches 1 asymptotically
	// At 60fps (deltaTime = 0.0167), with speed 10, factor ≈ 0.154
	return clamp(1 - Math.exp(-interpolationSpeed * deltaTime), 0, 1);
}

// ============================================================================
// Tests
// ============================================================================

describe('GalleryPositionSyncer Interpolation', () => {
	describe('lerp', () => {
		it('should return start value when t=0', () => {
			expect(lerp(0, 100, 0)).toBe(0);
			expect(lerp(-50, 50, 0)).toBe(-50);
		});

		it('should return end value when t=1', () => {
			expect(lerp(0, 100, 1)).toBe(100);
			expect(lerp(-50, 50, 1)).toBe(50);
		});

		it('should return midpoint when t=0.5', () => {
			expect(lerp(0, 100, 0.5)).toBe(50);
			expect(lerp(-100, 100, 0.5)).toBe(0);
		});

		it('should handle negative values correctly', () => {
			expect(lerp(-100, -50, 0.5)).toBe(-75);
		});

		it('should extrapolate beyond t=1', () => {
			expect(lerp(0, 100, 1.5)).toBe(150);
		});

		it('should extrapolate below t=0', () => {
			expect(lerp(0, 100, -0.5)).toBe(-50);
		});
	});

	describe('lerpPosition', () => {
		it('should interpolate all three axes', () => {
			const start = { x: 0, y: 0, z: 0 };
			const end = { x: 100, y: 200, z: 300 };

			const result = lerpPosition(start, end, 0.5);

			expect(result.x).toBe(50);
			expect(result.y).toBe(100);
			expect(result.z).toBe(150);
		});

		it('should handle negative coordinates', () => {
			const start = { x: -100, y: -200, z: -300 };
			const end = { x: 100, y: 200, z: 300 };

			const result = lerpPosition(start, end, 0.5);

			expect(result.x).toBe(0);
			expect(result.y).toBe(0);
			expect(result.z).toBe(0);
		});

		it('should return exact start when t=0', () => {
			const start = { x: 10, y: 20, z: 30 };
			const end = { x: 100, y: 200, z: 300 };

			const result = lerpPosition(start, end, 0);

			expect(result).toEqual(start);
		});

		it('should return exact end when t=1', () => {
			const start = { x: 10, y: 20, z: 30 };
			const end = { x: 100, y: 200, z: 300 };

			const result = lerpPosition(start, end, 1);

			expect(result).toEqual(end);
		});
	});

	describe('slerpAngle', () => {
		it('should interpolate angles normally within same semicircle', () => {
			// 0 to 90 degrees (0 to PI/2)
			const result = slerpAngle(0, Math.PI / 2, 0.5);
			expect(result).toBeCloseTo(Math.PI / 4, 5);
		});

		it('should handle wrap-around from positive to negative', () => {
			// 170° to -170° should go through 180°, not backwards through 0°
			const start = (170 * Math.PI) / 180;
			const end = (-170 * Math.PI) / 180;

			const result = slerpAngle(start, end, 0.5);

			// Should be at 180° (PI)
			expect(result).toBeCloseTo(Math.PI, 5);
		});

		it('should handle wrap-around from negative to positive', () => {
			// -170° to 170° should go through -180°/180°
			const start = (-170 * Math.PI) / 180;
			const end = (170 * Math.PI) / 180;

			const result = slerpAngle(start, end, 0.5);

			// Should be at -180° or 180° (they're the same)
			expect(Math.abs(result)).toBeCloseTo(Math.PI, 5);
		});

		it('should take the short path around the circle', () => {
			// Going from 350° to 10° should go through 0°, not backwards through 180°
			const start = (350 * Math.PI) / 180;
			const end = (10 * Math.PI) / 180;

			const result = slerpAngle(start, end, 0.5);

			// Should be at 0° (or close to it)
			// The result might be slightly above 2*PI or slightly below 0
			const normalizedResult = ((result % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
			expect(normalizedResult).toBeCloseTo(0, 1);
		});

		it('should return start when t=0', () => {
			const result = slerpAngle(1, 2, 0);
			expect(result).toBe(1);
		});

		it('should return end when t=1', () => {
			const result = slerpAngle(1, 2, 1);
			expect(result).toBe(2);
		});
	});

	describe('calculateInterpolationFactor', () => {
		it('should return 0 when deltaTime is 0', () => {
			const factor = calculateInterpolationFactor(0, 10);
			expect(factor).toBe(0);
		});

		it('should approach 1 as deltaTime increases', () => {
			const factor = calculateInterpolationFactor(1, 10);
			expect(factor).toBeGreaterThan(0.99);
		});

		it('should be proportional to interpolation speed', () => {
			const slowFactor = calculateInterpolationFactor(0.016, 5);
			const fastFactor = calculateInterpolationFactor(0.016, 20);

			expect(fastFactor).toBeGreaterThan(slowFactor);
		});

		it('should give reasonable values at 60fps', () => {
			// At 60fps, deltaTime ≈ 0.0167 seconds
			const factor = calculateInterpolationFactor(0.0167, 10);

			// Should be a reasonable smoothing factor (not too slow, not too fast)
			expect(factor).toBeGreaterThan(0.1);
			expect(factor).toBeLessThan(0.3);
		});

		it('should be clamped between 0 and 1', () => {
			const negativeDelta = calculateInterpolationFactor(-1, 10);
			const hugeDelta = calculateInterpolationFactor(1000, 10);

			expect(negativeDelta).toBeGreaterThanOrEqual(0);
			expect(negativeDelta).toBeLessThanOrEqual(1);
			expect(hugeDelta).toBeGreaterThanOrEqual(0);
			expect(hugeDelta).toBeLessThanOrEqual(1);
		});
	});

	describe('clamp', () => {
		it('should return value if within range', () => {
			expect(clamp(5, 0, 10)).toBe(5);
		});

		it('should return min if value is below', () => {
			expect(clamp(-5, 0, 10)).toBe(0);
		});

		it('should return max if value is above', () => {
			expect(clamp(15, 0, 10)).toBe(10);
		});

		it('should handle edge cases at boundaries', () => {
			expect(clamp(0, 0, 10)).toBe(0);
			expect(clamp(10, 0, 10)).toBe(10);
		});
	});
});

describe('Remote Player Position Interpolation Integration', () => {
	it('should smoothly interpolate between network updates', () => {
		// Simulate receiving a position update and interpolating over multiple frames
		const previousPosition = { x: 0, y: 0, z: 0 };
		const targetPosition = { x: 100, y: 0, z: 100 };

		let currentPosition = { ...previousPosition };
		const frameTime = 0.0167; // ~60fps
		const interpolationSpeed = 10;

		// Simulate 10 frames of interpolation
		for (let i = 0; i < 10; i++) {
			const t = calculateInterpolationFactor(frameTime, interpolationSpeed);
			currentPosition = lerpPosition(currentPosition, targetPosition, t);
		}

		// After 10 frames (~167ms), should be significantly closer to target
		const distanceToTarget = Math.sqrt(
			Math.pow(targetPosition.x - currentPosition.x, 2) +
				Math.pow(targetPosition.z - currentPosition.z, 2)
		);

		// Original distance was ~141.4, should be much closer now
		expect(distanceToTarget).toBeLessThan(50);
	});

	it('should handle rapid direction changes smoothly', () => {
		// Simulate a player turning around quickly
		let currentYaw = 0;
		const targetYaw = Math.PI; // 180° turn

		const frameTime = 0.0167;
		const interpolationSpeed = 10;

		// Simulate 30 frames (~500ms) - enough time for smooth convergence
		for (let i = 0; i < 30; i++) {
			const t = calculateInterpolationFactor(frameTime, interpolationSpeed);
			currentYaw = slerpAngle(currentYaw, targetYaw, t);
		}

		// Should be close to target after 30 frames (within ~0.05 radians or ~3°)
		expect(currentYaw).toBeCloseTo(Math.PI, 1);
	});
});
