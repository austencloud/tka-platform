export type MandalaVariant = "blue" | "red" | "full";

export interface MandalaPlacement {
	row: number;
	col: number;
	variant: MandalaVariant;
}

export interface MandalaLayoutOverride {
	cols: number;
	rows: number;
	startPos: { col: number; row: number };
	qrPos: { col: number; row: number };
	stepPositions: { col: number; row: number }[];
}

export interface GetMandalaPlacementsArgs {
	stepCount: number;
	cols: number;
	rows: number;
	includeStartPosition: boolean;
	showQRCode: boolean;
	blueVisible: boolean;
	redVisible: boolean;
	mandalaEnabled: boolean;
	/** Where the info cells live. "column" → mandalas stack vertically in col 1.
	 *  "row" → mandalas lay out horizontally across the top row. */
	startPositionLayout?: "row" | "column";
}

export interface GetMandalaPlacementsResult {
	placements: MandalaPlacement[];
	layoutOverride: MandalaLayoutOverride | null;
}

const EMPTY: GetMandalaPlacementsResult = { placements: [], layoutOverride: null };

export function getMandalaPlacements(args: GetMandalaPlacementsArgs): GetMandalaPlacementsResult {
	const {
		stepCount,
		cols,
		rows,
		includeStartPosition,
		showQRCode,
		blueVisible,
		redVisible,
		mandalaEnabled,
		startPositionLayout = "column",
	} = args;

	if (!mandalaEnabled) return EMPTY;
	if (!includeStartPosition) return EMPTY;
	if (!blueVisible && !redVisible) return EMPTY;

	// 4-count horizontal metadata row only applies when QR needs a home
	// AND the user has selected column layout (the override reshapes the
	// grid into a horizontal info row). In row layout the info row already
	// spans the top, so the generic row-mode logic below handles it.
	if (stepCount === 4 && showQRCode && startPositionLayout === "column") {
		return buildFourCountHorizontal(blueVisible, redVisible);
	}

	if (startPositionLayout === "row") {
		// Row layout: info cells live in row 1 between start (col 1) and QR (col `cols`).
		// When QR is off, the trailing cell is also empty and joins the span.
		if (cols < 2) return EMPTY;
		const leftCol = 2;
		const rightCol = showQRCode ? cols - 1 : cols;
		const emptyCount = rightCol - leftCol + 1;
		if (emptyCount < 1) return EMPTY;

		const variants = chooseVariantSequence(emptyCount, blueVisible, redVisible);
		if (variants.length === 0) return EMPTY;

		const startCol = leftCol + Math.floor((emptyCount - variants.length) / 2);
		const placements: MandalaPlacement[] = variants.map((variant, i) => ({
			row: 1,
			col: startCol + i,
			variant,
		}));
		return { placements, layoutOverride: null };
	}

	// Column layout: col 1 runs start (row 1) → empties → QR (row `rows`).
	// When QR is off, the bottom cell is also empty and joins the span.
	if (rows < 2) return EMPTY;
	const topRow = 2;
	const bottomRow = showQRCode ? rows - 1 : rows;
	const emptyCount = bottomRow - topRow + 1;
	if (emptyCount < 1) return EMPTY;

	void cols;

	const variants = chooseVariantSequence(emptyCount, blueVisible, redVisible);
	if (variants.length === 0) return EMPTY;

	const startRow = topRow + Math.floor((emptyCount - variants.length) / 2);
	const placements: MandalaPlacement[] = variants.map((variant, i) => ({
		row: startRow + i,
		col: 1,
		variant,
	}));

	return { placements, layoutOverride: null };
}

function chooseVariantSequence(
	emptyCount: number,
	blueVisible: boolean,
	redVisible: boolean,
): MandalaVariant[] {
	if (!redVisible && blueVisible) return ["blue"];
	if (!blueVisible && redVisible) return ["red"];

	if (emptyCount === 1) return ["full"];
	if (emptyCount === 2) return ["blue", "red"];
	if (emptyCount >= 3) return ["blue", "full", "red"];
	return [];
}

function buildFourCountHorizontal(
	blueVisible: boolean,
	redVisible: boolean,
): GetMandalaPlacementsResult {
	const placements: MandalaPlacement[] = [];
	if (blueVisible && redVisible) {
		placements.push({ row: 1, col: 2, variant: "blue" });
		placements.push({ row: 1, col: 3, variant: "red" });
	} else if (blueVisible) {
		placements.push({ row: 1, col: 2, variant: "blue" });
	} else if (redVisible) {
		placements.push({ row: 1, col: 3, variant: "red" });
	}

	const layoutOverride: MandalaLayoutOverride = {
		cols: 4,
		rows: 2,
		startPos: { col: 1, row: 1 },
		qrPos: { col: 4, row: 1 },
		stepPositions: [
			{ col: 1, row: 2 },
			{ col: 2, row: 2 },
			{ col: 3, row: 2 },
			{ col: 4, row: 2 },
		],
	};

	return { placements, layoutOverride };
}
