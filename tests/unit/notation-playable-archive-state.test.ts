import { describe, expect, it } from "vitest";
import {
	closeDetail,
	initialState,
	openDetail,
	select,
} from "../../src/routes/test/notation-playable/_lib/archive-state";

const COUNT = 9;

describe("playable archive state", () => {
	it("starts with the first entry active and discovered", () => {
		const s = initialState(COUNT);
		expect(s.activeIndex).toBe(0);
		expect(s.visited.size).toBe(1);
		expect(s.visited.has(0)).toBe(true);
		expect(s.detailOpen).toBe(false);
		expect(s.celebrated).toBe(false);
	});

	it("selecting a new entry marks it visited exactly once", () => {
		let s = initialState(COUNT);
		const first = select(s, 3, COUNT);
		expect(first.firstVisit).toBe(true);
		expect(first.state.visited.size).toBe(2);

		const again = select(first.state, 3, COUNT);
		expect(again.firstVisit).toBe(false);
		expect(again.state.visited.size).toBe(2);
	});

	it("clamps out-of-range selection instead of corrupting the index", () => {
		const s = initialState(COUNT);
		expect(select(s, -4, COUNT).state.activeIndex).toBe(0);
		expect(select(s, 99, COUNT).state.activeIndex).toBe(COUNT - 1);
	});

	it("completes exactly once, on the visit that fills the set", () => {
		let s = initialState(COUNT);
		for (let i = 1; i < COUNT - 1; i++) {
			const r = select(s, i, COUNT);
			expect(r.justCompleted).toBe(false);
			s = r.state;
		}
		const finalVisit = select(s, COUNT - 1, COUNT);
		expect(finalVisit.justCompleted).toBe(true);
		expect(finalVisit.state.celebrated).toBe(true);

		// Revisits after completion never re-fire the flourish.
		const after = select(finalVisit.state, 0, COUNT);
		expect(after.justCompleted).toBe(false);
	});

	it("detail open and close are idempotent", () => {
		const s = initialState(COUNT);
		const open = openDetail(s);
		expect(open.detailOpen).toBe(true);
		expect(openDetail(open)).toBe(open);
		const closed = closeDetail(open);
		expect(closed.detailOpen).toBe(false);
		expect(closeDetail(closed)).toBe(closed);
	});
});
