/**
 * The model is only trustworthy if it reproduces the tables the authors
 * actually published. These fixtures are the notation values worked through in
 * the source article, transcribed as test data.
 *
 * Source and provenance: docs/reference/archive/qft-notation/README.md
 */

import { describe, expect, it } from "vitest";
import {
	buildIncrements,
	buildPendulum,
	norm,
	pendulumIndexAt,
	posesAt,
	type Convention,
	type QftIncrement,
	type QftKnobs
} from "../../src/lib/shared/notation/qft/qft-model";
import { isDegenerateLine, nameFor, petalCount } from "../../src/lib/shared/notation/qft/qft-naming";

/** propDepart, propDirDepart, handDepart, handArrive, propDirArrive, propArrive */
type Row = [number, number | "n", number, number, number | "n", number];

const flatten = (rows: QftIncrement[]): Row[] =>
	rows.map((r) => [
		r.propDepart,
		r.propDirDepart,
		r.handDepart,
		r.handArrive,
		r.propDirArrive,
		r.propArrive
	]);

interface Case {
	label: string;
	knobs: QftKnobs;
	convention: Convention;
	rows: Row[];
}

const CASES: Case[] = [
	{
		label: "extension",
		knobs: { radius: 1, downbeats: 1, spin: "inspin" },
		convention: "drex",
		rows: [
			[8, 2, 8, 1, 3, 1],
			[1, 3, 1, 2, 4, 2],
			[2, 4, 2, 3, 5, 3],
			[3, 5, 3, 4, 6, 4],
			[4, 6, 4, 5, 7, 5],
			[5, 7, 5, 6, 8, 6],
			[6, 8, 6, 7, 1, 7],
			[7, 1, 7, 8, 2, 8]
		]
	},
	{
		label: "isolation",
		knobs: { radius: 0.5, downbeats: 1, spin: "inspin", phase: 4 },
		convention: "drex",
		rows: [
			[4, 6, 8, 1, 7, 5],
			[5, 7, 1, 2, 8, 6],
			[6, 8, 2, 3, 1, 7],
			[7, 1, 3, 4, 2, 8],
			[8, 2, 4, 5, 3, 1],
			[1, 3, 5, 6, 4, 2],
			[2, 4, 6, 7, 5, 3],
			[3, 5, 7, 8, 6, 4]
		]
	},
	{
		label: "cateye",
		knobs: { radius: 0.5, downbeats: 1, spin: "antispin" },
		convention: "drex",
		rows: [
			[8, 6, 8, 1, 5, 7],
			[7, 5, 1, 2, 4, 6],
			[6, 4, 2, 3, 3, 5],
			[5, 3, 3, 4, 2, 4],
			[4, 2, 4, 5, 1, 3],
			[3, 1, 5, 6, 8, 2],
			[2, 8, 6, 7, 7, 1],
			[1, 7, 7, 8, 6, 8]
		]
	},
	{
		label: "triquetra",
		knobs: { radius: 1, downbeats: 2, spin: "antispin" },
		convention: "drex",
		rows: [
			[8, 6, 8, 1, 4, 6],
			[6, 4, 1, 2, 2, 4],
			[4, 2, 2, 3, 8, 2],
			[2, 8, 3, 4, 6, 8],
			[8, 6, 4, 5, 4, 6],
			[6, 4, 5, 6, 2, 4],
			[4, 2, 6, 7, 8, 2],
			[2, 8, 7, 8, 6, 8]
		]
	},
	{
		label: "4-petal antispin flower",
		knobs: { radius: 1, downbeats: 3, spin: "antispin" },
		convention: "drex",
		rows: [
			[8, 6, 8, 1, 3, 5],
			[5, 3, 1, 2, 8, 2],
			[2, 8, 2, 3, 5, 7],
			[7, 5, 3, 4, 2, 4],
			[4, 2, 4, 5, 7, 1],
			[1, 7, 5, 6, 4, 6],
			[6, 4, 6, 7, 1, 3],
			[3, 1, 7, 8, 6, 8]
		]
	},
	{
		label: "4-petal inspin flower",
		knobs: { radius: 1, downbeats: 5, spin: "inspin" },
		convention: "drex",
		rows: [
			[8, 2, 8, 1, 7, 5],
			[5, 7, 1, 2, 4, 2],
			[2, 4, 2, 3, 1, 7],
			[7, 1, 3, 4, 6, 4],
			[4, 6, 4, 5, 3, 1],
			[1, 3, 5, 6, 8, 6],
			[6, 8, 6, 7, 5, 3],
			[3, 5, 7, 8, 2, 8]
		]
	},
	{
		label: "cateye, Charlie's convention",
		knobs: { radius: 0.5, downbeats: 1, spin: "antispin" },
		convention: "charlie",
		rows: [
			[8, 6, 8, 1, "n", 7],
			[7, "n", 1, 2, 4, 6],
			[6, 4, 2, 3, "n", 5],
			[5, "n", 3, 4, 2, 4],
			[4, 2, 4, 5, "n", 3],
			[3, "n", 5, 6, 8, 2],
			[2, 8, 6, 7, "n", 1],
			[1, "n", 7, 8, 6, 8]
		]
	},
	{
		label: "triquetra, Charlie's convention",
		knobs: { radius: 1, downbeats: 2, spin: "antispin" },
		convention: "charlie",
		rows: [
			[8, 6, 8, 1, "n", 6],
			[6, "n", 1, 2, "n", 4],
			[4, "n", 2, 3, "n", 2],
			[2, "n", 3, 4, 6, 8],
			[8, 6, 4, 5, "n", 6],
			[6, "n", 5, 6, "n", 4],
			[4, "n", 6, 7, "n", 2],
			[2, "n", 7, 8, 6, 8]
		]
	}
];

describe("QfT model reproduces the published tables", () => {
	for (const c of CASES) {
		it(c.label, () => {
			expect(flatten(buildIncrements(c.knobs, c.convention))).toEqual(c.rows);
		});
	}
});

describe("the two conventions", () => {
	const cateye: QftKnobs = { radius: 0.5, downbeats: 1, spin: "antispin" };

	it("agree wherever Charlie's resolves", () => {
		const charlie = buildIncrements(cateye, "charlie");
		const drex = buildIncrements(cateye, "drex");
		charlie.forEach((row, i) => {
			if (row.propDirDepart !== "n") {
				expect(row.propDirDepart).toBe(drex[i].propDirDepart);
			}
		});
	});

	it("differ only in whether a value resolves at all", () => {
		const drex = buildIncrements(cateye, "drex");
		expect(drex.every((r) => r.propDirDepart !== "n")).toBe(true);
		expect(buildIncrements(cateye, "charlie").some((r) => r.propDirDepart === "n")).toBe(true);
	});
});

describe("inspin and antispin are indistinguishable by position alone", () => {
	const positions = (knobs: QftKnobs) =>
		buildIncrements(knobs, "drex").map((r) => r.propDepart);

	it("the two 4-petal flowers share every position", () => {
		expect(positions({ radius: 1, downbeats: 5, spin: "inspin" })).toEqual(
			positions({ radius: 1, downbeats: 3, spin: "antispin" })
		);
	});

	it("and are separated only by direction", () => {
		const inspin = buildIncrements({ radius: 1, downbeats: 5, spin: "inspin" }, "drex");
		const antispin = buildIncrements({ radius: 1, downbeats: 3, spin: "antispin" }, "drex");
		inspin.forEach((row, i) => {
			expect(row.propDirDepart).not.toBe(antispin[i].propDirDepart);
		});
	});
});

describe("a hand that does not travel has no bearing", () => {
	it("holds the hand column constant at radius 0", () => {
		for (const spin of ["inspin", "antispin"] as const) {
			const rows = buildIncrements({ radius: 0, downbeats: 1, spin }, "drex");
			expect(rows.map((r) => r.handDepart)).toEqual([8, 8, 8, 8, 8, 8, 8, 8]);
			expect(rows.map((r) => r.handArrive)).toEqual([8, 8, 8, 8, 8, 8, 8, 8]);
		}
	});

	it("still distinguishes the two spin directions by the prop column", () => {
		const inspin = buildIncrements({ radius: 0, downbeats: 1, spin: "inspin" }, "drex");
		const antispin = buildIncrements({ radius: 0, downbeats: 1, spin: "antispin" }, "drex");
		expect(inspin.map((r) => r.propDepart)).toEqual([8, 1, 2, 3, 4, 5, 6, 7]);
		expect(antispin.map((r) => r.propDepart)).toEqual([8, 7, 6, 5, 4, 3, 2, 1]);
	});

	it("leaves the hand travelling once there is a hand path", () => {
		const rows = buildIncrements({ radius: 0.5, downbeats: 1, spin: "inspin" }, "drex");
		expect(rows.map((r) => r.handDepart)).toEqual([8, 1, 2, 3, 4, 5, 6, 7]);
	});
});

describe("the petal count ignores radius, so naming must not", () => {
	const oneRotationAntispin = (radius: number) =>
		({ radius, downbeats: 1, spin: "antispin" }) as const;

	it("collapses to a line where the hand path equals the prop length", () => {
		const width = (radius: number) => {
			const xs = Array.from(
				{ length: 201 },
				(_, i) => posesAt(oneRotationAntispin(radius), (i / 200) * 8).head.x
			);
			return Math.max(...xs) - Math.min(...xs);
		};
		expect(width(1)).toBeCloseTo(0, 6);
		expect(width(0.9)).toBeCloseTo(0.2, 6);
		expect(width(1.1)).toBeCloseTo(0.2, 6);
	});

	it("reverses through the boundary rather than rotating", () => {
		const xAt = (radius: number) => posesAt(oneRotationAntispin(radius), 1).head.x;
		expect(xAt(0.9)).toBeLessThan(0);
		expect(xAt(1.1)).toBeGreaterThan(0);
		expect(xAt(0.9)).toBeCloseTo(-xAt(1.1), 6);
	});

	it("names the degenerate case a line, not a flower", () => {
		expect(nameFor(oneRotationAntispin(1)).label).toBe("Line");
		expect(nameFor(oneRotationAntispin(0.9)).label).toBe("2-petal antispin flower");
	});

	it("only the one-rotation antispin case degenerates", () => {
		expect(isDegenerateLine(oneRotationAntispin(1))).toBe(true);
		expect(isDegenerateLine({ radius: 1, downbeats: 2, spin: "antispin" })).toBe(false);
		expect(isDegenerateLine({ radius: 1, downbeats: 1, spin: "inspin" })).toBe(false);
	});
});

describe("pendulum", () => {
	it("draws the prop where the notation says it is", () => {
		buildPendulum().forEach((row, i) => {
			expect(pendulumIndexAt(i)).toBe(row.propDepart);
		});
	});

	it("swings back rather than rotating through", () => {
		expect(pendulumIndexAt(4)).toBe(6);
		expect(pendulumIndexAt(5)).toBeLessThan(6);
	});

	it("never reaches the upward positions", () => {
		const touched = new Set(buildPendulum().flatMap((r) => [r.propDepart, r.propArrive]));
		expect(touched.has(7)).toBe(false);
		expect(touched.has(8)).toBe(false);
		expect(touched.has(1)).toBe(false);
	});
});

describe("naming", () => {
	it("flags the article's moves as sourced", () => {
		expect(nameFor({ radius: 1, downbeats: 2, spin: "antispin" })).toEqual({
			label: "Triquetra",
			provenance: "sourced"
		});
	});

	it("flags extrapolated names as derived", () => {
		expect(nameFor({ radius: 1, downbeats: 6, spin: "antispin" })).toEqual({
			label: "7-petal antispin flower",
			provenance: "derived"
		});
	});

	it("matches the petal counts the article states", () => {
		expect(petalCount({ radius: 1, downbeats: 5, spin: "inspin" })).toBe(4);
		expect(petalCount({ radius: 1, downbeats: 3, spin: "antispin" })).toBe(4);
		expect(petalCount({ radius: 1, downbeats: 2, spin: "antispin" })).toBe(3);
		expect(petalCount({ radius: 0.5, downbeats: 1, spin: "antispin" })).toBe(2);
		expect(petalCount({ radius: 1, downbeats: 1, spin: "inspin" })).toBe(0);
	});
});

describe("norm", () => {
	it("puts zero at the top of the compass, not at zero", () => {
		expect(norm(0)).toBe(8);
		expect(norm(8)).toBe(8);
		expect(norm(-2)).toBe(6);
		expect(norm(11)).toBe(3);
	});
});
