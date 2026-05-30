/**
 * AsciiRenderer -- ASCII art pictograph renderer for the DOS terminal
 *
 * Converts RetroPictographData into character art using a 2D character
 * buffer. The diamond grid is 66 chars wide and 26 lines tall. The
 * box grid is 66 chars wide and 22 lines tall. Both use the same
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

import type { IAsciiRenderer, AsciiRenderOptions } from "./IAsciiRenderer";
import type {
	RetroPictographData,
	RetroHandData,
} from "../../shared/domain/pictograph-types";
import {
	GridLocation,
	GridMode,
	MotionType,
	MotionColor,
	Orientation,
	RotationDirection,
} from "../../shared/domain/pictograph-types";

// ============================================================================
// CONSTANTS
// ============================================================================

/** Buffer width for the rendered pictograph (wide to compensate for ~2:1 char aspect ratio) */
const BUFFER_WIDTH = 66;

/** Buffer height for diamond grid */
const DIAMOND_HEIGHT = 26;

/** Buffer height for box grid */
const BOX_HEIGHT = 22;

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
	[GridLocation.NORTH]: { col: 32, row: 0 },
	[GridLocation.NORTHEAST]: { col: 48, row: 4 },
	[GridLocation.EAST]: { col: 56, row: 12 },
	[GridLocation.SOUTHEAST]: { col: 48, row: 20 },
	[GridLocation.SOUTH]: { col: 32, row: 24 },
	[GridLocation.SOUTHWEST]: { col: 16, row: 20 },
	[GridLocation.WEST]: { col: 8, row: 12 },
	[GridLocation.NORTHWEST]: { col: 16, row: 4 },
	[GridLocation.CENTER]: { col: 32, row: 12 },
};

const DIAMOND_HAND: Record<GridLocation, GridCoord> = {
	[GridLocation.NORTH]: { col: 32, row: 6 },
	[GridLocation.NORTHEAST]: { col: 40, row: 8 },
	[GridLocation.EAST]: { col: 44, row: 12 },
	[GridLocation.SOUTHEAST]: { col: 40, row: 16 },
	[GridLocation.SOUTH]: { col: 32, row: 18 },
	[GridLocation.SOUTHWEST]: { col: 24, row: 16 },
	[GridLocation.WEST]: { col: 20, row: 12 },
	[GridLocation.NORTHWEST]: { col: 24, row: 8 },
	[GridLocation.CENTER]: { col: 32, row: 12 },
};

const BOX_OUTER: Record<GridLocation, GridCoord> = {
	[GridLocation.NORTH]: { col: 32, row: 0 },
	[GridLocation.NORTHEAST]: { col: 52, row: 0 },
	[GridLocation.EAST]: { col: 52, row: 10 },
	[GridLocation.SOUTHEAST]: { col: 52, row: 20 },
	[GridLocation.SOUTH]: { col: 32, row: 20 },
	[GridLocation.SOUTHWEST]: { col: 12, row: 20 },
	[GridLocation.WEST]: { col: 12, row: 10 },
	[GridLocation.NORTHWEST]: { col: 12, row: 0 },
	[GridLocation.CENTER]: { col: 32, row: 10 },
};

const BOX_HAND: Record<GridLocation, GridCoord> = {
	[GridLocation.NORTH]: { col: 32, row: 6 },
	[GridLocation.NORTHEAST]: { col: 40, row: 6 },
	[GridLocation.EAST]: { col: 40, row: 10 },
	[GridLocation.SOUTHEAST]: { col: 40, row: 14 },
	[GridLocation.SOUTH]: { col: 32, row: 14 },
	[GridLocation.SOUTHWEST]: { col: 24, row: 14 },
	[GridLocation.WEST]: { col: 24, row: 10 },
	[GridLocation.NORTHWEST]: { col: 24, row: 6 },
	[GridLocation.CENTER]: { col: 32, row: 10 },
};

// ============================================================================
// BETA OFFSET MAPS
//
// When both hands occupy the same grid location (beta position), offset each
// hand's staff origin so they don't overlap. Offsets are in (dcol, drow) and
// account for 2:1 monospace aspect ratio at 2x resolution.
//   - Vertical separation: (0, ±2)
//   - Horizontal separation: (±4, 0)
//   - Diagonal separation: (±4, ±2)
// ============================================================================

interface BetaOffset {
	readonly dcol: number;
	readonly drow: number;
}

interface BetaOffsetPair {
	readonly blue: BetaOffset;
	readonly red: BetaOffset;
}

/** Diamond mode: perpendicular offset to separate overlapping staves at beta.
 *  Kept small (±2 col / ±1 row) so staves stay within the hand ring. */
const DIAMOND_BETA: Partial<Record<GridLocation, BetaOffsetPair>> = {
	[GridLocation.NORTH]: { blue: { dcol: -2, drow: 0 }, red: { dcol: 2, drow: 0 } },
	[GridLocation.EAST]: { blue: { dcol: 0, drow: -1 }, red: { dcol: 0, drow: 1 } },
	[GridLocation.SOUTH]: { blue: { dcol: 2, drow: 0 }, red: { dcol: -2, drow: 0 } },
	[GridLocation.WEST]: { blue: { dcol: 0, drow: 1 }, red: { dcol: 0, drow: -1 } },
	[GridLocation.NORTHEAST]: { blue: { dcol: -2, drow: -1 }, red: { dcol: 2, drow: 1 } },
	[GridLocation.SOUTHEAST]: { blue: { dcol: 2, drow: -1 }, red: { dcol: -2, drow: 1 } },
	[GridLocation.SOUTHWEST]: { blue: { dcol: 2, drow: 1 }, red: { dcol: -2, drow: -1 } },
	[GridLocation.NORTHWEST]: { blue: { dcol: -2, drow: 1 }, red: { dcol: 2, drow: -1 } },
	[GridLocation.CENTER]: { blue: { dcol: -2, drow: 0 }, red: { dcol: 2, drow: 0 } },
};

/** Box mode: perpendicular offset to separate overlapping staves at beta. */
const BOX_BETA: Partial<Record<GridLocation, BetaOffsetPair>> = {
	[GridLocation.NORTHEAST]: { blue: { dcol: -2, drow: -1 }, red: { dcol: 2, drow: 1 } },
	[GridLocation.SOUTHEAST]: { blue: { dcol: -2, drow: 1 }, red: { dcol: 2, drow: -1 } },
	[GridLocation.SOUTHWEST]: { blue: { dcol: 2, drow: 1 }, red: { dcol: -2, drow: -1 } },
	[GridLocation.NORTHWEST]: { blue: { dcol: 2, drow: -1 }, red: { dcol: -2, drow: 1 } },
	[GridLocation.NORTH]: { blue: { dcol: -2, drow: 0 }, red: { dcol: 2, drow: 0 } },
	[GridLocation.EAST]: { blue: { dcol: 0, drow: -1 }, red: { dcol: 0, drow: 1 } },
	[GridLocation.SOUTH]: { blue: { dcol: 2, drow: 0 }, red: { dcol: -2, drow: 0 } },
	[GridLocation.WEST]: { blue: { dcol: 0, drow: 1 }, red: { dcol: 0, drow: -1 } },
	[GridLocation.CENTER]: { blue: { dcol: -2, drow: 0 }, red: { dcol: 2, drow: 0 } },
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

/**
 * Select an ASCII character for a curved arc segment based on the local
 * tangent direction. Uses a 12-direction palette with transitional chars
 * (. ' ) for sub-cell smooth transitions between primary directions.
 *
 * Accounts for monospace 2:1 aspect ratio: buffer dx is halved before
 * computing the visual angle so diagonals map correctly.
 */
function getArcChar(bufferDx: number, bufferDy: number): string {
	const visualDx = bufferDx / 2;
	const deg = (Math.atan2(bufferDy, visualDx) * 180) / Math.PI;
	const absDeg = Math.abs(deg);

	// Pure horizontal
	if (absDeg <= 12) return "-";
	if (absDeg >= 168) return "-";

	// Pure vertical
	if (absDeg >= 78 && absDeg <= 102) return "|";

	// Near-horizontal transitions:
	//   '.' sits low in the cell → gentle descent
	//   "'" sits high in the cell → gentle ascent
	if (deg > 12 && deg < 34) return ".";
	if (deg > 146 && deg < 168) return ".";
	if (deg < -12 && deg > -34) return "'";
	if (deg < -146 && deg > -168) return "'";

	// Standard diagonals
	if (deg >= 34 && deg <= 78) return "\\";
	if (deg >= 102 && deg <= 146) return "/";
	if (deg <= -34 && deg >= -78) return "/";
	if (deg <= -102 && deg >= -146) return "\\";

	return "-";
}

// ============================================================================
// ORIENTATION / STAFF GEOMETRY
//
// Computes the effective angle a staff points (toward the thumb end) based
// on the hand's orientation and grid location. This angle drives both the
// line character selection and the directional staff rendering.
// ============================================================================

/** Returns the angle (radians, 0=right) the thumb end of the staff points toward. */
function getOrientationAngle(
	orientation: Orientation,
	location: GridLocation,
): number {
	const r = getRadialAngle(location);
	switch (orientation) {
		case Orientation.IN:
			return r + Math.PI;
		case Orientation.OUT:
			return r;
		case Orientation.CLOCK:
			return r + Math.PI / 2;
		case Orientation.COUNTER:
			return r - Math.PI / 2;
		case Orientation.CLOCK_IN:
			return r + (Math.PI * 3) / 4;
		case Orientation.CLOCK_OUT:
			return r + Math.PI / 4;
		case Orientation.COUNTER_IN:
			return r - (Math.PI * 3) / 4;
		case Orientation.COUNTER_OUT:
			return r - Math.PI / 4;
		case Orientation.CENTER_N:
			return -Math.PI / 2;
		case Orientation.CENTER_S:
			return Math.PI / 2;
		case Orientation.CENTER_E:
			return 0;
		case Orientation.CENTER_W:
			return Math.PI;
		case Orientation.CENTER_NE:
			return -Math.PI / 4;
		case Orientation.CENTER_SE:
			return Math.PI / 4;
		case Orientation.CENTER_SW:
			return (3 * Math.PI) / 4;
		case Orientation.CENTER_NW:
			return (-3 * Math.PI) / 4;
		default:
			return -Math.PI / 2;
	}
}

function _getOrientationChar(
	orientation: Orientation,
	location: GridLocation,
): string {
	return angleToLineChar(getOrientationAngle(orientation, location));
}

/** Perpendicular cap character for the thumb end of a staff */
function getThumbCapChar(lineChar: string): string {
	switch (lineChar) {
		case "|":
			return "-";
		case "-":
			return "|";
		case "/":
			return "\\";
		case "\\":
			return "/";
		default:
			return "-";
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

/**
 * Step vector per staff line character.
 * Diagonals use dcol=2 per drow=1 to compensate for monospace ~2:1 aspect ratio,
 * keeping diagonal staves at a visual 45 degrees.
 */
function getStaffStep(lineChar: string): { dcol: number; drow: number } {
	switch (lineChar) {
		case "|":
			return { dcol: 0, drow: 1 };
		case "-":
			return { dcol: 1, drow: 0 };
		case "/":
			return { dcol: 2, drow: -1 };
		case "\\":
			return { dcol: 2, drow: 1 };
		default:
			return { dcol: 0, drow: 1 };
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
		const { buffer, height } = this.renderToBuffer(data, options);
		return this.bufferToHtml(buffer, height);
	}

	renderSequence(steps: RetroPictographData[], options?: AsciiRenderOptions): string[] {
		if (steps.length === 0) return this.renderPlaceholder();
		if (steps.length === 1) return this.renderPictograph(steps[0]!, options);

		// Vertical stacking: each step gets a labeled separator, then its full pictograph.
		const lines: string[] = [];

		for (let s = 0; s < steps.length; s++) {
			const step = steps[s]!;
			const { buffer, height } = this.renderToBuffer(step, options);
			const stepLines = this.bufferToHtml(buffer, height);

			// Separator line between steps (not before first)
			if (s > 0) {
				lines.push(""); // blank spacer
			}

			// Step label: ═══ STEP 1: A ═══  or  ═══ STEP 4: F (bridge) ═══
			const bridgeTag = step.isBridge ? " (bridge)" : "";
			const label = ` STEP ${s + 1}: ${step.letter || "?"}${bridgeTag} `;
			const barTotal = BUFFER_WIDTH - label.length;
			const barLeft = Math.max(0, Math.floor(barTotal / 2));
			const barRight = Math.max(0, barTotal - barLeft);
			const separator =
				`<span class="${COLOR_GREEN}">${"\u2550".repeat(barLeft)}${label}${"\u2550".repeat(barRight)}</span>`;
			lines.push(separator);

			// The pictograph itself
			lines.push(...stepLines);
		}

		return lines;
	}

	/** Render a pictograph to an internal Cell buffer (before HTML conversion). */
	private renderToBuffer(
		data: RetroPictographData,
		options?: AsciiRenderOptions,
	): { buffer: Cell[][]; height: number } {
		const isBox = data.gridMode === GridMode.BOX;
		const outerCoords = isBox ? BOX_OUTER : DIAMOND_OUTER;
		const handCoords = isBox ? BOX_HAND : DIAMOND_HAND;
		const height = isBox ? BOX_HEIGHT : DIAMOND_HEIGHT;
		const layers = options?.layers;

		const buffer = this.createBuffer(BUFFER_WIDTH, height);

		if (layers?.grid !== false) {
			if (isBox) {
				this.drawBoxGrid(buffer, height);
			} else {
				this.drawDiamondGrid(buffer, height);
			}
			const center = outerCoords[GridLocation.CENTER];
			this.setCell(buffer, center.col, center.row, "o", COLOR_WHITE, PRIORITY_GRID);
			this.placePositionDots(buffer, outerCoords, isBox);
			this.placeHandPointDots(buffer, handCoords, isBox);
		}

		const stavesOn = layers?.staves !== false;

		// Hand markers (B/R/X) are redundant when staves are visible -
		// the staff color already identifies which hand is which.
		if ((layers?.hands !== false) && !stavesOn) {
			this.placeHand(buffer, data.blueHand, handCoords);
			this.placeHand(buffer, data.redHand, handCoords);
			this.markOverlaps(buffer, data, handCoords);
		}

		if (layers?.arrows !== false) {
			if (data.blueHand.motionType !== MotionType.STATIC) {
				this.drawMotionPath(buffer, data.blueHand, outerCoords);
			}
			if (data.redHand.motionType !== MotionType.STATIC) {
				this.drawMotionPath(buffer, data.redHand, outerCoords);
			}
		}

		if (layers?.staves !== false) {
			const isBeta = data.blueHand.endLocation === data.redHand.endLocation;
			if (isBeta) {
				const betaMap = isBox ? BOX_BETA : DIAMOND_BETA;
				const offsets = betaMap[data.blueHand.endLocation];
				const blueOffset = offsets?.blue ?? { dcol: -2, drow: 0 };
				const redOffset = offsets?.red ?? { dcol: 2, drow: 0 };
				this.placeOrientation(buffer, data.blueHand, handCoords, BUFFER_WIDTH, height, blueOffset);
				this.placeOrientation(buffer, data.redHand, handCoords, BUFFER_WIDTH, height, redOffset);
			} else {
				this.placeOrientation(buffer, data.blueHand, handCoords, BUFFER_WIDTH, height);
				this.placeOrientation(buffer, data.redHand, handCoords, BUFFER_WIDTH, height);
			}
		}

		return { buffer, height };
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
	// Layout (26 rows, 66 cols) - aspect-corrected for monospace ~2:1 ratio:
	//
	//  Row 0:                        O                          N  (col 32)
	//  Row 4:            O                           O          NW (col 16), NE (col 48)
	//  Row 12: O                       o                     O  W  (col 8), center (32), E (col 56)
	//  Row 20:           O                           O          SW (col 16), SE (col 48)
	//  Row 24:                       O                          S  (col 32)
	// ========================================================================

	private drawDiamondGrid(_buffer: Cell[][], _height: number): void {
		// No grid lines - perimeter locations and center are placed by
		// placePositionDots and the center marker in renderPictograph.
	}

	// ========================================================================
	// BOX GRID SKELETON
	//
	// Minimal layout matching the real pictograph grid: 8 perimeter locations
	// floating around a center point. No connecting lines or edges.
	//
	// Layout (22 rows, 66 cols) - aspect-corrected for monospace ~2:1 ratio:
	//
	//  Row 0:    O                                   O    NW (col 12), NE (col 52)
	//  Row 4:                    O                        N  (col 32)
	//  Row 10:   O                   o                O   W  (col 12), center (32), E (col 52)
	//  Row 16:                   O                        S  (col 32)
	//  Row 20:   O                                   O    SW (col 12), SE (col 52)
	// ========================================================================

	private drawBoxGrid(_buffer: Cell[][], _height: number): void {
		// No grid lines - perimeter locations and center are placed by
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
		const coord = coords[hand.endLocation];
		const marker = hand.color === MotionColor.BLUE ? "B" : "R";
		const color = hand.color === MotionColor.BLUE ? COLOR_BLUE : COLOR_RED;
		this.setCell(buffer, coord.col, coord.row, marker, color, PRIORITY_HAND);
	}

	private markOverlaps(
		buffer: Cell[][],
		data: RetroPictographData,
		coords: Record<GridLocation, GridCoord>,
	): void {
		if (data.blueHand.endLocation === data.redHand.endLocation) {
			const coord = coords[data.blueHand.endLocation];
			this.setCell(buffer, coord.col, coord.row, "X", COLOR_CYAN, PRIORITY_HAND);
		}
	}

	// ========================================================================
	// MOTION ARROWS
	//
	// Draw directional characters along the path from start to end location.
	// DASH motions use straight lines. PRO/ANTI motions use curved arcs
	// whose curvature direction matches the rotation direction (CW/CCW).
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

		const isCurved =
			hand.rotationDirection !== RotationDirection.NO_ROTATION &&
			hand.motionType !== MotionType.DASH;

		if (isCurved) {
			this.drawCurvedArrow(buffer, start, end, hand.rotationDirection, color);
		} else {
			this.drawStraightArrow(buffer, start, end, color);
		}
	}

	/**
	 * Breathing room: visual-space squared distance threshold.
	 * Arrow segments closer than this to the start or end outer dot are
	 * not rendered, keeping a clear gap between the arrow and the grid dots.
	 * Matches the real pictograph renderer where arrows float between locations.
	 */
	private static readonly ARROW_GAP_SQ = 4 * 4; // 4 visual units

	/** Check if a buffer position is within the gap zone around an outer dot. */
	private static inGapZone(col: number, row: number, dot: GridCoord): boolean {
		const vx = (col - dot.col) / 2; // visual x (aspect-corrected)
		const vy = row - dot.row;
		return vx * vx + vy * vy < AsciiRenderer.ARROW_GAP_SQ;
	}

	/** Straight arrow for DASH motions and fallback */
	private drawStraightArrow(
		buffer: Cell[][],
		start: GridCoord,
		end: GridCoord,
		color: string,
	): void {
		const dx = end.col - start.col;
		const dy = end.row - start.row;
		const steps = Math.max(Math.abs(dx), Math.abs(dy));
		if (steps === 0) return;

		const stepX = dx / steps;
		const stepY = dy / steps;
		const arrowChar = getArrowChar(dx, dy);

		let lastCol = -1;
		let lastRow = -1;

		for (let i = 1; i < steps; i++) {
			const col = Math.round(start.col + stepX * i);
			const row = Math.round(start.row + stepY * i);

			// Breathing room at endpoints
			if (AsciiRenderer.inGapZone(col, row, start)) continue;
			if (AsciiRenderer.inGapZone(col, row, end)) continue;

			this.setCell(buffer, col, row, arrowChar, color, PRIORITY_ARROW);
			lastCol = col;
			lastRow = row;
		}

		// Arrowhead at last rendered position
		if (lastCol >= 0) {
			const headChar = this.getArrowheadChar(end.col - lastCol, end.row - lastRow);
			this.setCell(buffer, lastCol, lastRow, headChar, color, PRIORITY_ARROW);
		}
	}

	/**
	 * Curved arrow for PRO/ANTI motions using a quadratic Bezier arc.
	 *
	 * All geometry is computed in visual space (compensating for the 2:1
	 * monospace aspect ratio) then converted back to buffer coordinates.
	 *
	 * Sign convention (derived from real pictograph arrows):
	 *   CW rotation → arc bulges AWAY from grid center (outward sweep)
	 *   CCW rotation → arc bulges TOWARD grid center (tight hug)
	 *
	 * Character selection uses the 12-direction getArcChar() which adds
	 * transitional characters (. ') between the 4 primary line directions
	 * for visually smoother curves.
	 */
	private drawCurvedArrow(
		buffer: Cell[][],
		start: GridCoord,
		end: GridCoord,
		rotDir: RotationDirection,
		color: string,
	): void {
		const dx = end.col - start.col;
		const dy = end.row - start.row;

		// Work in visual space (halve horizontal to undo 2:1 aspect ratio)
		const vdx = dx / 2;
		const vdy = dy;
		const vdist = Math.sqrt(vdx * vdx + vdy * vdy);
		if (vdist < 1) return;

		// Perpendicular direction in visual space.
		// Sign flipped from naive right-hand rule because screen y is inverted
		// relative to math convention: CW = -1 pushes outward, CCW = +1 inward.
		const sign = rotDir === RotationDirection.CLOCKWISE ? -1 : 1;
		const vperpX = -vdy * sign;
		const vperpY = vdx * sign;
		const vperpLen = Math.sqrt(vperpX * vperpX + vperpY * vperpY);

		// Control point: convert visual-space perpendicular back to buffer coords
		// (×2 for horizontal) and offset from chord midpoint by ~45% of visual distance.
		const bulge = vdist * 0.45;
		const cx = (start.col + end.col) / 2 + ((vperpX / vperpLen) * bulge * 2);
		const cy = (start.row + end.row) / 2 + ((vperpY / vperpLen) * bulge);

		// Dense Bezier sampling for smooth rasterization
		const numSamples = Math.max(Math.round(vdist * 2.5), 20);
		const points: { col: number; row: number }[] = [];
		for (let i = 0; i <= numSamples; i++) {
			const t = i / numSamples;
			const u = 1 - t;
			points.push({
				col: u * u * start.col + 2 * u * t * cx + t * t * end.col,
				row: u * u * start.row + 2 * u * t * cy + t * t * end.row,
			});
		}

		// Rasterize: place characters along the curve with breathing room
		const placed = new Set<string>();
		let lastCol = -1;
		let lastRow = -1;

		for (let i = 1; i < points.length - 1; i++) {
			const col = Math.round(points[i]!.col);
			const row = Math.round(points[i]!.row);
			const key = `${col},${row}`;
			if (placed.has(key)) continue;
			placed.add(key);

			// Breathing room at endpoints
			if (AsciiRenderer.inGapZone(col, row, start)) continue;
			if (AsciiRenderer.inGapZone(col, row, end)) continue;

			// Local tangent for 12-direction character selection
			const next = points[Math.min(i + 1, points.length - 1)]!;
			const prev = points[Math.max(i - 1, 0)]!;
			const tdx = next.col - prev.col;
			const tdy = next.row - prev.row;
			const ch = getArcChar(tdx, tdy);

			this.setCell(buffer, col, row, ch, color, PRIORITY_ARROW);
			lastCol = col;
			lastRow = row;
		}

		// Arrowhead at last rendered position (pointing toward end dot)
		if (lastCol >= 0) {
			const headChar = this.getArrowheadChar(end.col - lastCol, end.row - lastRow);
			this.setCell(buffer, lastCol, lastRow, headChar, color, PRIORITY_ARROW);
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
	// STAFF LINES (ORIENTATION)
	//
	// Draw a directional staff line through the hand position. The staff
	// extends outward from the hand until it reaches 1 cell before a grid
	// reference point (center marker, outer dot) or the buffer edge. This
	// keeps a 1-cell gap between the staff ends and the grid reference points
	// while the staff passes through (covers) the hand dot.
	// The thumb end gets a perpendicular cap character.
	// ========================================================================

	/** Grid reference chars the staff must not overwrite (1-cell gap kept) */
	private static readonly GRID_REFS = new Set(["o", "\u25CF", "O"]);

	/**
	 * Max reach per direction to prevent staves from spanning the entire buffer
	 * when no reference point is on the staff axis.
	 *
	 * Calibrated to the hand ring: hand positions sit ~50% between center and
	 * outer, so the staff half-length should be about 60-70% of that distance
	 * to stay within the grid. Grid-ref detection further limits reach when
	 * reference points lie on the staff axis.
	 */
	private static getMaxReach(lineChar: string): number {
		switch (lineChar) {
			case "-":
				return 9;
			case "/":
			case "\\":
				return 3;
			default:
				return 5;
		}
	}

	/**
	 * Walk outward from the hand position along the staff axis.
	 * Returns the number of valid cells before hitting a grid reference
	 * point or the buffer edge.
	 */
	private staffReach(
		buffer: Cell[][],
		origin: GridCoord,
		step: { dcol: number; drow: number },
		sign: number,
		maxReach: number,
	): number {
		let reach = 0;
		for (let i = 1; i <= maxReach; i++) {
			const c = origin.col + step.dcol * i * sign;
			const r = origin.row + step.drow * i * sign;

			if (r < 0 || r >= buffer.length || c < 0 || c >= buffer[0]!.length) break;

			const cell = buffer[r]![c]!;
			if (
				cell.priority === PRIORITY_GRID &&
				AsciiRenderer.GRID_REFS.has(cell.char)
			) {
				break; // stop 1 cell before this reference point
			}

			reach = i;
		}
		return reach;
	}

	private placeOrientation(
		buffer: Cell[][],
		hand: RetroHandData,
		coords: Record<GridLocation, GridCoord>,
		_width: number,
		_height: number,
		offset?: BetaOffset,
	): void {
		const baseCoord = coords[hand.endLocation];
		const coord = offset
			? { col: baseCoord.col + offset.dcol, row: baseCoord.row + offset.drow }
			: baseCoord;
		const angle = getOrientationAngle(hand.orientation, hand.endLocation);
		const lineChar = angleToLineChar(angle);
		const color = hand.color === MotionColor.BLUE ? COLOR_BLUE : COLOR_RED;
		const step = getStaffStep(lineChar);
		const maxReach = AsciiRenderer.getMaxReach(lineChar);

		// Determine which step direction points toward the thumb.
		const dot = Math.cos(angle) * step.dcol + Math.sin(angle) * step.drow;
		const thumbSign = dot >= 0 ? 1 : -1;
		const pinkySign = -thumbSign;

		const thumbReach = this.staffReach(buffer, coord, step, thumbSign, maxReach);
		const pinkyReach = this.staffReach(buffer, coord, step, pinkySign, maxReach);

		// Staff character at the hand position itself (covers the . dot)
		this.setCell(buffer, coord.col, coord.row, lineChar, color, PRIORITY_ORIENTATION);

		// Staff body toward thumb (cells 1 through thumbReach-1), cap at thumbReach
		for (let i = 1; i < thumbReach; i++) {
			this.setCell(
				buffer,
				coord.col + step.dcol * i * thumbSign,
				coord.row + step.drow * i * thumbSign,
				lineChar,
				color,
				PRIORITY_ORIENTATION,
			);
		}
		if (thumbReach > 0) {
			this.setCell(
				buffer,
				coord.col + step.dcol * thumbReach * thumbSign,
				coord.row + step.drow * thumbReach * thumbSign,
				getThumbCapChar(lineChar),
				color,
				PRIORITY_ORIENTATION,
			);
		}

		// Staff body toward pinky (no cap)
		for (let i = 1; i <= pinkyReach; i++) {
			this.setCell(
				buffer,
				coord.col + step.dcol * i * pinkySign,
				coord.row + step.drow * i * pinkySign,
				lineChar,
				color,
				PRIORITY_ORIENTATION,
			);
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
