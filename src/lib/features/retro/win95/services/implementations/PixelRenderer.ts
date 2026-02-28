/**
 * PixelRenderer — 16-color dithered canvas renderer for retro pictographs
 *
 * Renders TKA pictograph data as chunky pixel art on an HTML canvas,
 * using the Windows 16-color palette with 4x4 Bayer matrix ordered
 * dithering for intermediate colors.
 *
 * Internal render resolution is 64x64. The canvas is set to this size
 * and the caller uses CSS `image-rendering: pixelated` + scaled display
 * dimensions to get crisp nearest-neighbor upscaling.
 *
 * Domain: Retro SCRIBE App
 */

import type { IPixelRenderer } from "../contracts/IPixelRenderer";
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
// WINDOWS 16-COLOR PALETTE
// ============================================================================

interface PaletteColor {
	r: number;
	g: number;
	b: number;
}

const WIN16_PALETTE: readonly PaletteColor[] = [
	{ r: 0x00, g: 0x00, b: 0x00 }, // 0  Black
	{ r: 0x80, g: 0x00, b: 0x00 }, // 1  Dark Red
	{ r: 0x00, g: 0x80, b: 0x00 }, // 2  Dark Green
	{ r: 0x80, g: 0x80, b: 0x00 }, // 3  Dark Yellow (Olive)
	{ r: 0x00, g: 0x00, b: 0x80 }, // 4  Dark Blue
	{ r: 0x80, g: 0x00, b: 0x80 }, // 5  Dark Magenta
	{ r: 0x00, g: 0x80, b: 0x80 }, // 6  Dark Cyan
	{ r: 0xc0, g: 0xc0, b: 0xc0 }, // 7  Silver
	{ r: 0x80, g: 0x80, b: 0x80 }, // 8  Gray
	{ r: 0xff, g: 0x00, b: 0x00 }, // 9  Red
	{ r: 0x00, g: 0xff, b: 0x00 }, // 10 Green
	{ r: 0xff, g: 0xff, b: 0x00 }, // 11 Yellow
	{ r: 0x00, g: 0x00, b: 0xff }, // 12 Blue
	{ r: 0xff, g: 0x00, b: 0xff }, // 13 Magenta
	{ r: 0x00, g: 0xff, b: 0xff }, // 14 Cyan
	{ r: 0xff, g: 0xff, b: 0xff }, // 15 White
] as const;

// ============================================================================
// BAYER DITHERING MATRIX (4x4)
// ============================================================================

/**
 * 4x4 Bayer ordered dithering matrix.
 * Values 0-15, normalized to 0-1 by dividing by 16.
 */
const BAYER_4X4 = [
	[0, 8, 2, 10],
	[12, 4, 14, 6],
	[3, 11, 1, 9],
	[15, 7, 13, 5],
] as const;

// ============================================================================
// GRID COORDINATE MAPPING
// ============================================================================

/**
 * Maps grid locations to normalized coordinates (0-1 range).
 * Diamond mode: hands at N/E/S/W, arrows at diagonals.
 * Box mode: hands at NE/SE/SW/NW.
 */
function getGridPosition(
	location: GridLocation,
	gridMode: GridMode,
	size: number,
): { x: number; y: number } {
	const center = size / 2;
	const radius = size * 0.35; // hand points are 35% from center

	const positions: Record<GridLocation, { x: number; y: number }> = {
		[GridLocation.NORTH]: { x: center, y: center - radius },
		[GridLocation.EAST]: { x: center + radius, y: center },
		[GridLocation.SOUTH]: { x: center, y: center + radius },
		[GridLocation.WEST]: { x: center - radius, y: center },
		[GridLocation.NORTHEAST]: { x: center + radius * 0.707, y: center - radius * 0.707 },
		[GridLocation.SOUTHEAST]: { x: center + radius * 0.707, y: center + radius * 0.707 },
		[GridLocation.SOUTHWEST]: { x: center - radius * 0.707, y: center + radius * 0.707 },
		[GridLocation.NORTHWEST]: { x: center - radius * 0.707, y: center - radius * 0.707 },
		[GridLocation.CENTER]: { x: center, y: center },
	};

	return positions[location];
}

/**
 * Get prop rotation angle in radians based on orientation and grid location.
 *
 * "in" = points toward center
 * "out" = points away from center
 * "clock" = perpendicular, 90deg clockwise from radial
 * "counter" = perpendicular, 90deg counter-clockwise from radial
 */
function getPropAngle(
	location: GridLocation,
	orientation: Orientation,
): number {
	// Angle from center to this grid location (radians, 0 = right, positive = clockwise)
	const locationAngles: Record<GridLocation, number> = {
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

	const baseAngle = locationAngles[location];

	// Cardinal orientations map directly
	switch (orientation) {
		case Orientation.IN:
			return baseAngle + Math.PI;
		case Orientation.OUT:
			return baseAngle;
		case Orientation.CLOCK:
			return baseAngle + Math.PI / 2;
		case Orientation.COUNTER:
			return baseAngle - Math.PI / 2;

		// Interradial orientations: split the difference between adjacent cardinals
		case Orientation.CLOCK_IN:
			return baseAngle + Math.PI * 0.75; // between CLOCK (+90) and IN (+180)
		case Orientation.CLOCK_OUT:
			return baseAngle + Math.PI / 4; // between CLOCK (+90) and OUT (0)
		case Orientation.COUNTER_IN:
			return baseAngle - Math.PI * 0.75; // between COUNTER (-90) and IN (+180)
		case Orientation.COUNTER_OUT:
			return baseAngle - Math.PI / 4; // between COUNTER (-90) and OUT (0)

		// Centric orientations: prop at center points toward a compass direction
		case Orientation.CENTER_N:
			return -Math.PI / 2;
		case Orientation.CENTER_NE:
			return -Math.PI / 4;
		case Orientation.CENTER_E:
			return 0;
		case Orientation.CENTER_SE:
			return Math.PI / 4;
		case Orientation.CENTER_S:
			return Math.PI / 2;
		case Orientation.CENTER_SW:
			return (3 * Math.PI) / 4;
		case Orientation.CENTER_W:
			return Math.PI;
		case Orientation.CENTER_NW:
			return (-3 * Math.PI) / 4;

		default:
			// Graceful fallback for any future orientation values
			return baseAngle;
	}
}

// ============================================================================
// PIXEL RENDERER IMPLEMENTATION
// ============================================================================

export class PixelRenderer implements IPixelRenderer {
	render(
		canvas: HTMLCanvasElement,
		data: RetroPictographData,
		size: number = 64,
	): void {
		canvas.width = size;
		canvas.height = size;

		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		// Disable smoothing for crisp pixels
		ctx.imageSmoothingEnabled = false;

		// 1. White background
		this.fillRect(ctx, 0, 0, size, size, WIN16_PALETTE[15]!);

		// 2. Draw grid lines
		this.drawGrid(ctx, data.gridMode, size);

		// 3. Draw center point
		this.drawCenterDot(ctx, size);

		// 4. Draw props (staves)
		this.drawProp(ctx, data.blueHand, data.gridMode, size);
		this.drawProp(ctx, data.redHand, data.gridMode, size);

		// 5. Draw hand position squares
		this.drawHand(ctx, data.blueHand, data.gridMode, size);
		this.drawHand(ctx, data.redHand, data.gridMode, size);

		// 6. Draw arrows (motion indicators)
		if (data.blueHand.motionType !== MotionType.STATIC) {
			this.drawArrow(ctx, data.blueHand, data.gridMode, size);
		}
		if (data.redHand.motionType !== MotionType.STATIC) {
			this.drawArrow(ctx, data.redHand, data.gridMode, size);
		}

		// 7. Black border
		this.drawBorder(ctx, size);

		// 8. Apply dithering pass to enforce 16-color palette
		this.applyDithering(ctx, size);
	}

	renderPlaceholder(canvas: HTMLCanvasElement, size: number = 64): void {
		canvas.width = size;
		canvas.height = size;

		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		ctx.imageSmoothingEnabled = false;

		// Gray fill
		this.fillRect(ctx, 0, 0, size, size, WIN16_PALETTE[7]!); // Silver

		// Black border
		this.drawBorder(ctx, size);

		// "?" in center
		const fontSize = Math.max(8, Math.floor(size * 0.4));
		ctx.fillStyle = "#000000";
		ctx.font = `bold ${fontSize}px monospace`;
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.fillText("?", size / 2, size / 2);

		// Dither the placeholder too
		this.applyDithering(ctx, size);
	}

	// ========================================================================
	// DRAWING PRIMITIVES
	// ========================================================================

	private fillRect(
		ctx: CanvasRenderingContext2D,
		x: number,
		y: number,
		w: number,
		h: number,
		color: PaletteColor,
	): void {
		ctx.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
		ctx.fillRect(Math.floor(x), Math.floor(y), Math.ceil(w), Math.ceil(h));
	}

	private drawBorder(ctx: CanvasRenderingContext2D, size: number): void {
		ctx.strokeStyle = "#000000";
		ctx.lineWidth = 1;
		ctx.strokeRect(0.5, 0.5, size - 1, size - 1);
	}

	// ========================================================================
	// GRID
	// ========================================================================

	private drawGrid(
		ctx: CanvasRenderingContext2D,
		gridMode: GridMode,
		size: number,
	): void {
		ctx.strokeStyle = "#808080"; // Gray
		ctx.lineWidth = 1;

		const center = size / 2;
		const radius = size * 0.42; // Grid lines extend a bit further than hand points

		if (gridMode === GridMode.DIAMOND) {
			// Diamond: lines from N-S and E-W through center
			this.drawLine(ctx, center, center - radius, center, center + radius);
			this.drawLine(ctx, center - radius, center, center + radius, center);
		} else if (gridMode === GridMode.BOX) {
			// Box: lines from NE-SW and NW-SE through center
			const d = radius * 0.707;
			this.drawLine(ctx, center - d, center - d, center + d, center + d);
			this.drawLine(ctx, center + d, center - d, center - d, center + d);
		} else {
			// Skewed / centric / trigrid: draw both diamond + box lines
			this.drawLine(ctx, center, center - radius, center, center + radius);
			this.drawLine(ctx, center - radius, center, center + radius, center);
			const d = radius * 0.707;
			this.drawLine(ctx, center - d, center - d, center + d, center + d);
			this.drawLine(ctx, center + d, center - d, center - d, center + d);
		}
	}

	private drawLine(
		ctx: CanvasRenderingContext2D,
		x1: number,
		y1: number,
		x2: number,
		y2: number,
	): void {
		ctx.beginPath();
		ctx.moveTo(Math.floor(x1) + 0.5, Math.floor(y1) + 0.5);
		ctx.lineTo(Math.floor(x2) + 0.5, Math.floor(y2) + 0.5);
		ctx.stroke();
	}

	// ========================================================================
	// CENTER DOT
	// ========================================================================

	private drawCenterDot(ctx: CanvasRenderingContext2D, size: number): void {
		const center = Math.floor(size / 2);
		const dotSize = Math.max(2, Math.floor(size / 16));
		const half = Math.floor(dotSize / 2);

		ctx.fillStyle = "#000000";
		ctx.fillRect(center - half, center - half, dotSize, dotSize);
	}

	// ========================================================================
	// HAND POSITION SQUARES
	// ========================================================================

	private drawHand(
		ctx: CanvasRenderingContext2D,
		hand: RetroHandData,
		gridMode: GridMode,
		size: number,
	): void {
		const pos = getGridPosition(hand.location, gridMode, size);
		const handSize = Math.max(4, Math.floor(size / 8));
		const half = Math.floor(handSize / 2);

		const color =
			hand.color === MotionColor.BLUE ? WIN16_PALETTE[12]! : WIN16_PALETTE[9]!;

		this.fillRect(ctx, pos.x - half, pos.y - half, handSize, handSize, color);
	}

	// ========================================================================
	// PROP (STAFF) RENDERING
	// ========================================================================

	private drawProp(
		ctx: CanvasRenderingContext2D,
		hand: RetroHandData,
		gridMode: GridMode,
		size: number,
	): void {
		const pos = getGridPosition(hand.location, gridMode, size);
		const angle = getPropAngle(hand.location, hand.orientation);

		const propLength = Math.max(6, Math.floor(size / 5));
		const propWidth = Math.max(2, Math.floor(size / 24));

		const color = hand.color === MotionColor.BLUE ? "#0000FF" : "#FF0000";

		ctx.save();
		ctx.translate(pos.x, pos.y);
		ctx.rotate(angle);

		// Draw the staff as a thick rectangle centered on the hand position
		ctx.fillStyle = color;
		ctx.fillRect(
			-Math.floor(propLength / 2),
			-Math.floor(propWidth / 2),
			propLength,
			propWidth,
		);

		ctx.restore();
	}

	// ========================================================================
	// ARROW RENDERING
	// ========================================================================

	private drawArrow(
		ctx: CanvasRenderingContext2D,
		hand: RetroHandData,
		gridMode: GridMode,
		size: number,
	): void {
		// For dash motions: straight line from start to end
		// For pro/anti: curved path indicator (simplified to straight line in retro)
		const startPos = getGridPosition(hand.location, gridMode, size);
		const endPos = getGridPosition(hand.endLocation, gridMode, size);

		// If start and end are the same, no arrow needed
		if (hand.location === hand.endLocation) return;

		const color = hand.color === MotionColor.BLUE ? "#0000FF" : "#FF0000";

		ctx.strokeStyle = color;
		ctx.lineWidth = 1;

		// Draw the shaft
		this.drawLine(ctx, startPos.x, startPos.y, endPos.x, endPos.y);

		// Draw arrowhead at end position
		this.drawArrowhead(ctx, startPos, endPos, color, size);
	}

	private drawArrowhead(
		ctx: CanvasRenderingContext2D,
		from: { x: number; y: number },
		to: { x: number; y: number },
		color: string,
		size: number,
	): void {
		const headSize = Math.max(3, Math.floor(size / 16));
		const angle = Math.atan2(to.y - from.y, to.x - from.x);

		const tipX = Math.floor(to.x);
		const tipY = Math.floor(to.y);

		const leftX = Math.floor(
			tipX - headSize * Math.cos(angle - Math.PI / 6),
		);
		const leftY = Math.floor(
			tipY - headSize * Math.sin(angle - Math.PI / 6),
		);
		const rightX = Math.floor(
			tipX - headSize * Math.cos(angle + Math.PI / 6),
		);
		const rightY = Math.floor(
			tipY - headSize * Math.sin(angle + Math.PI / 6),
		);

		ctx.fillStyle = color;
		ctx.beginPath();
		ctx.moveTo(tipX, tipY);
		ctx.lineTo(leftX, leftY);
		ctx.lineTo(rightX, rightY);
		ctx.closePath();
		ctx.fill();
	}

	// ========================================================================
	// BAYER DITHERING (16-COLOR QUANTIZATION)
	// ========================================================================

	/**
	 * Reads every pixel from the canvas, snaps each to the nearest
	 * Windows 16-color palette entry using ordered dithering, and
	 * writes the result back.
	 */
	private applyDithering(
		ctx: CanvasRenderingContext2D,
		size: number,
	): void {
		const imageData = ctx.getImageData(0, 0, size, size);
		const data = imageData.data;

		for (let y = 0; y < size; y++) {
			for (let x = 0; x < size; x++) {
				const idx = (y * size + x) * 4;
				const r = data[idx]!;
				const g = data[idx + 1]!;
				const b = data[idx + 2]!;

				// Bayer threshold for this pixel
				const threshold =
					(BAYER_4X4[y % 4]![x % 4]! / 16.0 - 0.5) * 64;

				// Apply threshold offset before quantization
				const dr = clampByte(r + threshold);
				const dg = clampByte(g + threshold);
				const db = clampByte(b + threshold);

				// Find nearest palette color
				const nearest = findNearestPaletteColor(dr, dg, db);

				data[idx] = nearest.r;
				data[idx + 1] = nearest.g;
				data[idx + 2] = nearest.b;
				// Alpha stays at 255
			}
		}

		ctx.putImageData(imageData, 0, 0);
	}
}

// ============================================================================
// PALETTE HELPERS
// ============================================================================

function clampByte(value: number): number {
	return Math.max(0, Math.min(255, Math.round(value)));
}

/**
 * Find the nearest color in the Windows 16-color palette using
 * Euclidean distance in RGB space.
 */
function findNearestPaletteColor(
	r: number,
	g: number,
	b: number,
): PaletteColor {
	let bestDist = Infinity;
	let bestColor = WIN16_PALETTE[0]!;

	for (const color of WIN16_PALETTE) {
		const dr = r - color.r;
		const dg = g - color.g;
		const db = b - color.b;
		const dist = dr * dr + dg * dg + db * db;

		if (dist < bestDist) {
			bestDist = dist;
			bestColor = color;
			if (dist === 0) break; // Exact match
		}
	}

	return bestColor;
}
