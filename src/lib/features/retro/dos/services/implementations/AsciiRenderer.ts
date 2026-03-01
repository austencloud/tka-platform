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

import type { IAsciiRenderer, AsciiRenderOptions } from "../contracts/IAsciiRenderer";
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

/** Buffer width for the rendered pictograph (wide to compensate for ~2:1 char aspect ratio) */
const BUFFER_WIDTH = 33;

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

/** Priority levels for the layered rendering system */
const PRIORITY_EMPTY = -1;
const PRIORITY_GRID = 0;
const PRIORITY_ARROW = 1;
const PRIORITY_ORIENTATION = 2;
const PRIORITY_HAND = 3;

// ============================================================================
// CELL TYPE: character + optional color
// ============================================================================

interface Cell {
	char: string;
	color: string | null;
	priority: number;
}

function emptyCell(): Cell {
	return { char: " ", color: null, priority: PRIORITY_EMPTY };
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

// Two coordinate rings, matching the real pictograph grid:
//   OUTER = large circle markers at the 8 perimeter locations (always visible)
//   HAND  = where hand markers (B/R) sit, halfway between outer and center
//
// Coordinates compensate for monospace ~2:1 char height-to-width ratio.
// Diagonals step 2 cols per row so they appear at true 45 degrees.

const DIAMOND_OUTER: Record<GridLocation, GridCoord> = {
	[GridLocation.NORTH]: { col: 16, row: 0 },
	[GridLocation.NORTHEAST]: { col: 24, row: 2 },
	[GridLocation.EAST]: { col: 28, row: 6 },
	[GridLocation.SOUTHEAST]: { col: 24, row: 10 },
	[GridLocation.SOUTH]: { col: 16, row: 12 },
	[GridLocation.SOUTHWEST]: { col: 8, row: 10 },
	[GridLocation.WEST]: { col: 4, row: 6 },
	[GridLocation.NORTHWEST]: { col: 8, row: 2 },
	[GridLocation.CENTER]: { col: 16, row: 6 },
};

const DIAMOND_HAND: Record<GridLocation, GridCoord> = {
	[GridLocation.NORTH]: { col: 16, row: 3 },
	[GridLocation.NORTHEAST]: { col: 20, row: 4 },
	[GridLocation.EAST]: { col: 22, row: 6 },
	[GridLocation.SOUTHEAST]: { col: 20, row: 8 },
	[GridLocation.SOUTH]: { col: 16, row: 9 },
	[GridLocation.SOUTHWEST]: { col: 12, row: 8 },
	[GridLocation.WEST]: { col: 10, row: 6 },
	[GridLocation.NORTHWEST]: { col: 12, row: 4 },
	[GridLocation.CENTER]: { col: 16, row: 6 },
};

const BOX_OUTER: Record<GridLocation, GridCoord> = {
	[GridLocation.NORTH]: { col: 16, row: 0 },
	[GridLocation.NORTHEAST]: { col: 26, row: 0 },
	[GridLocation.EAST]: { col: 26, row: 5 },
	[GridLocation.SOUTHEAST]: { col: 26, row: 10 },
	[GridLocation.SOUTH]: { col: 16, row: 10 },
	[GridLocation.SOUTHWEST]: { col: 6, row: 10 },
	[GridLocation.WEST]: { col: 6, row: 5 },
	[GridLocation.NORTHWEST]: { col: 6, row: 0 },
	[GridLocation.CENTER]: { col: 16, row: 5 },
};

const BOX_HAND: Record<GridLocation, GridCoord> = {
	[GridLocation.NORTH]: { col: 16, row: 3 },
	[GridLocation.NORTHEAST]: { col: 21, row: 3 },
	[GridLocation.EAST]: { col: 21, row: 5 },
	[GridLocation.SOUTHEAST]: { col: 21, row: 7 },
	[GridLocation.SOUTH]: { col: 16, row: 7 },
	[GridLocation.SOUTHWEST]: { col: 11, row: 7 },
	[GridLocation.WEST]: { col: 11, row: 5 },
	[GridLocation.NORTHWEST]: { col: 11, row: 3 },
	[GridLocation.CENTER]: { col: 16, row: 5 },
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
	renderPictograph(data: RetroPictographData, options?: AsciiRenderOptions): string[] {
		const isBox = data.gridMode === GridMode.BOX;
		const outerCoords = isBox ? BOX_OUTER : DIAMOND_OUTER;
		const handCoords = isBox ? BOX_HAND : DIAMOND_HAND;
		const height = isBox ? BOX_HEIGHT : DIAMOND_HEIGHT;
		const layers = options?.layers;

		// Step 1: Allocate buffer
		const buffer = this.createBuffer(BUFFER_WIDTH, height);

		// Step 2: Draw grid skeleton (layer: grid)
		if (!layers || layers.grid !== false) {
			if (isBox) {
				this.drawBoxGrid(buffer, height);
			} else {
				this.drawDiamondGrid(buffer, height);
			}

			// Center marker
			const center = outerCoords[GridLocation.CENTER];
			this.setCell(buffer, center.col, center.row, "o", COLOR_WHITE, PRIORITY_GRID);

			// Outer perimeter markers (always visible, hands don't replace these)
			this.placePositionDots(buffer, outerCoords, isBox);

			// Inner hand-point dots (hands overwrite these via priority)
			this.placeHandPointDots(buffer, handCoords, isBox);
		}

		// Step 3: Overlay hand markers at hand points (layer: hands)
		if (!layers || layers.hands !== false) {
			this.placeHand(buffer, data.blueHand, handCoords);
			this.placeHand(buffer, data.redHand, handCoords);
			this.markOverlaps(buffer, data, handCoords);
		}

		// Step 4: Draw motion arrows (layer: arrows)
		if (!layers || layers.arrows !== false) {
			if (data.blueHand.motionType !== MotionType.STATIC) {
				this.drawMotionPath(buffer, data.blueHand, handCoords);
			}
			if (data.redHand.motionType !== MotionType.STATIC) {
				this.drawMotionPath(buffer, data.redHand, handCoords);
			}
		}

		// Step 5: Place orientation indicators (layer: staves)
		if (!layers || layers.staves !== false) {
			this.placeOrientation(buffer, data.blueHand, handCoords, BUFFER_WIDTH, height);
			this.placeOrientation(buffer, data.redHand, handCoords, BUFFER_WIDTH, height);
		}

		// Step 6: Convert to HTML
		return this.bufferToHtml(buffer, height);
	}

	renderPlaceholder(): string[] {
		const height = DIAMOND_HEIGHT;
		const buffer = this.createBuffer(BUFFER_WIDTH, height);

		this.drawDiamondGrid(buffer, height);

		// Place "?" at center
		const center = DIAMOND_OUTER[GridLocation.CENTER];
		this.setCell(buffer, center.col, center.row, "?", COLOR_GRAY);

		// Diamond placeholder: filled circles at cardinals only
		const cardinals: GridLocation[] = [
			GridLocation.NORTH,
			GridLocation.EAST,
			GridLocation.SOUTH,
			GridLocation.WEST,
		];
		for (const loc of cardinals) {
			const coord = DIAMOND_OUTER[loc];
			this.setCell(buffer, coord.col, coord.row, "\u25CF", COLOR_WHITE);
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
		priority: number = PRIORITY_GRID,
	): void {
		if (row >= 0 && row < buffer.length && col >= 0 && col < buffer[0]!.length) {
			const existing = buffer[row]![col]!;
			if (priority >= existing.priority) {
				buffer[row]![col] = { char, color, priority };
			}
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
	// Minimal layout matching the real pictograph grid: 8 perimeter locations
	// floating around a center point. No connecting lines.
	//
	// Layout (13 rows, 33 cols) — aspect-corrected for monospace ~2:1 ratio:
	//
	//  Row 0:                O                      N  (col 16)
	//  Row 2:        O                   O          NW (col 8), NE (col 24)
	//  Row 6:  O               o               O   W  (col 4), center (16), E (col 28)
	//  Row 10:       O                   O          SW (col 8), SE (col 24)
	//  Row 12:               O                      S  (col 16)
	// ========================================================================

	private drawDiamondGrid(_buffer: Cell[][], _height: number): void {
		// No grid lines — perimeter locations and center are placed by
		// placePositionDots and the center marker in renderPictograph.
	}

	// ========================================================================
	// BOX GRID SKELETON
	//
	// Minimal layout matching the real pictograph grid: 8 perimeter locations
	// floating around a center point. No connecting lines or edges.
	//
	// Layout (11 rows, 33 cols) — aspect-corrected for monospace ~2:1 ratio:
	//
	//  Row 0:  O                       O        NW (col 6), NE (col 26)
	//  Row 2:                O                  N  (col 16)
	//  Row 5:  O               o           O    W  (col 6), center (16), E (col 26)
	//  Row 8:                O                  S  (col 16)
	//  Row 10: O                       O        SW (col 6), SE (col 26)
	// ========================================================================

	private drawBoxGrid(_buffer: Cell[][], _height: number): void {
		// No grid lines — perimeter locations and center are placed by
		// placePositionDots and the center marker in renderPictograph.
	}

	// ========================================================================
	// POSITION DOTS
	//
	// Place dim "." markers at grid locations that are not occupied by hands.
	// ========================================================================

	private placePositionDots(
		buffer: Cell[][],
		outerCoords: Record<GridLocation, GridCoord>,
		isBox: boolean,
	): void {
		// Diamond = filled circles (●) at cardinals only
		// Box = hollow circles (O) at intercardinals only
		const marker = isBox ? "O" : "\u25CF";

		const positions: GridLocation[] = isBox
			? [GridLocation.NORTHEAST, GridLocation.SOUTHEAST, GridLocation.SOUTHWEST, GridLocation.NORTHWEST]
			: [GridLocation.NORTH, GridLocation.EAST, GridLocation.SOUTH, GridLocation.WEST];

		for (const loc of positions) {
			const coord = outerCoords[loc];
			this.setCell(buffer, coord.col, coord.row, marker, COLOR_WHITE);
		}
	}

	/** Place hand-point dots at the 4 primary positions for the current grid mode. */
	private placeHandPointDots(
		buffer: Cell[][],
		handCoords: Record<GridLocation, GridCoord>,
		isBox: boolean,
	): void {
		const positions: GridLocation[] = isBox
			? [GridLocation.NORTHEAST, GridLocation.SOUTHEAST, GridLocation.SOUTHWEST, GridLocation.NORTHWEST]
			: [GridLocation.NORTH, GridLocation.EAST, GridLocation.SOUTH, GridLocation.WEST];

		for (const loc of positions) {
			const coord = handCoords[loc];
			this.setCell(buffer, coord.col, coord.row, ".", COLOR_GRAY);
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
		this.setCell(buffer, coord.col, coord.row, marker, color, PRIORITY_HAND);
	}

	private markOverlaps(
		buffer: Cell[][],
		data: RetroPictographData,
		coords: Record<GridLocation, GridCoord>,
	): void {
		if (data.blueHand.location === data.redHand.location) {
			const coord = coords[data.blueHand.location];
			this.setCell(buffer, coord.col, coord.row, "X", COLOR_CYAN, PRIORITY_HAND);
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

			this.setCell(buffer, col, row, arrowChar, color, PRIORITY_ARROW);
		}

		// Place arrowhead at the last cell before the end position
		if (steps >= 2) {
			const arrowheadCol = Math.round(start.col + stepX * (steps - 1));
			const arrowheadRow = Math.round(start.row + stepY * (steps - 1));
			const headChar = this.getArrowheadChar(dx, dy);
			this.setCell(buffer, arrowheadCol, arrowheadRow, headChar, color, PRIORITY_ARROW);
		}
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
			if (existing && existing.priority < PRIORITY_ORIENTATION) {
				this.setCell(buffer, c, r, orientChar, color, PRIORITY_ORIENTATION);
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
