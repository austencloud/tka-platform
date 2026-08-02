/**
 * Pure state transitions for the playable archive rail.
 *
 * Extracted so the visited count, active index, and the one-shot completion
 * flag can be unit tested, so a wrong discovered count or a completion
 * flourish that fires twice would be a silent bug
 * (docs/superpowers/specs/2026-07-27-notation-playable-archive-design.md).
 */

export interface ArchiveState {
	/** Index of the entry on stage. Always valid for the given count. */
	activeIndex: number;
	/** Entry indexes seen this session. Session-local discovery, never persisted. */
	visited: ReadonlySet<number>;
	/** Detail surface open for the active entry. */
	detailOpen: boolean;
	/** The full-set flourish has already played, and it plays exactly once. */
	celebrated: boolean;
}

export interface SelectResult {
	state: ArchiveState;
	/** This selection discovered the entry for the first time. */
	firstVisit: boolean;
	/** This selection completed the set, so play the single flourish now. */
	justCompleted: boolean;
}

/** The first artifact is live on stage at load, so it counts as discovered. */
export function initialState(count: number, startIndex = 0): ArchiveState {
	const activeIndex = clampIndex(startIndex, count);
	return {
		activeIndex,
		visited: new Set([activeIndex]),
		detailOpen: false,
		celebrated: false,
	};
}

function clampIndex(index: number, count: number): number {
	if (count <= 0) return 0;
	return Math.min(Math.max(Math.trunc(index), 0), count - 1);
}

export function select(state: ArchiveState, index: number, count: number): SelectResult {
	const next = clampIndex(index, count);
	const firstVisit = !state.visited.has(next);
	const visited = firstVisit ? new Set([...state.visited, next]) : state.visited;
	const justCompleted = firstVisit && !state.celebrated && visited.size === count;
	return {
		state: {
			...state,
			activeIndex: next,
			visited,
			celebrated: state.celebrated || justCompleted,
		},
		firstVisit,
		justCompleted,
	};
}

export function openDetail(state: ArchiveState): ArchiveState {
	return state.detailOpen ? state : { ...state, detailOpen: true };
}

export function closeDetail(state: ArchiveState): ArchiveState {
	return state.detailOpen ? { ...state, detailOpen: false } : state;
}
