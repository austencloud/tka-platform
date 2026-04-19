/**
 * MandalaRenderer
 *
 * Takes pre-computed MandalaPaths and renders them to either an SVG string
 * or a Canvas 2D context. The renderer is stateless — it just translates
 * geometry data into drawing commands, so the same paths can be rendered
 * at any size or style without recomputation.
 */

import {
	MANDALA_GRID_RADIUS,
	ENGINE_GRID_RADIUS,
	DEFAULT_TIP_INSET_PX,
	BLUE_STROKE,
	RED_STROKE,
	BLUE_FILL,
	RED_FILL,
	PURPLE_STROKE,
	PURPLE_FILL,
} from "../../domain/mandala-constants";
import type { MandalaPaths, MandalaRenderOptions } from "../../domain/mandala-types";
import type { IMandalaRenderer } from "../contracts/IMandalaRenderer";

// ─── Grid dot positions ──────────────────────────────────────────────────────
// One dot at each cardinal/intercardinal direction at MANDALA_GRID_RADIUS from center.
// Angles match LOCATION_ANGLES in math-constants.ts (canvas Y-axis points down).
// E=0, SE=π/4, S=π/2, SW=3π/4, W=π, NW=5π/4, N=-π/2 (=3π/2), NE=-π/4 (=7π/4)

const GRID_DOT_ANGLES = [
	0,           // E
	Math.PI / 4, // SE
	Math.PI / 2, // S
	(3 * Math.PI) / 4, // SW
	Math.PI,     // W
	(5 * Math.PI) / 4, // NW
	(3 * Math.PI) / 2, // N
	(7 * Math.PI) / 4, // NE
];

const GRID_DOT_RADIUS = 2.5;

// ─── Style helpers ───────────────────────────────────────────────────────────

function strokeAttributes(color: string, strokeWidth: number): string {
	return `fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round" opacity="0.9"`;
}

function filledAttributes(strokeColor: string, fillColor: string, strokeWidth: number): string {
	const sw = (strokeWidth * 0.6).toFixed(2);
	return `fill="${fillColor}" stroke="${strokeColor}" stroke-width="${sw}" stroke-linecap="round"`;
}

// ─── Public class ────────────────────────────────────────────────────────────

export class MandalaRenderer implements IMandalaRenderer {
	/**
	 * Render paths to an SVG string. The result is a self-contained SVG element
	 * ready to embed in HTML or save as a file.
	 */
	renderSVG(paths: MandalaPaths, options: MandalaRenderOptions): string {
		const { size, style, showGridDots, show, strokeWidth = 2.5, transparentBackground = false } = options;
		const center = size / 2;

		// Scale from mandala coordinate space to pixel space.
		// Max content extent = grid radius + scaled tip reach.
		// Staff tip dx=150, minus 20px inset = 130, scaled by gridRadius/engineRadius.
		const tipReach = (ENGINE_GRID_RADIUS - DEFAULT_TIP_INSET_PX) * MANDALA_GRID_RADIUS / ENGINE_GRID_RADIUS;
		const maxExtent = MANDALA_GRID_RADIUS + tipReach;
		// Add 5% padding so strokes don't clip at the edge
		const scale = center / (maxExtent * 1.05);

		const parts: string[] = [];

		parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="100%" height="100%">`);

		// Glow filter for subtle luminosity on dark backgrounds
		parts.push(`  <defs>`);
		parts.push(`    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">`);
		parts.push(`      <feGaussianBlur stdDeviation="3" result="blur"/>`);
		parts.push(`      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>`);
		parts.push(`    </filter>`);
		parts.push(`  </defs>`);

		// Background — skip for card-back or other themed containers
		if (!transparentBackground) {
			parts.push(`  <rect width="${size}" height="${size}" fill="#0d0d1a" rx="12"/>`);
		}

		// All drawing happens in a group translated to the center, with glow
		parts.push(`  <g transform="translate(${center}, ${center}) scale(${scale.toFixed(4)})" filter="url(#glow)">`);

		// Grid dots at cardinal/intercardinal positions
		if (showGridDots) {
			for (const angle of GRID_DOT_ANGLES) {
				const cx = (Math.cos(angle) * MANDALA_GRID_RADIUS).toFixed(2);
				const cy = (Math.sin(angle) * MANDALA_GRID_RADIUS).toFixed(2);
				parts.push(`    <circle cx="${cx}" cy="${cy}" r="${GRID_DOT_RADIUS}" fill="rgba(255,255,255,0.3)"/>`);
			}
			// Center dot
			parts.push(`    <circle cx="0" cy="0" r="${GRID_DOT_RADIUS}" fill="rgba(255,255,255,0.3)"/>`);
		}

		// Palette falls back to the dark-mode defaults when the caller doesn't
		// pass an explicit palette (card-back on dark background is the original
		// use case).
		const palette = options.palette ?? {
			blueStroke: BLUE_STROKE,
			blueFill: BLUE_FILL,
			redStroke: RED_STROKE,
			redFill: RED_FILL,
			purpleStroke: PURPLE_STROKE,
			purpleFill: PURPLE_FILL,
		};

		// Render blue paths
		if (show === "blue" || show === "both") {
			for (const pathData of paths.blue) {
				const attrs = style === "filled"
					? filledAttributes(palette.blueStroke, palette.blueFill, strokeWidth)
					: strokeAttributes(palette.blueStroke, strokeWidth);
				parts.push(`    <path d="${pathData.d}" ${attrs}/>`);
			}
		}

		// Render red paths
		if (show === "red" || show === "both") {
			for (const pathData of paths.red) {
				const attrs = style === "filled"
					? filledAttributes(palette.redStroke, palette.redFill, strokeWidth)
					: strokeAttributes(palette.redStroke, strokeWidth);
				parts.push(`    <path d="${pathData.d}" ${attrs}/>`);
			}
		}

		// Render purple overlap paths on top — visually replaces blue+red in overlap regions
		if (show === "both" && paths.purple?.length) {
			for (const pathData of paths.purple) {
				const attrs = style === "filled"
					? filledAttributes(palette.purpleStroke, palette.purpleFill, strokeWidth)
					: strokeAttributes(palette.purpleStroke, strokeWidth);
				parts.push(`    <path d="${pathData.d}" ${attrs}/>`);
			}
		}

		parts.push(`  </g>`);
		parts.push(`</svg>`);

		return parts.join("\n");
	}

	/**
	 * Render paths to a Canvas 2D context. Accepts explicit pixel offsets so the
	 * caller can tile multiple mandalas onto a single canvas (e.g. card backs).
	 */
	renderToCanvas(
		ctx: CanvasRenderingContext2D,
		paths: MandalaPaths,
		options: MandalaRenderOptions & { offsetX: number; offsetY: number },
	): void {
		const { size, style, showGridDots, show, strokeWidth = 2, offsetX, offsetY } = options;
		const center = size / 2;
		const tipReach = (ENGINE_GRID_RADIUS - DEFAULT_TIP_INSET_PX) * MANDALA_GRID_RADIUS / ENGINE_GRID_RADIUS;
		const maxExtent = MANDALA_GRID_RADIUS + tipReach;
		const scale = center / (maxExtent * 1.05);

		ctx.save();

		// Dark background for this tile
		ctx.fillStyle = "#0d0d1a";
		ctx.beginPath();
		ctx.roundRect(offsetX, offsetY, size, size, 12);
		ctx.fill();

		// Translate to center of this mandala, then scale to coordinate space
		ctx.translate(offsetX + center, offsetY + center);
		ctx.scale(scale, scale);

		// Grid dots
		if (showGridDots) {
			ctx.fillStyle = "rgba(255,255,255,0.3)";
			for (const angle of GRID_DOT_ANGLES) {
				const cx = Math.cos(angle) * MANDALA_GRID_RADIUS;
				const cy = Math.sin(angle) * MANDALA_GRID_RADIUS;
				ctx.beginPath();
				ctx.arc(cx, cy, GRID_DOT_RADIUS, 0, Math.PI * 2);
				ctx.fill();
			}
			// Center dot
			ctx.beginPath();
			ctx.arc(0, 0, GRID_DOT_RADIUS, 0, Math.PI * 2);
			ctx.fill();
		}

		// Blue paths
		if (show === "blue" || show === "both") {
			for (const pathData of paths.blue) {
				this._drawPath(ctx, pathData.d, BLUE_STROKE, BLUE_FILL, style, strokeWidth);
			}
		}

		// Red paths
		if (show === "red" || show === "both") {
			for (const pathData of paths.red) {
				this._drawPath(ctx, pathData.d, RED_STROKE, RED_FILL, style, strokeWidth);
			}
		}

		// Purple overlap paths on top
		if (show === "both" && paths.purple?.length) {
			for (const pathData of paths.purple) {
				this._drawPath(ctx, pathData.d, PURPLE_STROKE, PURPLE_FILL, style, strokeWidth);
			}
		}

		ctx.restore();
	}

	// ─── Private helpers ─────────────────────────────────────────────────────

	private _drawPath(
		ctx: CanvasRenderingContext2D,
		d: string,
		strokeColor: string,
		fillColor: string,
		style: "stroke" | "filled",
		strokeWidth: number,
	): void {
		// Path2D accepts SVG path data strings directly — no manual parsing needed.
		const path = new Path2D(d);

		if (style === "filled") {
			ctx.fillStyle = fillColor;
			ctx.fill(path);
			ctx.strokeStyle = strokeColor;
			ctx.lineWidth = strokeWidth * 0.6;
			ctx.lineCap = "round";
			ctx.stroke(path);
		} else {
			ctx.strokeStyle = strokeColor;
			ctx.lineWidth = strokeWidth;
			ctx.lineCap = "round";
			ctx.globalAlpha = 0.9;
			ctx.stroke(path);
			ctx.globalAlpha = 1;
		}
	}
}
