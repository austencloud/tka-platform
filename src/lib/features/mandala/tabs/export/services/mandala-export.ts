/**
 * Mandala Export Service
 *
 * Renders a mandala to PNG via the SVG → Canvas pipeline.
 * Uses the shared geometry calculator and SVG renderer, then
 * rasterizes to a canvas for blob export.
 */

import { getMandalaGeometryCalculator } from "$lib/shared/mandala/getMandalaGeometryCalculator";
import { renderMandalaSVG } from "$lib/shared/mandala/services/mandala-renderer";
import type { MandalaRenderOptions } from "$lib/shared/mandala/domain/mandala-types";
import type { StepLike } from "$lib/shared/mandala/services/contracts/types";

export interface ExportOptions {
	size: number;
	background: "transparent" | "black" | "white";
	strokeWidth: number;
}

const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
	size: 1080,
	background: "transparent",
	strokeWidth: 2.5,
};

export async function exportMandalaPNG(
	steps: StepLike[],
	bluePropType: string | undefined,
	redPropType: string | undefined,
	options: Partial<ExportOptions> = {},
): Promise<Blob> {
	const opts = { ...DEFAULT_EXPORT_OPTIONS, ...options };
	const calculator = getMandalaGeometryCalculator();
	const paths = calculator.calculate(steps, bluePropType, redPropType);

	const renderOptions: MandalaRenderOptions = {
		size: opts.size,
		style: "stroke",
		show: "both",
		strokeWidth: opts.strokeWidth,
	};

	const svgString = renderMandalaSVG(paths, renderOptions);

	// Render SVG to canvas
	const canvas = document.createElement("canvas");
	canvas.width = opts.size;
	canvas.height = opts.size;
	const ctx = canvas.getContext("2d")!;

	// Fill background if not transparent
	if (opts.background !== "transparent") {
		ctx.fillStyle = opts.background;
		ctx.fillRect(0, 0, opts.size, opts.size);
	}

	// Convert SVG string to data URL and draw to canvas
	const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
	const url = URL.createObjectURL(svgBlob);

	try {
		const img = await loadImage(url);
		ctx.drawImage(img, 0, 0, opts.size, opts.size);
	} finally {
		URL.revokeObjectURL(url);
	}

	return new Promise<Blob>((resolve, reject) => {
		canvas.toBlob(
			(blob) => {
				if (blob) resolve(blob);
				else reject(new Error("Canvas toBlob returned null"));
			},
			"image/png",
		);
	});
}

export function downloadBlob(blob: Blob, filename: string): void {
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}

function loadImage(src: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => resolve(img);
		img.onerror = (e) => reject(new Error(`Failed to load image: ${e}`));
		img.src = src;
	});
}
