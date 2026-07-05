/**
 * Grid Column Breakpoints — single source of truth
 *
 * The browse grid's column limits live HERE and nowhere else. Three consumers
 * had drifted copies of this logic (the engine, grid-zoom-state, and the
 * pinch/scroll controller), so a cap bump in one left the others stuck — which
 * is exactly how Ctrl+scroll stayed pinned at 5 columns on a 4K screen after
 * the other copy was raised. Import from here; don't re-declare.
 */

/** Smallest column count any surface may shrink to. */
export const MIN_COLUMNS = 2;

/**
 * Per-breakpoint maximum columns. Keyed on the grid's available width
 * (container width where the consumer tracks it, viewport width otherwise),
 * so cards stay readable on phones while wide/4K screens densify to 7.
 */
export function getMaxColumnsForWidth(width: number): number {
	if (width < 480) return 2;
	if (width < 800) return 3;
	if (width < 1200) return 4;
	if (width < 1600) return 5;
	if (width < 2100) return 6;
	if (width < 2800) return 7;
	return 8;
}

/**
 * Default column count for a user who has never chosen a zoom level (e.g.
 * signed-out guests). Mirrors the max so a fresh 4K visitor opens dense
 * instead of stuck at 2 columns with huge, sparse cards.
 */
export function getDefaultColumnsForWidth(width: number): number {
	return getMaxColumnsForWidth(width);
}

/**
 * Effective render column count = the user's DESIRED density clamped to what
 * the current width allows. Purely derived — it must NEVER be written back over
 * `desired`. That separation is the whole fix for the "4K stuck at 2 huge
 * columns" bug: a narrow viewport (F12 mobile simulator, a phone) clamps the
 * VISIBLE count down without touching the stored desire, so widening the
 * viewport re-expands to the desired count instead of pinning at the clamp.
 *
 * @param desired the persisted density the user wants (may exceed width max)
 * @param width   current container/viewport width
 * @param min     smallest allowed count (surfaces may raise the floor)
 */
export function clampColumnsToWidth(
	desired: number,
	width: number,
	min: number = MIN_COLUMNS,
): number {
	return Math.max(min, Math.min(getMaxColumnsForWidth(width), desired));
}
