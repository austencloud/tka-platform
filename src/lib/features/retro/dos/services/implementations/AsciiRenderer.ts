/**
 * AsciiRenderer -- ASCII art pictograph renderer for the DOS terminal
 *
 * Converts RetroPictographData into character art using a 2D character
 * buffer. The diamond grid is ~21 chars wide and ~11 lines tall. The
 * box grid is ~21 chars wide and ~9 lines tall. Both use the same
 * position-to-coordinate mapping, rotated 45 degrees for box mode.
 *
 * Rendering pipeline:
 *   1. Allocate a 2D char buffer (plain characters + parallel color buffer)
 *   2. Stamp the grid skeleton (axes, center marker, position dots)
 *   3. Overlay hand markers (B/R/X) with color
 *   4. Draw motion arrows between start and end locations
 *   5. Add orientation indicators near hand positions
 *   6. Convert to HTML strings with <span> color tags
 *
 * Pure function: no DOM, no state, no side effects. Data in, strings out.
 *
 * Domain: Retro DOS Era
 */

import type { IAsciiRenderer } from "../contracts/IAsciiRenderer";
import type {
	RetroPictographData,
	RetroHandData,
} from "../../../shared/domain/pictograph-types";
import {
	GridLocation,
	GridMode,
	MotionType,
	MotionColor,
	Orientation,
} from "../../../shared/domain/pictograph-types";

// ============================================================================
// CONSTANTS
// ============================================================================

/** Buffer width for the rendered pictograph */
const BUFFER_WIDTH = 23;

/** Buffer height for diamond grid */
const DIAMOND_HEIGHT = 13;

/** Buffer height for box grid */
const BOX_HEIGHT = 11;

/** CSS class names for terminal colors */
const COLOR_BLUE = "dos-blue";
const COLOR_RED = "dos-red";
const COLOR_CYAN = "dos-cyan";
const COLOR_GREEN = "dos-green";
const COLOR_GRAY = "dos-gray";
const COLOR_WHITE = "dos-white";

// ============================================================================
// CELL TYPE: character + optional color
// ============================================================================

interface Cell {
	char: string;
	color: string | null;
}

function emptyCell(): Cell {
	return { char: " ", color: null };
}

// ============================================================================
// GRID COORDINATE MAPS
//
// Each GridLocation maps to a (col, row) position in the character buffer.
// Diamond mode: cardinals on axes, intercardinals on diagonals.
// Box mode: intercardinals on axes, cardinals on diagonals (rotated 45deg).
// ============================================================================

interface GridCoord {
	readonly col: number;
	readonly row: number;
}

const DIAMOND_COORDS: Record<GridLocation, GridCoord> = {
	[GridLocation.NORTH]: { col: 11, row: 0 },
	[GridLocation.NORTHEAST]: { col: 17, row: 2 },
	[GridLocation.EAST]: { col: 21, row: 6 },
	[GridLocation.SOUTHEAST]: { col: 17, row: 10 },
	[GridLocation.SOUTH]: { col: 11, row: 12 },
	[GridLocation.SOUTHWEST]: { col: 5, row: 10 },
	[GridLocation.WEST]: { col: 1, row: 6 },
	[GridLocation.NORTHWEST]: { col: 5, row: 2 },
	[GridLocation.CENTER]: { col: 11, row: 6 },
};

const BOX_COORDS: Record<GridLocation, GridCoord> = {
	[GridLocation.NORTH]: { col: 11, row: 2 },
	[GridLocation.NORTHEAST]: { col: 19, row: 0 },
	[GridLocation.EAST]: { col: 19, row: 5 },
	[GridLocation.SOUTHEAST]: { col: 19, row: 10 },
	[GridLocation.SOUTH]: { col: 11, row: 8 },
	[GridLocation.SOUTHWEST]: { col: 3, row: 10 },
	[GridLocation.WEST]: { col: 3, row: 5 },
	[GridLocation.NORTHWEST]: { col: 3, row: 0 },
	[GridLocation.CENTER]: { col: 11, row: 5 },
};

// ============================================================================
// MOTION ARROW CHARACTERS
//
// Arrow glyphs for indicating direction of motion between start and end
// positions. Selected based on the vector from start to end in the buffer.
// ============================================================================

function getArrowChar(dx: number, dy: number): string {
	// Normalize to unit direction
	const absDx = Math.abs(dx);
	const absDy = Math.abs(dy);

	if (absDx === 0 && absDy === 0) return " ";

	// Determine dominant direction
	if (absDy > absDx * 2) {
		// Primarily vertical
		return dy > 0 ? "v" : "^";
	} else if (absDx > absDy * 2) {
		// Primarily horizontal
		return dx > 0 ? ">" : "<";
	} else {
		// Diagonal
		if (dx > 0 && dy < 0) return "/";
		if (dx < 0 && dy > 0) return "/";
		if (dx > 0 && dy > 0) return "\\";
		if (dx < 0 && dy < 0) return "\\";
	}
	return "*";
}

// ============================================================================
// ORIENTATION INDICATOR
//
// A single character placed adjacent to the hand marker showing which
// direction the prop (staff) points.
// ============================================================================

function getOrientationChar(
	orientation: Orientation,
	location: GridLocation,
): string {
	switch (orientation) {
		case Orientation.IN:
		case Orientation.OUT: {
			// Radial: show direction based on position relative to center
			const radialAngle = getRadialAngle(location);
			const effectiveAngle =
				orientation === Orientation.OUT ? radialAngle : radialAngle + Math.PI;
			return angleToLineChar(effectiveAngle);
		}
		case Orientation.CLOCK:
		case Orientation.COUNTER: {
			const radialAngle = getRadialAngle(location);
			const offset =
				orientation === Orientation.CLOCK ? Math.PI / 2 : -Math.PI / 2;
			return angleToLineChar(radialAngle + offset);
		}
		case Orientation.CLOCK_IN:
			return angleToLineChar(getRadialAngle(location) + (Math.PI * 3) / 4);
		case Orientation.CLOCK_OUT:
			return angleToLineChar(getRadialAngle(location) + Math.PI / 4);
		case Orientation.COUNTER_IN:
			return angleToLineChar(getRadialAngle(location) - (Math.PI * 3) / 4);
		case Orientation.COUNTER_OUT:
			return angleToLineChar(getRadialAngle(location) - Math.PI / 4);
		case Orientation.CENTER_N:
		case Orientation.CENTER_S:
			return "|";
		case Orientation.CENTER_E:
		case Orientation.CENTER_W:
			return "-";
		case Orientation.CENTER_NE:
		case Orientation.CENTER_SW:
			return "/";
		case Orientation.CENTER_NW:
		case Orientation.CENTER_SE:
			return "\\";
		default:
			return "|";
	}
}

/** Angle from center outward for each grid location (radians, 0=right) */
function getRadialAngle(location: GridLocation): number {
	const angles: Record<GridLocation, number> = {
		[GridLocation.NORTH]: -Math.PI / 2,
		[GridLocation.NORTHEAST]: -Math.PI / 4,
		[GridLocation.EAST]: 0,
		[GridLocation.SOUTHEAST]: Math.PI / 4,
		[GridLocation.SOUTH]: Math.PI / 2,
		[GridLocation.SOUTHWEST]: (3 * Math.PI) / 4,
		[GridLocation.WEST]: Math.PI,
		[GridLocation.NORTHWEST]: (-3 * Math.PI) / 4,
		[GridLocation.CENTER]: 0,
	};
	return angles[location];
}

/** Convert an angle to the nearest line-drawing character */
function angleToLineChar(angle: number): string {
	// Normalize to [0, 2pi)
	const a = ((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
	// Quantize to 4 directions (0, pi/4, pi/2, 3pi/4)
	// Vertical axis = |, horizontal = -, forward diag = /, back diag = \
	const sector = Math.round((a * 4) / Math.PI) % 8;
	switch (sector) {
		case 0:
		case 4:
			return "-";
		case 1:
		case 5:
			return "\\";
		case 2:
		case 6:
			return "|";
		case 3:
		case 7:
			return "/";
		default:
			return "|";
	}
}

// ============================================================================
// LABEL HELPERS
// ============================================================================

/** Abbreviation for grid locations shown as position labels */
const LOCATION_LABELS: Record<GridLocation, string> = {
	[GridLocation.NORTH]: "N",
	[GridLocation.NORTHEAST]: "NE",
	[GridLocation.EAST]: "E",
	[GridLocation.SOUTHEAST]: "SE",
	[GridLocation.SOUTH]: "S",
	[GridLocation.SOUTHWEST]: "SW",
	[GridLocation.WEST]: "W",
	[GridLocation.NORTHWEST]: "NW",
	[GridLocation.CENTER]: "o",
};

/** Abbreviation for motion types */
const MOTION_LABELS: Record<MotionType, string> = {
	[MotionType.PRO]: "pro",
	[MotionType.ANTI]: "anti",
	[MotionType.DASH]: "dash",
	[MotionType.FLOAT]: "flt",
	[MotionType.STATIC]: "stc",
};

// ============================================================================
// ASCII RENDERER IMPLEMENTATION
// ============================================================================

export class AsciiRenderer implements IAsciiRenderer {
	renderPictograph(data: RetroPictographData): string[] {
		const isBox = data.gridMode === GridMode.BOX;
		const coords = isBox ? BOX_COORDS : DIAMOND_COORDS;
		const height = isBox ? BOX_HEIGHT : DIAMOND_HEIGHT;

		// Step 1: Allocate buffer
		const buffer = this.createBuffer(BUFFER_WIDTH, height);

		// Step 2: Draw grid skeleton
		if (isBox) {
			this.drawBoxGrid(buffer, height);
		} else {
			this.drawDiamondGrid(buffer, height);
		}

		// Step 3: Place center marker
		const center = coords[GridLocation.CENTER];
		this.setCell(buffer, center.col, center.row, "o", COLOR_WHITE);

		// Step 4: Place position dots at empty grid points
		this.placePositionDots(buffer, coords, data);

		// Step 5: Overlay hand markers
		this.placeHand(buffer, data.blueHand, coords);
		this.placeHand(buffer, data.redHand, coords);

		// Step 6: Handle overlapping hands (both at same position)
		this.markOverlaps(buffer, data, coords);

		// Step 7: Draw motion arrows
		if (data.blueHand.motionType !== MotionType.STATIC) {
			this.drawMotionPath(buffer, data.blueHand, coords);
		}
		if (data.redHand.motionType !== MotionType.STATIC) {
			this.drawMotionPath(buffer, data.redHand, coords);
		}

		// Step 8: Place orientation indicators
		this.placeOrientation(buffer, data.blueHand, coords, BUFFER_WIDTH, height);
		this.placeOrientation(buffer, data.redHand, coords, BUFFER_WIDTH, height);

		// Step 9: Convert to HTML lines
		return this.bufferToHtml(buffer, height);
	}

	renderPlaceholder(): string[] {
		const height = DIAMOND_HEIGHT;
		const buffer = this.createBuffer(BUFFER_WIDTH, height);

		this.drawDiamondGrid(buffer, height);

		// Place "?" at center
		const center = DIAMOND_COORDS[GridLocation.CENTER];
		this.setCell(buffer, center.col, center.row, "?", COLOR_GRAY);

		// Place dots at all cardinal/intercardinal positions
		const allPositions: GridLocation[] = [
			GridLocation.NORTH,
			GridLocation.NORTHEAST,
			GridLocation.EAST,
			GridLocation.SOUTHEAST,
			GridLocation.SOUTH,
			GridLocation.SOUTHWEST,
			GridLocation.WEST,
			GridLocation.NORTHWEST,
		];
		for (const loc of allPositions) {
			const coord = DIAMOND_COORDS[loc];
			this.setCell(buffer, coord.col, coord.row, ".", COLOR_GRAY);
		}

		return this.bufferToHtml(buffer, height);
	}

	renderCompact(data: RetroPictographData): string {
		const blue = data.blueHand;
		const red = data.redHand;

		const bLoc = LOCATION_LABELS[blue.location];
		const bEnd = LOCATION_LABELS[blue.endLocation];
		const bMot = MOTION_LABELS[blue.motionType];

		const rLoc = LOCATION_LABELS[red.location];
		const rEnd = LOCATION_LABELS[red.endLocation];
		const rMot = MOTION_LABELS[red.motionType];

		const bPart =
			blue.motionType === MotionType.STATIC
				? `<span class="${COLOR_BLUE}">B:${bLoc} ${bMot}</span>`
				: `<span class="${COLOR_BLUE}">B:${bLoc}>${bEnd} ${bMot}</span>`;

		const rPart =
			red.motionType === MotionType.STATIC
				? `<span class="${COLOR_RED}">R:${rLoc} ${rMot}</span>`
				: `<span class="${COLOR_RED}">R:${rLoc}>${rEnd} ${rMot}</span>`;

		return `[${bPart} | ${rPart}]`;
	}

	// ========================================================================
	// BUFFER MANAGEMENT
	// ========================================================================

	private createBuffer(width: number, height: number): Cell[][] {
		const buffer: Cell[][] = [];
		for (let row = 0; row < height; row++) {
			const line: Cell[] = [];
			for (let col = 0; col < width; col++) {
				line.push(emptyCell());
			}
			buffer.push(line);
		}
		return buffer;
	}

	private setCell(
		buffer: Cell[][],
		col: number,
		row: number,
		char: string,
		color: string | null,
	): void {
		if (row >= 0 && row < buffer.length && col >= 0 && col < buffer[0]!.length) {
			buffer[row]![col] = { char, color };
		}
	}

	private getCell(buffer: Cell[][], col: number, row: number): Cell | null {
		if (row >= 0 && row < buffer.length && col >= 0 && col < buffer[0]!.length) {
			return buffer[row]![col]!;
		}
		return null;
	}

	// ========================================================================
	// DIAMOND GRID SKELETON
	//
	// Layout (13 rows, 23 cols):
	//
	//  Row 0:            N                  col 11
	//  Row 1:            |
	//  Row 2:      NW  . + .  NE            cols 5, 8, 11, 14, 17
	//  Row 3:        \   |   /
	//  Row 4:         \  |  /
	//  Row 5:          \ | /
	//  Row 6:  W ------[o]------ E          col 1..21
	//  Row 7:          / | \
	//  Row 8:         /  |  \
	//  Row 9:        /   |   \
	//  Row 10:     SW  . + .  SE            cols 5, 8, 11, 14, 17
	//  Row 11:           |
	//  Row 12:           S                  col 11
	// ========================================================================

	private drawDiamondGrid(buffer: Cell[][], _height: number): void {
		// Vertical axis (N-S through center)
		for (const row of [1, 2, 3, 4, 5, 7, 8, 9, 10, 11]) {
			this.setCell(buffer, 11, row, "|", COLOR_GRAY);
		}

		// Horizontal axis (W-E through center)
		for (let col = 2; col <= 20; col++) {
			if (col === 11) continue; // center handled separately
			this.setCell(buffer, col, 6, "-", COLOR_GRAY);
		}

		// NW-SE diagonal (from NW at row 2,col 5 to SE at row 10,col 17)
		// Steps: row 3-5 going right from col 6..10, row 7-9 going right from col 12..16
		this.setCell(buffer, 7, 3, "\\", COLOR_GRAY);
		this.setCell(buffer, 8, 4, "\\", COLOR_GRAY);
		this.setCell(buffer, 9, 5, "\\", COLOR_GRAY);
		this.setCell(buffer, 13, 7, "\\", COLOR_GRAY);
		this.setCell(buffer, 14, 8, "\\", COLOR_GRAY);
		this.setCell(buffer, 15, 9, "\\", COLOR_GRAY);

		// NE-SW diagonal (from NE at row 2,col 17 to SW at row 10,col 5)
		this.setCell(buffer, 15, 3, "/", COLOR_GRAY);
		this.setCell(buffer, 14, 4, "/", COLOR_GRAY);
		this.setCell(buffer, 13, 5, "/", COLOR_GRAY);
		this.setCell(buffer, 9, 7, "/", COLOR_GRAY);
		this.setCell(buffer, 8, 8, "/", COLOR_GRAY);
		this.setCell(buffer, 7, 9, "/", COLOR_GRAY);

		// Cross markers on axes (midpoints between center and cardinal/intercardinal)
		this.setCell(buffer, 8, 2, ".", COLOR_GRAY);
		this.setCell(buffer, 14, 2, ".", COLOR_GRAY);
		this.setCell(buffer, 8, 10, ".", COLOR_GRAY);
		this.setCell(buffer, 14, 10, ".", COLOR_GRAY);
	}

	// ========================================================================
	// BOX GRID SKELETON
	//
	// Layout (11 rows, 23 cols):
	//
	//  Row 0:  NW ----------- NE            cols 3..19
	//  Row 1:    |  \     /  |
	//  Row 2:    |   N   N   |              (N at col 11, row 2)
	//  Row 3:    |    \ /    |
	//  Row 4:    |     X     |
	//  Row 5:  W |----[o]----| E            col 3..19
	//  Row 6:    |     X     |
	//  Row 7:    |    / \    |
	//  Row 8:    |   S   S   |              (S at col 11, row 8)
	//  Row 9:    |  /     \  |
	//  Row 10: SW ----------- SE            cols 3..19
	// ========================================================================

	private drawBoxGrid(buffer: Cell[][], _height: number): void {
		// Top edge (NW to NE)
		for (let col = 4; col <= 18; col++) {
			this.setCell(buffer, col, 0, "-", COLOR_GRAY);
		}

		// Bottom edge (SW to SE)
		for (let col = 4; col <= 18; col++) {
			this.setCell(buffer, col, 10, "-", COLOR_GRAY);
		}

		// Left edge (NW to SW)
		for (let row = 1; row <= 9; row++) {
			this.setCell(buffer, 3, row, "|", COLOR_GRAY);
		}

		// Right edge (NE to SE)
		for (let row = 1; row <= 9; row++) {
			this.setCell(buffer, 19, row, "|", COLOR_GRAY);
		}

		// Horizontal midline through center
		for (let col = 4; col <= 18; col++) {
			if (col === 11) continue; // center handled separately
			this.setCell(buffer, col, 5, "-", COLOR_GRAY);
		}

		// NW-SE diagonal (from NW to SE through center)
		this.setCell(buffer, 5, 1, "\\", COLOR_GRAY);
		this.setCell(buffer, 7, 2, "\\", COLOR_GRAY);
		this.setCell(buffer, 9, 3, "\\", COLOR_GRAY);
		this.setCell(buffer, 10, 4, "\\", COLOR_GRAY);
		this.setCell(buffer, 12, 6, "\\", COLOR_GRAY);
		this.setCell(buffer, 13, 7, "\\", COLOR_GRAY);
		this.setCell(buffer, 15, 8, "\\", COLOR_GRAY);
		this.setCell(buffer, 17, 9, "\\", COLOR_GRAY);

		// NE-SW diagonal (from NE to SW through center)
		this.setCell(buffer, 17, 1, "/", COLOR_GRAY);
		this.setCell(buffer, 15, 2, "/", COLOR_GRAY);
		this.setCell(buffer, 13, 3, "/", COLOR_GRAY);
		this.setCell(buffer, 12, 4, "/", COLOR_GRAY);
		this.setCell(buffer, 10, 6, "/", COLOR_GRAY);
		this.setCell(buffer, 9, 7, "/", COLOR_GRAY);
		this.setCell(buffer, 7, 8, "/", COLOR_GRAY);
		this.setCell(buffer, 5, 9, "/", COLOR_GRAY);
	}

	// ========================================================================
	// POSITION DOTS
	//
	// Place dim "." markers at grid locations that are not occupied by hands.
	// ========================================================================

	private placePositionDots(
		buffer: Cell[][],
		coords: Record<GridLocation, GridCoord>,
		data: RetroPictographData,
	): void {
		const occupiedLocations = new Set<GridLocation>([
			data.blueHand.location,
			data.redHand.location,
		]);

		const perimeterPositions: GridLocation[] = [
			GridLocation.NORTH,
			GridLocation.NORTHEAST,
			GridLocation.EAST,
			GridLocation.SOUTHEAST,
			GridLocation.SOUTH,
			GridLocation.SOUTHWEST,
			GridLocation.WEST,
			GridLocation.NORTHWEST,
		];

		for (const loc of perimeterPositions) {
			if (!occupiedLocations.has(loc)) {
				const coord = coords[loc];
				this.setCell(buffer, coord.col, coord.row, ".", COLOR_GRAY);
			}
		}
	}

	// ========================================================================
	// HAND MARKERS
	//
	// B = blue hand, R = red hand, X = both hands at same position.
	// ========================================================================

	private placeHand(
		buffer: Cell[][],
		hand: RetroHandData,
		coords: Record<GridLocation, GridCoord>,
	): void {
		const coord = coords[hand.location];
		const marker = hand.color === MotionColor.BLUE ? "B" : "R";
		const color = hand.color === MotionColor.BLUE ? COLOR_BLUE : COLOR_RED;
		this.setCell(buffer, coord.col, coord.row, marker, color);
	}

	private markOverlaps(
		buffer: Cell[][],
		data: RetroPictographData,
		coords: Record<GridLocation, GridCoord>,
	): void {
		if (data.blueHand.location === data.redHand.location) {
			const coord = coords[data.blueHand.location];
			this.setCell(buffer, coord.col, coord.row, "X", COLOR_CYAN);
		}
	}

	// ========================================================================
	// MOTION ARROWS
	//
	// Draw directional characters along the path from start to end location.
	// Uses Bresenham-style stepping through the character buffer.
	// ========================================================================

	private drawMotionPath(
		buffer: Cell[][],
		hand: RetroHandData,
		coords: Record<GridLocation, GridCoord>,
	): void {
		if (hand.location === hand.endLocation) return;

		const start = coords[hand.location];
		const end = coords[hand.endLocation];
		const color = hand.color === MotionColor.BLUE ? COLOR_BLUE : COLOR_RED;

		const dx = end.col - start.col;
		const dy = end.row - start.row;

		// Number of steps along the path (use the larger dimension)
		const steps = Math.max(Math.abs(dx), Math.abs(dy));
		if (steps === 0) return;

		const stepX = dx / steps;
		const stepY = dy / steps;

		// Get the arrow character for this direction
		const arrowChar = getArrowChar(dx, dy);

		// Place arrow characters along the path, skipping start and end cells
		for (let i = 1; i < steps; i++) {
			const col = Math.round(start.col + stepX * i);
			const row = Math.round(start.row + stepY * i);

			// Only place arrow if cell is empty or contains grid structure
			const existing = this.getCell(buffer, col, row);
			if (existing && this.isCellOverwritable(existing)) {
				this.setCell(buffer, col, row, arrowChar, color);
			}
		}

		// Place arrowhead at the last cell before the end position
		if (steps >= 2) {
			const arrowheadCol = Math.round(start.col + stepX * (steps - 1));
			const arrowheadRow = Math.round(start.row + stepY * (steps - 1));
			const existing = this.getCell(buffer, arrowheadCol, arrowheadRow);
			if (existing && this.isCellOverwritable(existing)) {
				// Use a directional arrowhead
				const headChar = this.getArrowheadChar(dx, dy);
				this.setCell(buffer, arrowheadCol, arrowheadRow, headChar, color);
			}
		}
	}

	/** Check if a cell can be overwritten by an arrow or indicator */
	private isCellOverwritable(cell: Cell): boolean {
		// Overwrite empty space and grid structure characters
		const overwritable = new Set([
			" ",
			"|",
			"-",
			"/",
			"\\",
			".",
			"+",
		]);
		return overwritable.has(cell.char);
	}

	/** Get a directional arrowhead character pointing toward the end */
	private getArrowheadChar(dx: number, dy: number): string {
		const absDx = Math.abs(dx);
		const absDy = Math.abs(dy);

		if (absDy > absDx * 2) {
			return dy > 0 ? "v" : "^";
		} else if (absDx > absDy * 2) {
			return dx > 0 ? ">" : "<";
		} else {
			// Diagonal arrowheads: use the more expressive character
			if (dx > 0 && dy < 0) return "^";
			if (dx < 0 && dy > 0) return "v";
			if (dx > 0 && dy > 0) return "v";
			if (dx < 0 && dy < 0) return "^";
		}
		return "*";
	}

	// ========================================================================
	// ORIENTATION INDICATORS
	//
	// Place a single character next to the hand marker showing prop direction.
	// Tries to place it in an unoccupied adjacent cell.
	// ========================================================================

	private placeOrientation(
		buffer: Cell[][],
		hand: RetroHandData,
		coords: Record<GridLocation, GridCoord>,
		width: number,
		height: number,
	): void {
		const coord = coords[hand.location];
		const orientChar = getOrientationChar(hand.orientation, hand.location);
		const color = hand.color === MotionColor.BLUE ? COLOR_BLUE : COLOR_RED;

		// Try to place orientation indicator in adjacent cells, preferring right then left
		const candidates: [number, number][] = [
			[coord.col + 1, coord.row], // right
			[coord.col - 1, coord.row], // left
			[coord.col, coord.row - 1], // above
			[coord.col, coord.row + 1], // below
		];

		for (const [c, r] of candidates) {
			if (c < 0 || c >= width || r < 0 || r >= height) continue;
			const existing = this.getCell(buffer, c, r);
			if (existing && existing.char === " ") {
				this.setCell(buffer, c, r, orientChar, color);
				return;
			}
		}
	}

	// ========================================================================
	// HTML CONVERSION
	//
	// Walk each row of the buffer. Consecutive characters with the same color
	// are grouped into a single <span>. Uncolored characters are emitted as
	// HTML-escaped text. Trailing spaces are trimmed.
	// ========================================================================

	private bufferToHtml(buffer: Cell[][], height: number): string[] {
		const lines: string[] = [];

		for (let row = 0; row < height; row++) {
			const rowCells = buffer[row]!;
			let html = "";
			let currentColor: string | null = null;
			let run = "";

			for (let col = 0; col < rowCells.length; col++) {
				const cell = rowCells[col]!;
				const cellColor = cell.color;

				if (cellColor !== currentColor) {
					// Flush previous run
					if (run.length > 0) {
						html += currentColor
							? `<span class="${currentColor}">${this.escapeHtml(run)}</span>`
							: this.escapeHtml(run);
					}
					currentColor = cellColor;
					run = cell.char;
				} else {
					run += cell.char;
				}
			}

			// Flush final run
			if (run.length > 0) {
				html += currentColor
					? `<span class="${currentColor}">${this.escapeHtml(run)}</span>`
					: this.escapeHtml(run);
			}

			lines.push(html);
		}

		return lines;
	}

	private escapeHtml(text: string): string {
		return text
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/ /g, "&nbsp;");
	}
}
