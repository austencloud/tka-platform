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
		startPositionLayout = "row",
	} = args;

	if (!mandalaEnabled) return EMPTY;
	if (!includeStartPosition) return EMPTY;
	if (!blueVisible && !redVisible) return EMPTY;
	if (stepCount < 4) return EMPTY;

	if (startPositionLayout === "row") {
		// Info cells live in row 1 between start (col 1) and QR (col `cols`).
		if (cols < 2) return EMPTY;
		const leftCol = 2;
		const rightCol = showQRCode ? cols - 1 : cols;
		const emptyCount = rightCol - leftCol + 1;
		if (emptyCount < 1) return EMPTY;

		// Anchored: blue → leftmost slot, red → rightmost slot. Never migrate when one is toggled off.
		return { placements: buildRowPlacements(emptyCount, leftCol, rightCol, blueVisible, redVisible), layoutOverride: null };
	}

	// Column layout: col 1 runs start (row 1) → empties → QR (row `rows`).
	if (rows < 2) return EMPTY;
	const topRow = 2;
	const bottomRow = showQRCode ? rows - 1 : rows;
	const emptyCount = bottomRow - topRow + 1;
	if (emptyCount < 1) return EMPTY;

	void cols;

	// Anchored: blue → topmost slot, red → bottommost slot. Never migrate when one is toggled off.
	return { placements: buildColumnPlacements(emptyCount, topRow, bottomRow, blueVisible, redVisible), layoutOverride: null };
}

function buildRowPlacements(
	emptyCount: number,
	leftCol: number,
	rightCol: number,
	blueVisible: boolean,
	redVisible: boolean,
): MandalaPlacement[] {
	if (blueVisible && redVisible) {
		if (emptyCount === 1) return [{ row: 1, col: leftCol, variant: "full" }];
		if (emptyCount === 2) return [
			{ row: 1, col: leftCol, variant: "blue" },
			{ row: 1, col: rightCol, variant: "red" },
		];
		return [
			{ row: 1, col: leftCol, variant: "blue" },
			{ row: 1, col: leftCol + 1, variant: "full" },
			{ row: 1, col: leftCol + 2, variant: "red" },
		];
	}
	if (blueVisible) return [{ row: 1, col: leftCol, variant: "blue" }];
	return [{ row: 1, col: leftCol, variant: "red" }];
}

function buildColumnPlacements(
	emptyCount: number,
	topRow: number,
	bottomRow: number,
	blueVisible: boolean,
	redVisible: boolean,
): MandalaPlacement[] {
	if (blueVisible && redVisible) {
		if (emptyCount === 1) return [{ row: topRow, col: 1, variant: "full" }];
		if (emptyCount === 2) return [
			{ row: topRow, col: 1, variant: "blue" },
			{ row: bottomRow, col: 1, variant: "red" },
		];
		return [
			{ row: topRow, col: 1, variant: "blue" },
			{ row: topRow + 1, col: 1, variant: "full" },
			{ row: topRow + 2, col: 1, variant: "red" },
		];
	}
	if (blueVisible) return [{ row: topRow, col: 1, variant: "blue" }];
	return [{ row: topRow, col: 1, variant: "red" }];
}
