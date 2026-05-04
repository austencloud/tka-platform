/**
 * Mandala Renderer
 *
 * Takes pre-computed MandalaPaths and renders them to either an SVG string
 * or a Canvas 2D context. Stateless - the same paths can be rendered
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
} from "../domain/mandala-constants";
import type { MandalaPaths, MandalaRenderOptions } from "../domain/mandala-types";

const GRID_DOT_ANGLES = [
	0,
	Math.PI / 4,
	Math.PI / 2,
	(3 * Math.PI) / 4,
	Math.PI,
	(5 * Math.PI) / 4,
	(3 * Math.PI) / 2,
	(7 * Math.PI) / 4,
];

const GRID_DOT_RADIUS = 2.5;

function strokeAttributes(color: string, strokeWidth: number): string {
	return `fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round" opacity="0.9"`;
}

function filledAttributes(strokeColor: string, fillColor: string, strokeWidth: number): string {
	const sw = (strokeWidth * 0.6).toFixed(2);
	return `fill="${fillColor}" stroke="${strokeColor}" stroke-width="${sw}" stroke-linecap="round"`;
}

function drawPath(
	ctx: CanvasRenderingContext2D,
	d: string,
	strokeColor: string,
	fillColor: string,
	style: "stroke" | "filled",
	strokeWidth: number,
): void {
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

export function renderMandalaSVG(paths: MandalaPaths, options: MandalaRenderOptions): string {
	const { size, style, showGridDots, show, strokeWidth = 2.5, transparentBackground = false } = options;
	const center = size / 2;

	const tipReach = (ENGINE_GRID_RADIUS - DEFAULT_TIP_INSET_PX) * MANDALA_GRID_RADIUS / ENGINE_GRID_RADIUS;
	const maxExtent = MANDALA_GRID_RADIUS + tipReach;
	const scale = center / (maxExtent * 1.05);

	const parts: string[] = [];

	parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="100%" height="100%">`);
	parts.push(`  <defs>`);
	parts.push(`    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">`);
	parts.push(`      <feGaussianBlur stdDeviation="3" result="blur"/>`);
	parts.push(`      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>`);
	parts.push(`    </filter>`);
	parts.push(`  </defs>`);

	if (!transparentBackground) {
		parts.push(`  <rect width="${size}" height="${size}" fill="#0d0d1a" rx="12"/>`);
	}

	parts.push(`  <g transform="translate(${center}, ${center}) scale(${scale.toFixed(4)})" filter="url(#glow)">`);

	if (showGridDots) {
		for (const angle of GRID_DOT_ANGLES) {
			const cx = (Math.cos(angle) * MANDALA_GRID_RADIUS).toFixed(2);
			const cy = (Math.sin(angle) * MANDALA_GRID_RADIUS).toFixed(2);
			parts.push(`    <circle cx="${cx}" cy="${cy}" r="${GRID_DOT_RADIUS}" fill="rgba(255,255,255,0.3)"/>`);
		}
		parts.push(`    <circle cx="0" cy="0" r="${GRID_DOT_RADIUS}" fill="rgba(255,255,255,0.3)"/>`);
	}

	const palette = options.palette ?? {
		blueStroke: BLUE_STROKE,
		blueFill: BLUE_FILL,
		redStroke: RED_STROKE,
		redFill: RED_FILL,
		purpleStroke: PURPLE_STROKE,
		purpleFill: PURPLE_FILL,
	};

	if (show === "blue" || show === "both") {
		for (const pathData of paths.blue) {
			const attrs = style === "filled"
				? filledAttributes(palette.blueStroke, palette.blueFill, strokeWidth)
				: strokeAttributes(palette.blueStroke, strokeWidth);
			parts.push(`    <path d="${pathData.d}" ${attrs}/>`);
		}
	}

	if (show === "red" || show === "both") {
		for (const pathData of paths.red) {
			const attrs = style === "filled"
				? filledAttributes(palette.redStroke, palette.redFill, strokeWidth)
				: strokeAttributes(palette.redStroke, strokeWidth);
			parts.push(`    <path d="${pathData.d}" ${attrs}/>`);
		}
	}

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

export function renderMandalaToCanvas(
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

	ctx.fillStyle = "#0d0d1a";
	ctx.beginPath();
	ctx.roundRect(offsetX, offsetY, size, size, 12);
	ctx.fill();

	ctx.translate(offsetX + center, offsetY + center);
	ctx.scale(scale, scale);

	if (showGridDots) {
		ctx.fillStyle = "rgba(255,255,255,0.3)";
		for (const angle of GRID_DOT_ANGLES) {
			const cx = Math.cos(angle) * MANDALA_GRID_RADIUS;
			const cy = Math.sin(angle) * MANDALA_GRID_RADIUS;
			ctx.beginPath();
			ctx.arc(cx, cy, GRID_DOT_RADIUS, 0, Math.PI * 2);
			ctx.fill();
		}
		ctx.beginPath();
		ctx.arc(0, 0, GRID_DOT_RADIUS, 0, Math.PI * 2);
		ctx.fill();
	}

	if (show === "blue" || show === "both") {
		for (const pathData of paths.blue) {
			drawPath(ctx, pathData.d, BLUE_STROKE, BLUE_FILL, style, strokeWidth);
		}
	}

	if (show === "red" || show === "both") {
		for (const pathData of paths.red) {
			drawPath(ctx, pathData.d, RED_STROKE, RED_FILL, style, strokeWidth);
		}
	}

	if (show === "both" && paths.purple?.length) {
		for (const pathData of paths.purple) {
			drawPath(ctx, pathData.d, PURPLE_STROKE, PURPLE_FILL, style, strokeWidth);
		}
	}

	ctx.restore();
}
