/**
 * SequenceFuser Tests
 *
 * Pure math: LCM-based tiling and truncation. Bugs here are silent —
 * a wrong target length would produce sequences with wrong beat counts
 * that look plausible but pair blue/red motions incorrectly.
 */

import { describe, it, expect } from "vitest";
import { fuseSequences } from "$lib/features/fuse/services/sequence-fuser";
import type { HandPathData } from "$lib/shared/foundation/domain/models/hand-path-data";
import {
	GridLocation,
	GridMode,
} from "$lib/shared/pictograph/grid/domain/enums/grid-enums";

function makeHandPath(length: number): HandPathData {
	// Build a location sequence of the requested length.
	// A hand path with N steps has N+1 locations (start + one end per step).
	const cardinals = [
		GridLocation.NORTH,
		GridLocation.EAST,
		GridLocation.SOUTH,
		GridLocation.WEST,
	];
	const locations: GridLocation[] = [];
	for (let i = 0; i <= length; i++) {
		locations.push(cardinals[i % cardinals.length]);
	}

	return {
		id: crypto.randomUUID(),
		locations,
		contentHash: "",
		startLocation: locations[0],
		endLocation: locations[locations.length - 1],
		length,
		bigrams: [],
		uniqueLocations: [...new Set(locations)],
		impliedGridMode: GridMode.DIAMOND,
		isClosed: locations[0] === locations[locations.length - 1],
	};
}

describe("SequenceFuser", () => {
	it("fuses two equal-length hand paths into correct length", () => {
		const blue = makeHandPath(8);
		const red = makeHandPath(8);

		const result = fuseSequences(blue, red);

		// LCM(8, 8) = 8, so output should be 8 beats
		expect(result.stepPairings).toBeDefined();
		expect(result.stepPairings!.length).toBe(8);
		expect(result.sequenceLength).toBe(8);
		expect(result.blueSoloProp).toBeDefined();
		expect(result.redSoloProp).toBeDefined();
		expect(result.blueSoloProp!.steps.length).toBe(8);
		expect(result.redSoloProp!.steps.length).toBe(8);
	});

	it("tiles mismatched lengths to LCM (3 + 4 = 12)", () => {
		const blue = makeHandPath(3);
		const red = makeHandPath(4);

		const result = fuseSequences(blue, red);

		// LCM(3, 4) = 12, which is under the default 64-beat cap
		expect(result.stepPairings!.length).toBe(12);
		expect(result.sequenceLength).toBe(12);
		expect(result.blueSoloProp!.steps.length).toBe(12);
		expect(result.redSoloProp!.steps.length).toBe(12);
	});

	it("truncates when LCM exceeds maxSteps", () => {
		const blue = makeHandPath(37);
		const red = makeHandPath(41);

		// LCM(37, 41) = 1517, way over 64. Should truncate to min(37, 41) = 37.
		const result = fuseSequences(blue, red);

		expect(result.stepPairings!.length).toBe(37);
		expect(result.sequenceLength).toBe(37);
	});

	it("respects custom maxSteps option", () => {
		const blue = makeHandPath(5);
		const red = makeHandPath(7);

		// LCM(5, 7) = 35. With maxSteps=10, should truncate to min(5, 7) = 5.
		const result = fuseSequences(blue, red, { maxSteps: 10 });

		expect(result.stepPairings!.length).toBe(5);
		expect(result.sequenceLength).toBe(5);
	});

	it("produces a valid SequenceData with required fields", () => {
		const blue = makeHandPath(4);
		const red = makeHandPath(4);

		const result = fuseSequences(blue, red);

		expect(result.id).toBeDefined();
		expect(typeof result.id).toBe("string");
		expect(result.isFavorite).toBe(false);
		expect(result.isCircular).toBe(false);
		expect(result.tags).toEqual([]);
		expect(result.metadata).toHaveProperty("fusedFrom");
	});
});
