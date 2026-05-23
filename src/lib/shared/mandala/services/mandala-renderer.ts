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
import { DEFAULT_OVERLAP_CONFIG } from "../domain/mandala-types";
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

let maskIdCounter = 0;

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

function drawMaskPath(
	ctx: OffscreenCanvasRenderingContext2D,
	d: string,
	style: "stroke" | "filled",
	strokeWidth: number,
): void {
	const path = new Path2D(d);
	if (style === "filled") {
		ctx.fillStyle = "white";
		ctx.fill(path);
		ctx.strokeStyle = "white";
		ctx.lineWidth = strokeWidth * 0.6;
		ctx.lineCap = "round";
		ctx.stroke(path);
	} else {
		ctx.strokeStyle = "white";
		ctx.lineWidth = strokeWidth;
		ctx.lineCap = "round";
		ctx.stroke(path);
	}
}

export function renderMandalaSVG(paths: MandalaPaths, options: MandalaRenderOptions): string {
	const { size, style, showGridDots, show, strokeWidth = 2.5, transparentBackground = false } = options;
	const center = size / 2;

	const tipReach = (ENGINE_GRID_RADIUS - DEFAULT_TIP_INSET_PX) * MANDALA_GRID_RADIUS / ENGINE_GRID_RADIUS;
	const maxExtent = MANDALA_GRID_RADIUS + tipReach;
	const scale = center / (maxExtent * 1.05);

	const parts: string[] = [];

	const uid = maskIdCounter++;
	const needsMask = show === "both" && paths.blue.length > 0 && paths.red.length > 0;
	const ov = options.overlap ?? DEFAULT_OVERLAP_CONFIG;

	parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="100%" height="100%" overflow="hidden">`);
	parts.push(`  <defs>`);
	parts.push(`    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">`);
	parts.push(`      <feGaussianBlur stdDeviation="3" result="blur"/>`);
	parts.push(`      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>`);
	parts.push(`    </filter>`);

	if (needsMask) {
		parts.push(`    <filter id="feather${uid}" x="-10%" y="-10%" width="120%" height="120%">`);
		parts.push(`      <feGaussianBlur stdDeviation="${ov.feather}"/>`);
		parts.push(`    </filter>`);
		parts.push(`    <filter id="bloom${uid}" x="-50%" y="-50%" width="200%" height="200%">`);
		parts.push(`      <feGaussianBlur stdDeviation="${ov.bloomBlur}" result="b"/>`);
		parts.push(`      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>`);
		parts.push(`    </filter>`);
		parts.push(`    <mask id="bom${uid}">`);
		parts.push(`      <g filter="url(#feather${uid})">`);
		for (const pathData of paths.blue) {
			if (style === "filled") {
				const sw = (strokeWidth * 0.6).toFixed(2);
				parts.push(`        <path d="${pathData.d}" fill="white" stroke="white" stroke-width="${sw}" stroke-linecap="round"/>`);
			} else {
				parts.push(`        <path d="${pathData.d}" fill="none" stroke="white" stroke-width="${strokeWidth}" stroke-linecap="round"/>`);
			}
		}
		parts.push(`      </g>`);
		parts.push(`    </mask>`);
	}

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

	if (needsMask) {
		const purpleCore = style === "filled"
			? `fill="${palette.purpleFill}" stroke="${palette.purpleStroke}" stroke-width="${(strokeWidth * 0.6).toFixed(2)}" stroke-linecap="round"`
			: `fill="none" stroke="${palette.purpleStroke}" stroke-width="${strokeWidth}" stroke-linecap="round"`;
		parts.push(`    <g mask="url(#bom${uid})" opacity="${ov.coreOpacity}">`);
		for (const pathData of paths.red) {
			parts.push(`      <path d="${pathData.d}" ${purpleCore}/>`);
		}
		parts.push(`    </g>`);

		const bloomWidth = style === "filled" ? strokeWidth : strokeWidth * ov.bloomWidth;
		parts.push(`    <g mask="url(#bom${uid})" filter="url(#bloom${uid})" opacity="${ov.bloomOpacity}">`);
		for (const pathData of paths.red) {
			parts.push(`      <path d="${pathData.d}" fill="none" stroke="${palette.purpleStroke}" stroke-width="${bloomWidth}" stroke-linecap="round"/>`);
		}
		parts.push(`    </g>`);
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
	const { size, style, showGridDots, show, strokeWidth = 2, offsetX, offsetY, transparentBackground = false } = options;
	const center = size / 2;
	const tipReach = (ENGINE_GRID_RADIUS - DEFAULT_TIP_INSET_PX) * MANDALA_GRID_RADIUS / ENGINE_GRID_RADIUS;
	const maxExtent = MANDALA_GRID_RADIUS + tipReach;
	const scale = center / (maxExtent * 1.05);

	ctx.save();

	if (!transparentBackground) {
		ctx.fillStyle = "#0d0d1a";
		ctx.beginPath();
		ctx.roundRect(offsetX, offsetY, size, size, 12);
		ctx.fill();
	}

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
			drawPath(ctx, pathData.d, palette.blueStroke, palette.blueFill, style, strokeWidth);
		}
	}

	if (show === "red" || show === "both") {
		for (const pathData of paths.red) {
			drawPath(ctx, pathData.d, palette.redStroke, palette.redFill, style, strokeWidth);
		}
	}

	if (show === "both" && paths.blue.length > 0 && paths.red.length > 0) {
		const transform = ctx.getTransform();
		const w = ctx.canvas.width;
		const h = ctx.canvas.height;

		const maskB = new OffscreenCanvas(w, h);
		const maskR = new OffscreenCanvas(w, h);
		const bC = maskB.getContext("2d")!;
		const rC = maskR.getContext("2d")!;

		bC.setTransform(transform);
		rC.setTransform(transform);

		for (const p of paths.blue) {
			drawMaskPath(bC, p.d, style, strokeWidth);
		}
		for (const p of paths.red) {
			drawMaskPath(rC, p.d, style, strokeWidth);
		}

		bC.setTransform(1, 0, 0, 1, 0, 0);
		bC.globalCompositeOperation = "destination-in";
		bC.drawImage(maskR, 0, 0);

		bC.globalCompositeOperation = "source-in";
		bC.fillStyle = options.palette?.purpleStroke ?? PURPLE_STROKE;
		bC.fillRect(0, 0, w, h);

		ctx.save();
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.globalAlpha = 0.9;
		ctx.drawImage(maskB, 0, 0);
		ctx.restore();
	}

	ctx.restore();
}
