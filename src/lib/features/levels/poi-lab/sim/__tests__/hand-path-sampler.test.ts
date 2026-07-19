import { describe, expect, it } from "vitest";
import { sampleHandPath } from "../hand-path-sampler";
import { BASE_SAMPLES_PER_BEAT } from "$lib/shared/mandala/domain/mandala-constants";
import type { StepLike } from "$lib/shared/mandala/services/types";

function step(overrides: Partial<StepLike["motions"] extends infer M ? M : never> = {}): StepLike {
	return {
		motions: {
			blue: {
				motionType: "static",
				rotationDirection: "noRotation",
				startLocation: "n",
				endLocation: "n",
				startOrientation: "out",
				endOrientation: "out",
				turns: 0,
				...(overrides as any).blue,
			},
			red: {
				motionType: "static",
				rotationDirection: "noRotation",
				startLocation: "s",
				endLocation: "s",
				startOrientation: "out",
				endOrientation: "out",
				turns: 0,
				...(overrides as any).red,
			},
		},
	};
}

const oneBeatSpin: StepLike[] = [
	step({
		blue: {
			motionType: "pro",
			rotationDirection: "cw",
			startLocation: "n",
			endLocation: "e",
			startOrientation: "out",
			endOrientation: "out",
			turns: 1,
		},
	}),
];

describe("sampleHandPath", () => {
	it("returns hand and intendedHead paths with equal, uniform sample counts", () => {
		const result = sampleHandPath(oneBeatSpin, "blue", 120);

		expect(result.samplesPerBeat).toBe(BASE_SAMPLES_PER_BEAT);
		// generatePathPoints emits samplesPerBeat + 1 points per beat (i <= samples)
		expect(result.hand.length).toBe(BASE_SAMPLES_PER_BEAT + 1);
		expect(result.intendedHead.length).toBe(result.hand.length);
	});

	it("collapses the intended head onto the hand when tetherTipDx is 0", () => {
		const result = sampleHandPath(oneBeatSpin, "blue", 0);

		for (let i = 0; i < result.hand.length; i++) {
			expect(result.intendedHead[i]!.x).toBeCloseTo(result.hand[i]!.x, 9);
			expect(result.intendedHead[i]!.y).toBeCloseTo(result.hand[i]!.y, 9);
		}
	});

	it("offsets the intended head away from the hand when tetherTipDx is nonzero", () => {
		const result = sampleHandPath(oneBeatSpin, "blue", 120);

		let sawDivergence = false;
		for (let i = 0; i < result.hand.length; i++) {
			const dx = result.intendedHead[i]!.x - result.hand[i]!.x;
			const dy = result.intendedHead[i]!.y - result.hand[i]!.y;
			const dist = Math.hypot(dx, dy);
			if (dist > 1e-6) sawDivergence = true;
		}
		expect(sawDivergence).toBe(true);
	});

	it("produces samplesPerBeat + 1 points per beat across multiple beats", () => {
		const twoBeats: StepLike[] = [...oneBeatSpin, ...oneBeatSpin];
		const result = sampleHandPath(twoBeats, "blue", 120);

		expect(result.hand.length).toBe(2 * (BASE_SAMPLES_PER_BEAT + 1));
	});

	it("honors a custom samplesPerBeat option uniformly", () => {
		const result = sampleHandPath(oneBeatSpin, "blue", 120, { samplesPerBeat: 8 });

		expect(result.samplesPerBeat).toBe(8);
		expect(result.hand.length).toBe(9);
		expect(result.intendedHead.length).toBe(9);
	});

	it("throws when the requested hand has no visible motion in any step", () => {
		const noRed: StepLike[] = [
			{
				motions: {
					blue: {
						motionType: "static",
						rotationDirection: "noRotation",
						startLocation: "n",
						endLocation: "n",
						startOrientation: "out",
						endOrientation: "out",
						turns: 0,
					},
					red: {
						motionType: "static",
						rotationDirection: "noRotation",
						startLocation: "s",
						endLocation: "s",
						isVisible: false,
					},
				},
			},
		];

		expect(() => sampleHandPath(noRed, "red", 120)).toThrow();
	});
});
