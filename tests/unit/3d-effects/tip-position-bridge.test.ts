import { describe, it, expect } from "vitest";
import {
	resolveTrailSources3D,
	TipPositionBridge3D,
} from "$lib/shared/3d/effects/tip-position-bridge-3d";
import { TrackingMode } from "$lib/shared/animation-engine/domain/types/trail-types";
import type { TipPositionData3D } from "$lib/shared/3d/effects/types";

function makePropState(x: number, y: number, z: number) {
	return {
		worldPosition: { x, y, z },
		worldRotation: { x: 0, y: 0, z: 0, w: 1 }, // identity quaternion
		staffRotationAngle: 0,
		plane: "WALL",
		centerPathAngle: 0,
	};
}

describe("TipPositionBridge3D", () => {
	it("computes two tip positions from prop state", () => {
		const bridge = new TipPositionBridge3D();
		const center = { x: 0, y: 1, z: 0 };
		const result = bridge.update(0, makePropState(0, 1, 0), center, 0.5, 1 / 60);
		expect(result.tips.length).toBe(2);
		expect(result.propIndex).toBe(0);
	});

	it("tips are separated by staff length along the computed axis", () => {
		const bridge = new TipPositionBridge3D();
		const halfLen = 0.5;
		const center = { x: 0, y: 0, z: 0 };
		const result = bridge.update(0, makePropState(0, 0, 0), center, halfLen, 1 / 60);

		const tip0 = result.tips[0].position;
		const tip1 = result.tips[1].position;
		const dx = tip0.x - tip1.x;
		const dy = tip0.y - tip1.y;
		const dz = tip0.z - tip1.z;
		const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

		// Distance between tips should be 2 * halfLength = full staff length
		expect(distance).toBeCloseTo(halfLen * 2, 4);
	});

	it("computes velocity from position changes", () => {
		const bridge = new TipPositionBridge3D();
		const center1 = { x: 0, y: 1, z: 0 };
		const center2 = { x: 1, y: 1, z: 0 };
		bridge.update(0, makePropState(0, 1, 0), center1, 0.5, 1 / 60);
		const result = bridge.update(0, makePropState(1, 1, 0), center2, 0.5, 1 / 60);

		// Velocity should be non-zero after center moved
		const tip = result.tips[0];
		const speed = Math.sqrt(
			tip.velocity.x ** 2 + tip.velocity.y ** 2 + tip.velocity.z ** 2,
		);
		expect(speed).toBeGreaterThan(0);
	});

	it("velocity magnitude matches speed field", () => {
		const bridge = new TipPositionBridge3D();
		const center1 = { x: 0, y: 0, z: 0 };
		const center2 = { x: 1, y: 0, z: 0 };
		bridge.update(0, makePropState(0, 0, 0), center1, 0.5, 1 / 60);
		const result = bridge.update(0, makePropState(1, 0, 0), center2, 0.5, 1 / 60);

		const tip = result.tips[0];
		const computedSpeed = Math.sqrt(
			tip.velocity.x ** 2 + tip.velocity.y ** 2 + tip.velocity.z ** 2,
		);
		expect(tip.speed).toBeCloseTo(computedSpeed, 6);
	});

	it("returns zero velocity on first frame", () => {
		const bridge = new TipPositionBridge3D();
		const center = { x: 5, y: 3, z: 1 };
		const result = bridge.update(0, makePropState(5, 3, 1), center, 0.5, 1 / 60);
		expect(result.tips[0].speed).toBe(0);
		expect(result.tips[1].speed).toBe(0);
	});

	it("computes jerk from velocity changes", () => {
		const bridge = new TipPositionBridge3D();
		const dt = 1 / 60;

		// Frame 1: stationary
		bridge.update(0, makePropState(0, 0, 0), { x: 0, y: 0, z: 0 }, 0.5, dt);
		// Frame 2: start moving (velocity appears, jerk should be non-zero)
		bridge.update(0, makePropState(1, 0, 0), { x: 1, y: 0, z: 0 }, 0.5, dt);
		// Frame 3: stop moving (velocity drops, jerk should be non-zero again)
		const result = bridge.update(0, makePropState(1, 0, 0), { x: 1, y: 0, z: 0 }, 0.5, dt);

		const tip = result.tips[0];
		const jerkMag = Math.sqrt(
			tip.jerk.x ** 2 + tip.jerk.y ** 2 + tip.jerk.z ** 2,
		);
		expect(jerkMag).toBeGreaterThan(0);
	});

	it("resets history", () => {
		const bridge = new TipPositionBridge3D();
		bridge.update(0, makePropState(0, 0, 0), { x: 0, y: 0, z: 0 }, 0.5, 1 / 60);
		bridge.update(0, makePropState(10, 0, 0), { x: 10, y: 0, z: 0 }, 0.5, 1 / 60);
		bridge.reset();

		// After reset, should be like first frame again
		const result = bridge.update(0, makePropState(0, 0, 0), { x: 0, y: 0, z: 0 }, 0.5, 1 / 60);
		expect(result.tips[0].speed).toBe(0);
		expect(result.tips[1].speed).toBe(0);
	});

	it("tracks multiple props independently", () => {
		const bridge = new TipPositionBridge3D();
		const dt = 1 / 60;
		const origin = { x: 0, y: 0, z: 0 };

		// Prop 0 stationary, prop 1 moving
		bridge.update(0, makePropState(0, 0, 0), origin, 0.5, dt);
		bridge.update(1, makePropState(0, 0, 0), origin, 0.5, dt);

		bridge.update(0, makePropState(0, 0, 0), origin, 0.5, dt); // still stationary
		const movingResult = bridge.update(1, makePropState(5, 0, 0), { x: 5, y: 0, z: 0 }, 0.5, dt);

		// Prop 1 should have velocity, prop 0 should not
		const stationaryResult = bridge.update(
			0,
			makePropState(0, 0, 0),
			origin,
			0.5,
			dt,
		);
		expect(stationaryResult.tips[0].speed).toBeCloseTo(0, 4);
		expect(movingResult.tips[0].speed).toBeGreaterThan(0);
	});
});

describe("resolveTrailSources3D", () => {
	const stationary = { x: 0, y: 0, z: 0 };
	const tips: TipPositionData3D[] = [
		{
			position: { x: 1, y: 2, z: 3 },
			velocity: stationary,
			jerk: stationary,
			speed: 0,
		},
		{
			position: { x: -1, y: -2, z: -3 },
			velocity: stationary,
			jerk: stationary,
			speed: 0,
		},
	];
	const propCenter = { x: 10, y: 20, z: 30 };

	it.each([
		{
			mode: TrackingMode.LEFT_END,
			expected: [
				{
					sourceId: "left-end",
					effectTipIndex: 0,
					position: tips[0].position,
				},
			],
		},
		{
			mode: TrackingMode.RIGHT_END,
			expected: [
				{
					sourceId: "right-end",
					effectTipIndex: 1,
					position: tips[1].position,
				},
			],
		},
		{
			mode: TrackingMode.BOTH_ENDS,
			expected: [
				{
					sourceId: "left-end",
					effectTipIndex: 0,
					position: tips[0].position,
				},
				{
					sourceId: "right-end",
					effectTipIndex: 1,
					position: tips[1].position,
				},
			],
		},
		{
			mode: TrackingMode.HAND,
			expected: [
				{
					sourceId: "hand",
					effectTipIndex: 1,
					position: propCenter,
				},
			],
		},
	])("selects the expected sources for $mode", ({ mode, expected }) => {
		expect(resolveTrailSources3D(mode, tips, propCenter)).toEqual(expected);
	});
});
