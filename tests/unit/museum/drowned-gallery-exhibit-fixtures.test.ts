import { describe, expect, it } from "vitest";
import {
	buildDrownedGalleryLayout,
	CAUSEWAY_Y,
	SHELF_Y,
	inRectClosed,
	type ExhibitFixture,
	type WorldRect,
} from "$lib/features/museum/data/drowned-gallery-terrain";
import { buildVulcanCaveFloorPlan } from "$lib/features/museum/data/vulcan-cave-floor-plan";

const layout = buildDrownedGalleryLayout(buildVulcanCaveFloorPlan().grid)!;
const byId = (id: string): ExhibitFixture => {
	const found = layout.exhibitFixtures.find((fixture) => fixture.id === id);
	if (!found) throw new Error(`no fixture ${id}`);
	return found;
};

const footprint = (fixture: ExhibitFixture): WorldRect => ({
	minX: fixture.centre.x - fixture.size.x / 2,
	maxX: fixture.centre.x + fixture.size.x / 2,
	minZ: fixture.centre.z - fixture.size.z / 2,
	maxZ: fixture.centre.z + fixture.size.z / 2,
});

const corners = (rect: WorldRect): [number, number][] => [
	[rect.minX, rect.minZ],
	[rect.maxX, rect.minZ],
	[rect.minX, rect.maxZ],
	[rect.maxX, rect.maxZ],
];

describe("drowned gallery exhibit fixtures", () => {
	it("declares one showcase, screen and card per case, plus the opener pair", () => {
		const kinds = layout.exhibitFixtures.map((fixture) => fixture.kind);
		expect(kinds.filter((kind) => kind === "case-showcase")).toHaveLength(3);
		expect(kinds.filter((kind) => kind === "case-screen")).toHaveLength(3);
		expect(kinds.filter((kind) => kind === "case-card")).toHaveLength(3);
		expect(kinds.filter((kind) => kind === "opener-dais")).toHaveLength(1);
		expect(kinds.filter((kind) => kind === "opener-plinth")).toHaveLength(1);
	});

	it("puts each showcase exactly on its alcove anchor, on the shelf", () => {
		["AAAA", "BBBB", "CCCC"].forEach((word, index) => {
			const showcase = byId(`case-showcase-${word}`);
			expect(showcase.centre.x).toBeCloseTo(layout.alcoves[index].x, 6);
			expect(showcase.centre.z).toBeCloseTo(layout.alcoves[index].z, 6);
			expect(showcase.baseY).toBe(SHELF_Y);
			expect(showcase.caseWord).toBe(word);
		});
	});

	it("keeps every card sign inside the procession and off the shelf", () => {
		for (const word of ["AAAA", "BBBB", "CCCC"]) {
			const card = byId(`case-card-${word}`);
			expect(card.baseY).toBe(CAUSEWAY_Y);
			for (const [x, z] of corners(footprint(card))) {
				expect(inRectClosed(layout.procession, x, z)).toBe(true);
			}
		}
	});

	it("leaves at least 1.6 m of clear walking width behind the card signs", () => {
		for (const word of ["AAAA", "BBBB", "CCCC"]) {
			const card = byId(`case-card-${word}`);
			const clear = layout.procession.maxZ - footprint(card).maxZ;
			expect(clear).toBeGreaterThanOrEqual(1.6);
		}
	});

	it("stands the opener on the apron without blocking the corridor mouth", () => {
		for (const id of ["opener-dais", "opener-plinth"]) {
			for (const [x, z] of corners(footprint(byId(id)))) {
				expect(inRectClosed(layout.apron, x, z)).toBe(true);
			}
			expect(byId(id).baseY).toBe(CAUSEWAY_Y);
		}
		// The corridor arrives on the apron's east half; the opener sits west of it.
		expect(byId("opener-dais").centre.x).toBeLessThan(12.25);
	});

	it("never places a fixture inside the channel or the pool", () => {
		for (const fixture of layout.exhibitFixtures) {
			for (const [x, z] of corners(footprint(fixture))) {
				expect(inRectClosed(layout.channel, x, z)).toBe(false);
				expect(inRectClosed(layout.pool, x, z)).toBe(false);
			}
		}
	});
});
