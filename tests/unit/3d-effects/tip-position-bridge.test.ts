import { describe, it, expect } from "vitest";
import {
	resolveRigLocalPropCenter3D,
	resolveTrailSources3D,
	TipPositionBridge3D,
} from "$lib/shared/3d/effects/tip-position-bridge-3d";
import { resolvePropTipAnchors3D } from "$lib/shared/3d/effects/prop-tip-geometry-3d";
import { TrackingMode } from "$lib/shared/animation-engine/domain/types/trail-types";
import type { TipPositionData3D } from "$lib/shared/3d/effects/types";
import { PropType } from "@austencloud/scene-3d";

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
	it("adds the hand anchor displacement to a rig-local prop center", () => {
		const center = resolveRigLocalPropCenter3D(
			{ x: 0.25, y: 1.1, z: -0.4 },
			{ x: -0.3, z: 0.9 }
		);

		expect(center.x).toBeCloseTo(-0.05, 8);
		expect(center.y).toBe(1.1);
		expect(center.z).toBe(0.5);
	});

	it("computes two tip positions from prop state", () => {
		const bridge = new TipPositionBridge3D();
		const center = { x: 0, y: 1, z: 0 };
		const result = bridge.update(
			0,
			makePropState(0, 1, 0),
			center,
			0.5,
			1 / 60
		);
		expect(result.tips.length).toBe(2);
		expect(result.propIndex).toBe(0);
	});

	it("tips are separated by staff length along the computed axis", () => {
		const bridge = new TipPositionBridge3D();
		const halfLen = 0.5;
		const center = { x: 0, y: 0, z: 0 };
		const result = bridge.update(
			0,
			makePropState(0, 0, 0),
			center,
			halfLen,
			1 / 60
		);

		const tip0 = result.tips[0].position;
		const tip1 = result.tips[1].position;
		const dx = tip0.x - tip1.x;
		const dy = tip0.y - tip1.y;
		const dz = tip0.z - tip1.z;
		const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

		// Distance between tips should be 2 * halfLength = full staff length
		expect(distance).toBeCloseTo(halfLen * 2, 4);
	});

	it("orders the rendered staff endpoints as Pinky then Thumb", () => {
		const bridge = new TipPositionBridge3D();
		const center = { x: 0, y: 0, z: 0 };
		const result = bridge.update(
			0,
			makePropState(0, 0, 0),
			center,
			0.5,
			1 / 60
		);

		expect(result.tips[0].position.x).toBeCloseTo(0.5, 6);
		expect(result.tips[1].position.x).toBeCloseTo(-0.5, 6);
	});

	it("computes velocity from position changes", () => {
		const bridge = new TipPositionBridge3D();
		const center1 = { x: 0, y: 1, z: 0 };
		const center2 = { x: 1, y: 1, z: 0 };
		bridge.update(0, makePropState(0, 1, 0), center1, 0.5, 1 / 60);
		const result = bridge.update(
			0,
			makePropState(1, 1, 0),
			center2,
			0.5,
			1 / 60
		);

		// Velocity should be non-zero after center moved
		const tip = result.tips[0];
		const speed = Math.sqrt(
			tip.velocity.x ** 2 + tip.velocity.y ** 2 + tip.velocity.z ** 2
		);
		expect(speed).toBeGreaterThan(0);
	});

	it("tracks rotating tips even when the prop center is stationary", () => {
		const bridge = new TipPositionBridge3D();
		const center = { x: 0, y: 0, z: 0 };
		const dt = 0.5;
		const identity = makePropState(0, 0, 0);
		const quarterTurn = {
			...identity,
			worldRotation: {
				x: 0,
				y: 0,
				z: Math.sin(Math.PI / 4),
				w: Math.cos(Math.PI / 4),
			},
		};

		bridge.update(0, identity, center, 0.5, dt);
		const result = bridge.update(0, quarterTurn, center, 0.5, dt);

		// Each endpoint travels sqrt(0.5^2 + 0.5^2) metres in half a second.
		const expectedSpeed = Math.SQRT2;
		expect(result.tips[0].speed).toBeCloseTo(expectedSpeed, 6);
		expect(result.tips[1].speed).toBeCloseTo(expectedSpeed, 6);
		expect(result.tips[0].velocity.x).toBeCloseTo(
			-result.tips[1].velocity.x,
			6
		);
		expect(result.tips[0].velocity.y).toBeCloseTo(
			-result.tips[1].velocity.y,
			6
		);
	});

	it("velocity magnitude matches speed field", () => {
		const bridge = new TipPositionBridge3D();
		const center1 = { x: 0, y: 0, z: 0 };
		const center2 = { x: 1, y: 0, z: 0 };
		bridge.update(0, makePropState(0, 0, 0), center1, 0.5, 1 / 60);
		const result = bridge.update(
			0,
			makePropState(1, 0, 0),
			center2,
			0.5,
			1 / 60
		);

		const tip = result.tips[0];
		const computedSpeed = Math.sqrt(
			tip.velocity.x ** 2 + tip.velocity.y ** 2 + tip.velocity.z ** 2
		);
		expect(tip.speed).toBeCloseTo(computedSpeed, 6);
	});

	it("returns zero velocity on first frame", () => {
		const bridge = new TipPositionBridge3D();
		const center = { x: 5, y: 3, z: 1 };
		const result = bridge.update(
			0,
			makePropState(5, 3, 1),
			center,
			0.5,
			1 / 60
		);
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
		const result = bridge.update(
			0,
			makePropState(1, 0, 0),
			{ x: 1, y: 0, z: 0 },
			0.5,
			dt
		);

		const tip = result.tips[0];
		const jerkMag = Math.sqrt(
			tip.jerk.x ** 2 + tip.jerk.y ** 2 + tip.jerk.z ** 2
		);
		expect(jerkMag).toBeGreaterThan(0);
	});

	it("resets history", () => {
		const bridge = new TipPositionBridge3D();
		bridge.update(0, makePropState(0, 0, 0), { x: 0, y: 0, z: 0 }, 0.5, 1 / 60);
		bridge.update(
			0,
			makePropState(10, 0, 0),
			{ x: 10, y: 0, z: 0 },
			0.5,
			1 / 60
		);
		bridge.reset();

		// After reset, should be like first frame again
		const result = bridge.update(
			0,
			makePropState(0, 0, 0),
			{ x: 0, y: 0, z: 0 },
			0.5,
			1 / 60
		);
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
		const movingResult = bridge.update(
			1,
			makePropState(5, 0, 0),
			{ x: 5, y: 0, z: 0 },
			0.5,
			dt
		);

		// Prop 1 should have velocity, prop 0 should not
		const stationaryResult = bridge.update(
			0,
			makePropState(0, 0, 0),
			origin,
			0.5,
			dt
		);
		expect(stationaryResult.tips[0].speed).toBeCloseTo(0, 4);
		expect(movingResult.tips[0].speed).toBeGreaterThan(0);
	});
});
describe("resolveTrailSources3D", () => {
	const stationary = { x: 0, y: 0, z: 0 };
	const tips: TipPositionData3D[] = [
		{
			tipIndex: 0,
			position: { x: 1, y: 2, z: 3 },
			velocity: stationary,
			jerk: stationary,
			speed: 0,
		},
		{
			tipIndex: 1,
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

	it("follows the one real tip when a single-ended prop asks for both ends", () => {
		const singleTip: TipPositionData3D[] = [
			{
				tipIndex: 1,
				position: { x: 0.5, y: 0, z: 0 },
				velocity: stationary,
				jerk: stationary,
				speed: 0,
			},
		];

		for (const mode of [
			TrackingMode.LEFT_END,
			TrackingMode.RIGHT_END,
			TrackingMode.BOTH_ENDS,
		]) {
			expect(resolveTrailSources3D(mode, singleTip, propCenter)).toEqual([
				{
					sourceId: "right-end",
					effectTipIndex: 1,
					position: singleTip[0].position,
				},
			]);
		}
	});
});

describe("resolvePropTipAnchors3D", () => {
	const halfLength = 0.4318; // Austen's 34in staff

	it("keeps both ends for the staff family", () => {
		expect(resolvePropTipAnchors3D(PropType.STAFF, halfLength)).toEqual([
			{ effectTipIndex: 0, axialOffset: -halfLength },
			{ effectTipIndex: 1, axialOffset: halfLength },
		]);
	});

	it("gives a club one tip, at the club's own cap reach", () => {
		const anchors = resolvePropTipAnchors3D(PropType.CLUB, halfLength);

		expect(anchors).toHaveLength(1);
		expect(anchors[0].effectTipIndex).toBe(1);
		// club-profile.ts CLUB_REACH_M - an absolute 52cm club, not half a staff.
		expect(anchors[0].axialOffset).toBeCloseTo(0.50343, 5);
	});

	it.each([
		PropType.FAN,
		PropType.SWORD,
		PropType.MINIHOOP,
		PropType.TRIAD,
		PropType.TORCH,
		PropType.CHICKEN,
		PropType.GUITAR,
		PropType.UKULELE,
	])("gives %s exactly one tip, on the thumb slot", (propType) => {
		const anchors = resolvePropTipAnchors3D(propType, halfLength);

		expect(anchors).toHaveLength(1);
		expect(anchors[0].effectTipIndex).toBe(1);
		expect(anchors[0].axialOffset).toBeGreaterThan(0);
	});

	it("places the ukulele tip at its authored headstock-tip grip", () => {
		expect(resolvePropTipAnchors3D(PropType.UKULELE, halfLength)).toEqual([
			{ effectTipIndex: 1, axialOffset: 0.015 },
		]);
	});

	it("emits from the ball itself for a contact ball, and from the hand for a bare hand", () => {
		for (const propType of [PropType.CONTACTBALL, PropType.HAND]) {
			const anchors = resolvePropTipAnchors3D(propType, halfLength);
			expect(anchors).toEqual([{ effectTipIndex: 1, axialOffset: 0 }]);
		}
	});

	it("keeps both ends for the bilateral props the 2D registry does not list", () => {
		expect(
			resolvePropTipAnchors3D(PropType.FRACTALGENG, halfLength)
		).toHaveLength(2);
		expect(
			resolvePropTipAnchors3D(PropType.DOUBLECONTACTBALL, halfLength)
		).toHaveLength(2);
	});

	it("drops the phantom end the bridge used to publish for every prop", () => {
		const bridge = new TipPositionBridge3D();
		const center = { x: 0, y: 1, z: 0 };

		const staff = bridge.update(
			0,
			makePropState(0, 1, 0),
			center,
			0.5,
			1 / 60,
			PropType.STAFF
		);
		const club = bridge.update(
			1,
			makePropState(0, 1, 0),
			center,
			0.5,
			1 / 60,
			PropType.CLUB
		);

		expect(staff.tips.map((tip) => tip.tipIndex)).toEqual([0, 1]);
		expect(club.tips.map((tip) => tip.tipIndex)).toEqual([1]);
	});
});
