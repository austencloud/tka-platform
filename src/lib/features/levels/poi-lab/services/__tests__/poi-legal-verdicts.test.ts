import { describe, it, expect } from "vitest";
import { createPoiLegalVerdicts, pairKey } from "../poi-legal-verdicts.svelte";
import { flowerKey, type Flower } from "$lib/shared/shape-matrix/domain/flower-signature";

// Box-grid flowers: absent from the seeded data file, so these tests stay
// independent of whatever diamond verdicts are committed.
const blue: Flower = { style: "pro", turns: 0, ori: "in", grid: "box", petals: 0 };
const red: Flower = { style: "anti", turns: 0.5, ori: "out", grid: "box", petals: 3 };

describe("pairKey", () => {
	it("composes both flowerKeys, blue first", () => {
		expect(pairKey(blue, red)).toBe(`${flowerKey(blue)}|${flowerKey(red)}`);
	});
});

describe("poi legal verdict store", () => {
	it("cycles unjudged → legal → illegal → unsure → unjudged", () => {
		const store = createPoiLegalVerdicts();
		expect(store.verdictFor(blue, red)).toBeNull();
		store.cycle(blue, red);
		expect(store.verdictFor(blue, red)).toBe("legal");
		store.cycle(blue, red);
		expect(store.verdictFor(blue, red)).toBe("illegal");
		store.cycle(blue, red);
		expect(store.verdictFor(blue, red)).toBe("unsure");
		store.cycle(blue, red);
		expect(store.verdictFor(blue, red)).toBeNull();
	});

	it("tracks dirty keys and serializes with sorted keys and version 1", () => {
		const store = createPoiLegalVerdicts();
		expect(store.dirtyCount).toBe(0);
		store.cycle(blue, red); // legal
		store.cycle(red, blue); // legal (different pair — reversed hands)
		expect(store.dirtyCount).toBe(2);

		const file = store.serialize();
		expect(file.version).toBe(1);
		const keys = Object.keys(file.verdicts);
		expect([...keys].sort((a, b) => a.localeCompare(b))).toEqual(keys);
		expect(file.verdicts[pairKey(blue, red)]).toBe("legal");
		expect(file.verdicts[pairKey(red, blue)]).toBe("legal");
	});

	it("cycling back to unjudged removes the key from the serialized file", () => {
		const store = createPoiLegalVerdicts();
		store.cycle(blue, red);
		store.cycle(blue, red);
		store.cycle(blue, red);
		store.cycle(blue, red); // full cycle back to unjudged
		expect(store.serialize().verdicts[pairKey(blue, red)]).toBeUndefined();
		expect(store.serialize().verdicts[pairKey(red, blue)]).toBeUndefined();
	});
});
