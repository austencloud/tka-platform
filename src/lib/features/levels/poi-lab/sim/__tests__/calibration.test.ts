import { describe, expect, it } from "vitest";
import {
	BPM_RANGE,
	DEFAULT_HAND_RADIUS_METERS,
	DEFAULT_TETHER_LENGTH_METERS,
	MANDALA_GRID_RADIUS,
	TETHER_LENGTH_RANGE_METERS,
	beatDuration,
	clampBpm,
	clampTetherLength,
	gridToMeters,
} from "../calibration";

describe("calibration constants", () => {
	it("exposes the documented defaults and ranges", () => {
		expect(DEFAULT_TETHER_LENGTH_METERS).toBe(0.75);
		expect(TETHER_LENGTH_RANGE_METERS).toEqual({ min: 0.5, max: 0.9 });
		expect(BPM_RANGE).toEqual({ min: 40, max: 240 });
		expect(MANDALA_GRID_RADIUS).toBeGreaterThan(0);
	});
});

describe("gridToMeters", () => {
	it("maps a full grid radius to the calibrated hand radius", () => {
		expect(gridToMeters(MANDALA_GRID_RADIUS)).toBeCloseTo(
			DEFAULT_HAND_RADIUS_METERS,
			9
		);
	});

	it("scales linearly with grid units", () => {
		const half = gridToMeters(MANDALA_GRID_RADIUS / 2);
		const full = gridToMeters(MANDALA_GRID_RADIUS);
		expect(half).toBeCloseTo(full / 2, 9);
	});

	it("respects a custom hand-radius calibration", () => {
		const meters = gridToMeters(MANDALA_GRID_RADIUS, { handRadiusMeters: 0.9 });
		expect(meters).toBeCloseTo(0.9, 9);
	});

	it("maps zero grid units to zero meters", () => {
		expect(gridToMeters(0)).toBe(0);
	});
});

describe("beatDuration", () => {
	it("converts BPM to seconds per beat", () => {
		expect(beatDuration(60)).toBeCloseTo(1, 9);
		expect(beatDuration(120)).toBeCloseTo(0.5, 9);
	});

	it("clamps below the supported BPM range before converting", () => {
		expect(beatDuration(10)).toBeCloseTo(beatDuration(BPM_RANGE.min), 9);
	});

	it("clamps above the supported BPM range before converting", () => {
		expect(beatDuration(1000)).toBeCloseTo(beatDuration(BPM_RANGE.max), 9);
	});
});

describe("clampTetherLength / clampBpm", () => {
	it("clamps tether length into range", () => {
		expect(clampTetherLength(0.1)).toBe(TETHER_LENGTH_RANGE_METERS.min);
		expect(clampTetherLength(5)).toBe(TETHER_LENGTH_RANGE_METERS.max);
		expect(clampTetherLength(0.75)).toBe(0.75);
	});

	it("clamps bpm into range", () => {
		expect(clampBpm(1)).toBe(BPM_RANGE.min);
		expect(clampBpm(9999)).toBe(BPM_RANGE.max);
		expect(clampBpm(120)).toBe(120);
	});
});
