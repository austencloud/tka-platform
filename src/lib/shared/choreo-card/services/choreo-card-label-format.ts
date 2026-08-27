// Pure display-label formatters for choreo card badges. No component state, no
// reactivity, no Svelte specifics — safe to unit-test in isolation. Extracted
// verbatim from ChoreoCard.svelte (Phase 1: pure-helper extraction). The badge
// rendering still passes these down as callback props, so behavior is unchanged.

/** Format turns for the solo-mode bottom-left badge. "fl" stays "fl".
 *  Returns empty string for 0 turns so the overlay stays hidden. */
export function formatSoloTurns(turns: number | "fl" | undefined | null): string {
	if (turns === undefined || turns === null) return "";
	if (turns === "fl") return "fl";
	if (turns === 0) return "";
	return turns.toString();
}

/** Short-form orientation label. Level 1-3 are "in", "out", "cl", "cn".
 *  Level 4 interradials collapse to 2-char forms. Returns null if unknown. */
export function shortOrientation(ori: string | undefined | null): string | null {
	if (!ori) return null;
	switch (ori) {
		case "in": return "in";
		case "out": return "out";
		case "clock": return "cl";
		case "counter": return "cn";
		case "clock_in": return "cli";
		case "clock_out": return "clo";
		case "counter_in": return "cni";
		case "counter_out": return "cno";
		default: return ori.length <= 3 ? ori : ori.slice(0, 3);
	}
}

/** Format duration for badge display (e.g., 2 → "2×", 1.25 → "1.25×") */
export function formatDuration(d: number): string {
	return Number.isInteger(d) ? `${d}×` : `${d}×`;
}
