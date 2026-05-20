import { describe, it, expect } from "vitest";
import { serializeComposerPlacements } from "../persistence/file-persistence";
import type { ComposerPlacement } from "../types";

describe("serializeComposerPlacements", () => {
	it("generates valid TypeScript source", () => {
		const placements: ComposerPlacement[] = [
			{
				id: "rock-001",
				objectKey: "rock-large",
				position: [5.2, 0, -3.1],
				rotation: [0, 0.38, 0, 0.92],
				scale: [1.2, 1, 1.2],
			},
		];

		const output = serializeComposerPlacements("forest-autumn", placements);

		expect(output).toContain("import type { ComposerPlacement }");
		expect(output).toContain("FOREST_AUTUMN_PLACEMENTS");
		expect(output).toContain('"rock-001"');
		expect(output).toContain('"rock-large"');
		expect(output).toContain("[5.2, 0, -3.1]");
	});

	it("generates empty array for no placements", () => {
		const output = serializeComposerPlacements("winter", []);
		expect(output).toContain("WINTER_PLACEMENTS: ComposerPlacement[] = []");
	});
});
