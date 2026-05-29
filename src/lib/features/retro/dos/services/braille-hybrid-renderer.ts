/**
 * BrailleHybridRenderer -- Braille-curve pictograph renderer for the DOS terminal
 *
 * Two-layer compositing: ASCII characters for structural elements (grid dots,
 * center marker, orientation staves) and Unicode Braille (U+2800-U+28FF) for
 * smooth motion arrow curves. Each Braille character encodes a 2x4 dot grid,
 * giving 2x horizontal and 4x vertical sub-pixel resolution over plain ASCII.
 *
 * Render pipeline (order matters):
 *   1. Grid skeleton - outer dots, center marker, hand dots → ASCII layer
 *   2. Orientation staves - directional lines with thumb caps → ASCII layer
 *   3. Motion arrows - Bezier curves, skipping occupied cells → Braille layer
 *   4. Composite - ASCII wins where active, Braille fills gaps → HTML output
 *
 * Domain: Retro DOS Era
 */

import type { IAsciiRenderer, AsciiRenderOptions } from "./contracts/IAsciiRenderer";
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

const BUFFER_WIDTH = 66;
const DIAMOND_HEIGHT = 26;
const BOX_HEIGHT = 22;

const COLOR_BLUE = "dos-blue";
const COLOR_RED = "dos-red";
const COLOR_GREEN = "dos-green";
const COLOR_GRAY = "dos-gray";
const COLOR_WHITE = "dos-white";

/** Braille color IDs for pixel tracking */
const BRAILLE_BLUE = 1;
const BRAILLE_RED = 2;

/** Braille Unicode block base */
const BRAILLE_OFFSET = 0x2800;

/** Bit layout for 2x4 Braille dot grid */
const PIXEL_MAP = [
	[0x01, 0x08], // row 0: left=dot1, right=dot4
	[0x02, 0x10], // row 1: left=dot2, right=dot5
	[0x04, 0x20], // row 2: left=dot3, right=dot6
	[0x40, 0x80], // row 3: left=dot7, right=dot8
];

// Arrow curve parameters - see spec for tuning guidance
const RADIAL_PUSH = 20;
const DOT_GAP = 10;
const BULGE_FACTOR = 0.55;
const CURVE_SAMPLES = 120;
const ASCII_COLLISION_MARGIN = 1; // cells around ASCII to avoid

// ============================================================================
// GRID COORDINATE MAPS
// ============================================================================

interface GridCoord {
	readonly col: number;
	readonly row: number;
}

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
// ============================================================================

interface BetaOffset {
	readonly dcol: number;
	readonly drow: number;
}

interface BetaOffsetPair {
	readonly blue: BetaOffset;
	readonly red: BetaOffset;
}

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
// LABEL HELPERS
// ============================================================================

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

const MOTION_LABELS: Record<MotionType, string> = {
	[MotionType.PRO]: "pro",
	[MotionType.ANTI]: "anti",
	[MotionType.DASH]: "dash",
	[MotionType.FLOAT]: "flt",
	[MotionType.STATIC]: "stc",
};

// ============================================================================
// ASCII STRUCTURE LAYER
//
// Character grid for structural elements: grid dots, center marker, staves.
// ASCII cells always win over Braille in the final composite.
// ============================================================================

interface AsciiCell {
	char: string | null;
	color: string | null;
	active: boolean;
}

class AsciiLayer {
	readonly charW: number;
	readonly charH: number;
	readonly cells: AsciiCell[][];

	constructor(charW: number, charH: number) {
		this.charW = charW;
		this.charH = charH;
		this.cells = [];
		for (let r = 0; r < charH; r++) {
			const row: AsciiCell[] = [];
			for (let c = 0; c < charW; c++) {
				row.push({ char: null, color: null, active: false });
			}
			this.cells.push(row);
		}
	}

	set(col: number, row: number, char: string, color: string | null = null): void {
		const c = Math.round(col);
		const r = Math.round(row);
		if (r >= 0 && r < this.charH && c >= 0 && c < this.charW) {
			this.cells[r]![c] = { char, color, active: true };
		}
	}

	isActive(col: number, row: number): boolean {
		if (row >= 0 && row < this.charH && col >= 0 && col < this.charW) {
			return this.cells[row]![col]!.active;
		}
		return false;
	}
}

// ============================================================================
// BRAILLE PIXEL LAYER
//
// Sub-pixel bitmap for smooth curves. Each character cell maps to a 2x4
// pixel block. Color is tracked per pixel; the dominant color in each 2x4
// block determines the character's foreground color.
// ============================================================================

interface BrailleCell {
	char: string;
	color: string | null;
	hasContent: boolean;
}

class BrailleLayer {
	readonly charW: number;
	readonly charH: number;
	readonly pw: number;
	readonly ph: number;
	private readonly pixels: Uint8Array;
	private readonly colors: Uint8Array;

	constructor(charW: number, charH: number) {
		this.charW = charW;
		this.charH = charH;
		this.pw = charW * 2;
		this.ph = charH * 4;
		this.pixels = new Uint8Array(this.pw * this.ph);
		this.colors = new Uint8Array(this.pw * this.ph);
	}

	setPixel(x: number, y: number, color: number = BRAILLE_BLUE): void {
		const ix = Math.round(x);
		const iy = Math.round(y);
		if (ix >= 0 && ix < this.pw && iy >= 0 && iy < this.ph) {
			this.pixels[iy * this.pw + ix] = 1;
			this.colors[iy * this.pw + ix] = color;
		}
	}

	/** Bresenham line between two pixel-space points */
	line(x0: number, y0: number, x1: number, y1: number, color: number = BRAILLE_BLUE): void {
		let ix0 = Math.round(x0);
		let iy0 = Math.round(y0);
		const ix1 = Math.round(x1);
		const iy1 = Math.round(y1);
		const dx = Math.abs(ix1 - ix0);
		const dy = Math.abs(iy1 - iy0);
		const sx = ix0 < ix1 ? 1 : -1;
		const sy = iy0 < iy1 ? 1 : -1;
		let err = dx - dy;

		while (true) {
			this.setPixel(ix0, iy0, color);
			if (ix0 === ix1 && iy0 === iy1) break;
			const e2 = 2 * err;
			if (e2 > -dy) { err -= dy; ix0 += sx; }
			if (e2 < dx) { err += dx; iy0 += sy; }
		}
	}

	/** Encode a single character cell from its 2x4 pixel block */
	getCell(cx: number, cy: number): BrailleCell {
		let code = 0;
		let blueCount = 0;
		let redCount = 0;

		for (let py = 0; py < 4; py++) {
			for (let px = 0; px < 2; px++) {
				const ix = cx * 2 + px;
				const iy = cy * 4 + py;
				if (ix < this.pw && iy < this.ph && this.pixels[iy * this.pw + ix]) {
					code |= PIXEL_MAP[py]![px]!;
					const c = this.colors[iy * this.pw + ix];
					if (c === BRAILLE_BLUE) blueCount++;
					else if (c === BRAILLE_RED) redCount++;
				}
			}
		}

		const char = String.fromCharCode(BRAILLE_OFFSET + code);
		let color: string | null = null;
		if (blueCount > 0 || redCount > 0) {
			color = blueCount >= redCount ? COLOR_BLUE : COLOR_RED;
		}
		return { char, color, hasContent: code > 0 };
	}
}

// ============================================================================
// GEOMETRY HELPERS
// ============================================================================

/** Convert char-buffer coordinates to braille pixel coordinates */
function charToPixel(col: number, row: number): { x: number; y: number } {
	return { x: col * 2, y: row * 4 };
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

/** Returns the angle (radians, 0=right) the thumb end of the staff points toward */
function getOrientationAngle(orientation: Orientation, location: GridLocation): number {
	const r = getRadialAngle(location);
	switch (orientation) {
		case Orientation.IN: return r + Math.PI;
		case Orientation.OUT: return r;
		case Orientation.CLOCK: return r + Math.PI / 2;
		case Orientation.COUNTER: return r - Math.PI / 2;
		case Orientation.CLOCK_IN: return r + (Math.PI * 3) / 4;
		case Orientation.CLOCK_OUT: return r + Math.PI / 4;
		case Orientation.COUNTER_IN: return r - (Math.PI * 3) / 4;
		case Orientation.COUNTER_OUT: return r - Math.PI / 4;
		case Orientation.CENTER_N: return -Math.PI / 2;
		case Orientation.CENTER_S: return Math.PI / 2;
		case Orientation.CENTER_E: return 0;
		case Orientation.CENTER_W: return Math.PI;
		case Orientation.CENTER_NE: return -Math.PI / 4;
		case Orientation.CENTER_SE: return Math.PI / 4;
		case Orientation.CENTER_SW: return (3 * Math.PI) / 4;
		case Orientation.CENTER_NW: return (-3 * Math.PI) / 4;
		default: return -Math.PI / 2;
	}
}

/** Convert angle to nearest line-drawing character */
function angleToLineChar(angle: number): string {
	const a = ((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
	const sector = Math.round((a * 4) / Math.PI) % 8;
	switch (sector) {
		case 0: case 4: return "\u2500"; // ─
		case 1: case 5: return "\u2572"; // ╲
		case 2: case 6: return "\u2502"; // │
		case 3: case 7: return "\u2571"; // ╱
		default: return "\u2502";
	}
}

/** Perpendicular cap character for the thumb end */
function getThumbCapChar(lineChar: string): string {
	switch (lineChar) {
		case "\u2502": return "\u2500"; // │ → ─
		case "\u2500": return "\u2502"; // ─ → │
		case "\u2571": return "\u2572"; // ╱ → ╲
		case "\u2572": return "\u2571"; // ╲ → ╱
		default: return "\u2500";
	}
}

/**
 * Step vector per staff line character.
 * Diagonals use dcol=2 per drow=1 for the 2:1 monospace aspect ratio.
 */
function getStaffStep(lineChar: string): { dcol: number; drow: number } {
	switch (lineChar) {
		case "\u2502": return { dcol: 0, drow: 1 };
		case "\u2500": return { dcol: 1, drow: 0 };
		case "\u2571": return { dcol: 2, drow: -1 };
		case "\u2572": return { dcol: 2, drow: 1 };
		default: return { dcol: 0, drow: 1 };
	}
}

/** Max reach for staves to stay within the hand ring */
function getMaxReach(lineChar: string): number {
	switch (lineChar) {
		case "\u2500": return 9;  // ─ horizontal
		case "\u2571": case "\u2572": return 3; // diagonals
		default: return 5; // │ vertical
	}
}

/** Grid reference chars the staff must not overwrite */
const GRID_REFS = new Set(["\u25CF", "O", "o"]);

// ============================================================================
// BRAILLE HYBRID RENDERER
// ============================================================================

export class BrailleHybridRenderer implements IAsciiRenderer {

	// ========================================================================
	// PUBLIC INTERFACE
	// ========================================================================

	renderPictograph(data: RetroPictographData, options?: AsciiRenderOptions): string[] {
		const isBox = data.gridMode === GridMode.BOX;
		const height = isBox ? BOX_HEIGHT : DIAMOND_HEIGHT;
		const outerCoords = isBox ? BOX_OUTER : DIAMOND_OUTER;
		const handCoords = isBox ? BOX_HAND : DIAMOND_HAND;
		const layers = options?.layers;

		const ascii = new AsciiLayer(BUFFER_WIDTH, height);
		const braille = new BrailleLayer(BUFFER_WIDTH, height);

		// Center pixel coordinates for arrow geometry
		const centerCoord = outerCoords[GridLocation.CENTER];
		const center = charToPixel(centerCoord.col, centerCoord.row);

		// Step 1: Grid skeleton
		if (layers?.grid !== false) {
			this.drawGrid(ascii, outerCoords, handCoords, isBox);
		}

		// Step 2: Orientation staves
		if (layers?.staves !== false) {
			const isBeta = data.blueHand.endLocation === data.redHand.endLocation;
			if (isBeta) {
				const betaMap = isBox ? BOX_BETA : DIAMOND_BETA;
				const offsets = betaMap[data.blueHand.endLocation];
				const blueOffset = offsets?.blue ?? { dcol: -2, drow: 0 };
				const redOffset = offsets?.red ?? { dcol: 2, drow: 0 };
				this.drawStave(ascii, data.blueHand, handCoords, blueOffset);
				this.drawStave(ascii, data.redHand, handCoords, redOffset);
			} else {
				this.drawStave(ascii, data.blueHand, handCoords);
				this.drawStave(ascii, data.redHand, handCoords);
			}
		}

		// Step 3: Motion arrows (Braille layer, respecting ASCII)
		if (layers?.arrows !== false) {
			if (data.blueHand.motionType !== MotionType.STATIC) {
				this.drawArrow(braille, ascii, data.blueHand, outerCoords, center, BRAILLE_BLUE);
			}
			if (data.redHand.motionType !== MotionType.STATIC) {
				this.drawArrow(braille, ascii, data.redHand, outerCoords, center, BRAILLE_RED);
			}
		}

		// Step 4: Composite
		return this.composite(braille, ascii, height);
	}

	renderPlaceholder(): string[] {
		const height = DIAMOND_HEIGHT;
		const ascii = new AsciiLayer(BUFFER_WIDTH, height);
		const braille = new BrailleLayer(BUFFER_WIDTH, height);

		this.drawGrid(ascii, DIAMOND_OUTER, DIAMOND_HAND, false);

		// Replace center with "?"
		const center = DIAMOND_OUTER[GridLocation.CENTER];
		ascii.set(center.col, center.row, "?", COLOR_GRAY);

		return this.composite(braille, ascii, height);
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

		const bPart = blue.motionType === MotionType.STATIC
			? `<span class="${COLOR_BLUE}">B:${bLoc} ${bMot}</span>`
			: `<span class="${COLOR_BLUE}">B:${bLoc}>${bEnd} ${bMot}</span>`;

		const rPart = red.motionType === MotionType.STATIC
			? `<span class="${COLOR_RED}">R:${rLoc} ${rMot}</span>`
			: `<span class="${COLOR_RED}">R:${rLoc}>${rEnd} ${rMot}</span>`;

		return `[${bPart} | ${rPart}]`;
	}

	renderSequence(steps: RetroPictographData[], options?: AsciiRenderOptions): string[] {
		if (steps.length === 0) return this.renderPlaceholder();
		if (steps.length === 1) return this.renderPictograph(steps[0]!, options);

		const lines: string[] = [];

		for (let s = 0; s < steps.length; s++) {
			const step = steps[s]!;
			const stepLines = this.renderPictograph(step, options);

			if (s > 0) {
				lines.push("");
			}

			const bridgeTag = step.isBridge ? " (bridge)" : "";
			const label = ` STEP ${s + 1}: ${step.letter || "?"}${bridgeTag} `;
			const barTotal = BUFFER_WIDTH - label.length;
			const barLeft = Math.max(0, Math.floor(barTotal / 2));
			const barRight = Math.max(0, barTotal - barLeft);
			const separator =
				`<span class="${COLOR_GREEN}">${"\u2550".repeat(barLeft)}${label}${"\u2550".repeat(barRight)}</span>`;
			lines.push(separator);
			lines.push(...stepLines);
		}

		return lines;
	}

	// ========================================================================
	// STEP 1: GRID SKELETON
	// ========================================================================

	private drawGrid(
		ascii: AsciiLayer,
		outerCoords: Record<GridLocation, GridCoord>,
		handCoords: Record<GridLocation, GridCoord>,
		isBox: boolean,
	): void {
		// Outer position dots
		const marker = isBox ? "O" : "\u25CF";
		const outerPositions: GridLocation[] = isBox
			? [GridLocation.NORTHEAST, GridLocation.SOUTHEAST, GridLocation.SOUTHWEST, GridLocation.NORTHWEST]
			: [GridLocation.NORTH, GridLocation.EAST, GridLocation.SOUTH, GridLocation.WEST];

		for (const loc of outerPositions) {
			const coord = outerCoords[loc];
			ascii.set(coord.col, coord.row, marker, COLOR_WHITE);
		}

		// Center marker
		const center = outerCoords[GridLocation.CENTER];
		ascii.set(center.col, center.row, "o", COLOR_WHITE);

		// Hand position dots
		const handPositions: GridLocation[] = isBox
			? [GridLocation.NORTHEAST, GridLocation.SOUTHEAST, GridLocation.SOUTHWEST, GridLocation.NORTHWEST]
			: [GridLocation.NORTH, GridLocation.EAST, GridLocation.SOUTH, GridLocation.WEST];

		for (const loc of handPositions) {
			const coord = handCoords[loc];
			ascii.set(coord.col, coord.row, ".", COLOR_GRAY);
		}
	}

	// ========================================================================
	// STEP 2: ORIENTATION STAVES
	// ========================================================================

	private drawStave(
		ascii: AsciiLayer,
		hand: RetroHandData,
		coords: Record<GridLocation, GridCoord>,
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
		const maxReach = getMaxReach(lineChar);

		// Which step direction points toward the thumb
		const dot = Math.cos(angle) * step.dcol + Math.sin(angle) * step.drow;
		const thumbSign = dot >= 0 ? 1 : -1;
		const pinkySign = -thumbSign;

		const thumbReach = this.staffReach(ascii, coord, step, thumbSign, maxReach);
		const pinkyReach = this.staffReach(ascii, coord, step, pinkySign, maxReach);

		// Staff at hand position
		ascii.set(coord.col, coord.row, lineChar, color);

		// Body toward thumb
		for (let i = 1; i < thumbReach; i++) {
			ascii.set(
				coord.col + step.dcol * i * thumbSign,
				coord.row + step.drow * i * thumbSign,
				lineChar,
				color,
			);
		}

		// Thumb cap
		if (thumbReach > 0) {
			ascii.set(
				coord.col + step.dcol * thumbReach * thumbSign,
				coord.row + step.drow * thumbReach * thumbSign,
				getThumbCapChar(lineChar),
				color,
			);
		}

		// Body toward pinky (no cap)
		for (let i = 1; i <= pinkyReach; i++) {
			ascii.set(
				coord.col + step.dcol * i * pinkySign,
				coord.row + step.drow * i * pinkySign,
				lineChar,
				color,
			);
		}
	}

	/** Walk outward from hand position, stopping before grid refs or edges */
	private staffReach(
		ascii: AsciiLayer,
		origin: GridCoord,
		step: { dcol: number; drow: number },
		sign: number,
		maxReach: number,
	): number {
		let reach = 0;
		for (let i = 1; i <= maxReach; i++) {
			const c = origin.col + step.dcol * i * sign;
			const r = origin.row + step.drow * i * sign;

			if (r < 0 || r >= ascii.charH || c < 0 || c >= ascii.charW) break;

			const cell = ascii.cells[r]?.[c];
			if (cell?.active && cell.char !== null && GRID_REFS.has(cell.char)) {
				break;
			}

			reach = i;
		}
		return reach;
	}

	// ========================================================================
	// STEP 3: MOTION ARROWS (Braille Bezier curves)
	// ========================================================================

	private drawArrow(
		braille: BrailleLayer,
		ascii: AsciiLayer,
		hand: RetroHandData,
		outerCoords: Record<GridLocation, GridCoord>,
		center: { x: number; y: number },
		colorId: number,
	): void {
		if (hand.location === hand.endLocation) return;

		const startCoord = outerCoords[hand.location];
		const endCoord = outerCoords[hand.endLocation];
		let start = charToPixel(startCoord.col, startCoord.row);
		let end = charToPixel(endCoord.col, endCoord.row);

		const isCurved =
			hand.rotationDirection !== RotationDirection.NO_ROTATION &&
			hand.motionType !== MotionType.DASH;

		if (!isCurved) {
			// Straight arrow for DASH motions
			this.drawStraightBrailleArrow(braille, ascii, start, end, colorId);
			return;
		}

		// For anti (CCW) arrows: push endpoints radially outward so the
		// inward-bulging arc clears the staves
		if (hand.rotationDirection === RotationDirection.COUNTER_CLOCKWISE) {
			start = this.pushRadially(start, center, RADIAL_PUSH);
			end = this.pushRadially(end, center, RADIAL_PUSH);
		}

		const dx = end.x - start.x;
		const dy = end.y - start.y;
		const dist = Math.sqrt(dx * dx + dy * dy);
		if (dist < 1) return;

		// CW (pro) = outward bulge, CCW (anti) = inward bulge
		const sign = hand.rotationDirection === RotationDirection.CLOCKWISE ? -1 : 1;
		const perpX = -dy * sign;
		const perpY = dx * sign;
		const perpLen = Math.sqrt(perpX * perpX + perpY * perpY);

		const bulge = dist * BULGE_FACTOR;
		const cx = (start.x + end.x) / 2 + (perpX / perpLen) * bulge;
		const cy = (start.y + end.y) / 2 + (perpY / perpLen) * bulge;

		// Sample the quadratic Bezier
		const points: { x: number; y: number }[] = [];
		for (let i = 0; i <= CURVE_SAMPLES; i++) {
			const t = i / CURVE_SAMPLES;
			const u = 1 - t;
			points.push({
				x: u * u * start.x + 2 * u * t * cx + t * t * end.x,
				y: u * u * start.y + 2 * u * t * cy + t * t * end.y,
			});
		}

		// Find breathing room trim points
		let tStart = 0;
		let tEnd = points.length - 1;

		for (let i = 0; i < points.length; i++) {
			const d = Math.sqrt((points[i]!.x - start.x) ** 2 + (points[i]!.y - start.y) ** 2);
			if (d >= DOT_GAP) { tStart = i; break; }
		}
		for (let i = points.length - 1; i >= 0; i--) {
			const d = Math.sqrt((points[i]!.x - end.x) ** 2 + (points[i]!.y - end.y) ** 2);
			if (d >= DOT_GAP) { tEnd = i; break; }
		}

		// Draw the curve, skipping pixels near ASCII cells
		for (let i = tStart; i < tEnd; i++) {
			const px = Math.round(points[i]!.x);
			const py = Math.round(points[i]!.y);

			if (this.cellHasAscii(px, py, ascii)) continue;

			const px2 = Math.round(points[i + 1]!.x);
			const py2 = Math.round(points[i + 1]!.y);
			braille.line(px, py, px2, py2, colorId);

			// Thickness via perpendicular offset
			const next = points[Math.min(i + 2, points.length - 1)]!;
			const prev = points[Math.max(i - 1, 0)]!;
			const tdx = next.x - prev.x;
			const tdy = next.y - prev.y;
			const tlen = Math.sqrt(tdx * tdx + tdy * tdy);
			if (tlen > 0.5) {
				const nx = -tdy / tlen;
				const ny = tdx / tlen;
				for (let w = -1.2; w <= 1.2; w += 0.6) {
					const ox = Math.round(px + nx * w);
					const oy = Math.round(py + ny * w);
					if (!this.cellHasAscii(ox, oy, ascii)) {
						braille.setPixel(ox, oy, colorId);
					}
				}
			}
		}

		// Arrowhead at trimmed end
		this.drawArrowhead(braille, points, tStart, tEnd, colorId);
	}

	/** Straight Braille arrow for DASH motions */
	private drawStraightBrailleArrow(
		braille: BrailleLayer,
		ascii: AsciiLayer,
		start: { x: number; y: number },
		end: { x: number; y: number },
		colorId: number,
	): void {
		const dx = end.x - start.x;
		const dy = end.y - start.y;
		const dist = Math.sqrt(dx * dx + dy * dy);
		if (dist < 1) return;

		const samples = Math.max(Math.round(dist), 40);
		const points: { x: number; y: number }[] = [];
		for (let i = 0; i <= samples; i++) {
			const t = i / samples;
			points.push({
				x: start.x + dx * t,
				y: start.y + dy * t,
			});
		}

		let tStart = 0;
		let tEnd = points.length - 1;

		for (let i = 0; i < points.length; i++) {
			const d = Math.sqrt((points[i]!.x - start.x) ** 2 + (points[i]!.y - start.y) ** 2);
			if (d >= DOT_GAP) { tStart = i; break; }
		}
		for (let i = points.length - 1; i >= 0; i--) {
			const d = Math.sqrt((points[i]!.x - end.x) ** 2 + (points[i]!.y - end.y) ** 2);
			if (d >= DOT_GAP) { tEnd = i; break; }
		}

		for (let i = tStart; i < tEnd; i++) {
			const px = Math.round(points[i]!.x);
			const py = Math.round(points[i]!.y);
			if (this.cellHasAscii(px, py, ascii)) continue;

			const px2 = Math.round(points[i + 1]!.x);
			const py2 = Math.round(points[i + 1]!.y);
			braille.line(px, py, px2, py2, colorId);
		}

		this.drawArrowhead(braille, points, tStart, tEnd, colorId);
	}

	/** Push a point radially outward from center */
	private pushRadially(
		point: { x: number; y: number },
		center: { x: number; y: number },
		amount: number,
	): { x: number; y: number } {
		const dx = point.x - center.x;
		const dy = point.y - center.y;
		const len = Math.sqrt(dx * dx + dy * dy);
		if (len === 0) return point;
		return {
			x: point.x + (dx / len) * amount,
			y: point.y + (dy / len) * amount,
		};
	}

	/** Check if a pixel-space point's character cell (or neighbors) has ASCII content */
	private cellHasAscii(px: number, py: number, ascii: AsciiLayer): boolean {
		const cc = Math.floor(px / 2);
		const cr = Math.floor(py / 4);
		for (let dr = -ASCII_COLLISION_MARGIN; dr <= ASCII_COLLISION_MARGIN; dr++) {
			for (let dc = -ASCII_COLLISION_MARGIN; dc <= ASCII_COLLISION_MARGIN; dc++) {
				if (ascii.isActive(cc + dc, cr + dr)) return true;
			}
		}
		return false;
	}

	/** Draw Bresenham line barb arrowhead at the trimmed end of a curve */
	private drawArrowhead(
		braille: BrailleLayer,
		points: { x: number; y: number }[],
		tStart: number,
		tEnd: number,
		colorId: number,
	): void {
		if (tEnd <= tStart + 3) return;

		const tip = points[tEnd]!;
		const prev = points[Math.max(tEnd - 4, tStart)]!;
		const adx = tip.x - prev.x;
		const ady = tip.y - prev.y;
		const alen = Math.sqrt(adx * adx + ady * ady);
		if (alen <= 0.5) return;

		const ux = adx / alen;
		const uy = ady / alen;
		const px = -uy;
		const py = ux;
		const sz = 5;

		for (let w = -0.8; w <= 0.8; w += 0.4) {
			braille.line(
				Math.round(tip.x), Math.round(tip.y),
				Math.round(tip.x - ux * sz + px * (sz * 0.5 + w)),
				Math.round(tip.y - uy * sz + py * (sz * 0.5 + w)),
				colorId,
			);
			braille.line(
				Math.round(tip.x), Math.round(tip.y),
				Math.round(tip.x - ux * sz - px * (sz * 0.5 - w)),
				Math.round(tip.y - uy * sz - py * (sz * 0.5 - w)),
				colorId,
			);
		}
	}

	// ========================================================================
	// STEP 4: COMPOSITE - merge ASCII + Braille into HTML output
	// ========================================================================

	private composite(braille: BrailleLayer, ascii: AsciiLayer, height: number): string[] {
		const lines: string[] = [];

		for (let r = 0; r < height; r++) {
			let html = "";
			let currentColor: string | null = null;
			let run = "";

			for (let c = 0; c < BUFFER_WIDTH; c++) {
				let char: string;
				let cellColor: string | null;

				const a = ascii.cells[r]?.[c];
				if (a?.active && a.char !== null) {
					// ASCII wins
					char = a.char;
					cellColor = a.color;
				} else {
					// Braille fills the gap
					const b = braille.getCell(c, r);
					if (b.hasContent) {
						char = b.char;
						cellColor = b.color;
					} else {
						char = " ";
						cellColor = null;
					}
				}

				if (cellColor !== currentColor) {
					if (run.length > 0) {
						html += currentColor
							? `<span class="${currentColor}">${this.escapeHtml(run)}</span>`
							: this.escapeHtml(run);
					}
					currentColor = cellColor;
					run = char;
				} else {
					run += char;
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
