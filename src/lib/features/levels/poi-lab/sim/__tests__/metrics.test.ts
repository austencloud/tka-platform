import { describe, expect, it } from "vitest";
import type { PoiSimFrame } from "../poi-sim";
import {
	evaluatePerformability,
	findMinBpm,
	headDeviation,
	slackFraction,
} from "../metrics";

function frame(t: number, taut: boolean, head = { x: 0, y: 0 }): PoiSimFrame {
	return { t, hand: { x: 0, y: 0 }, head, taut };
}

describe("metrics", () => {
	it("slackFraction counts the share of non-taut frames", () => {
		const frames = [frame(0, true), frame(1, false), frame(2, false), frame(3, true)];
		expect(slackFraction(frames)).toBeCloseTo(0.5, 10);
	});

	it("slackFraction is 0 for an empty run", () => {
		expect(slackFraction([])).toBe(0);
	});

	it("headDeviation reports mean and max distance from the intended path", () => {
		const frames = [
			frame(0, true, { x: 0, y: 0 }),
			frame(1, true, { x: 1, y: 0 }),
			frame(2, true, { x: 2, y: 0 }),
		];
		const intendedHeadAt = (t: number) => ({ x: t, y: 0.1 });
		const { mean, max } = headDeviation(frames, intendedHeadAt);
		expect(mean).toBeCloseTo(0.1, 10);
		expect(max).toBeCloseTo(0.1, 5);
	});

	it("evaluatePerformability flags a run performable only under both thresholds", () => {
		const goodFrames = [frame(0, true), frame(1, true), frame(2, true)];
		const good = evaluatePerformability(goodFrames, () => ({ x: 0, y: 0 }));
		expect(good.performable).toBe(true);
		expect(good.slackFraction).toBe(0);

		const badFrames = [frame(0, false), frame(1, false), frame(2, true)];
		const bad = evaluatePerformability(badFrames, () => ({ x: 0, y: 0 }));
		expect(bad.performable).toBe(false);
	});

	it("findMinBpm bisects to the boundary where runAtBpm flips false->true", () => {
		const trueFloor = 120;
		const minBpm = findMinBpm({
			runAtBpm: (bpm) => bpm >= trueFloor,
			toleranceBpm: 0.5,
		});
		expect(Math.abs(minBpm - trueFloor)).toBeLessThanOrEqual(1);
	});

	it("findMinBpm returns range.min when the slowest tempo is already performable", () => {
		const minBpm = findMinBpm({ runAtBpm: () => true });
		expect(minBpm).toBe(40);
	});

	it("findMinBpm returns range.max when no tempo in range is performable", () => {
		const minBpm = findMinBpm({ runAtBpm: () => false });
		expect(minBpm).toBe(240);
	});
});
