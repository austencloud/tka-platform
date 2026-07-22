/**
 * Mandala Export Service
 *
 * Renders a mandala to PNG via the SVG → Canvas pipeline.
 * Uses the shared geometry calculator and SVG renderer, then
 * rasterizes to a canvas for blob export.
 */

import { calculate as calculateMandalaGeometry } from "$lib/shared/mandala/services/mandala-geometry-calculator";
import { renderMandalaToCanvas } from "$lib/shared/mandala/services/mandala-renderer";
import { pairTipEnds } from "$lib/shared/pictograph/prop/domain/prop-tip-ends";
import type { StepLike } from "$lib/shared/mandala/services/types";
import type {
	MandalaPathShape,
	MandalaRenderOptions,
} from "$lib/shared/mandala/domain/mandala-types";
import { getMandalaPathOptions } from "$lib/shared/mandala/services/mandala-path-options";

export interface ExportOptions {
	size: number;
	background: "transparent" | "black" | "white";
	strokeWidth: number;
	show: MandalaRenderOptions["show"];
	pathShape: MandalaPathShape;
}

const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
	size: 1080,
	background: "transparent",
	strokeWidth: 2.5,
	show: "both",
	pathShape: "arc",
};

export async function exportMandalaPNG(
	steps: StepLike[],
	bluePropType: string | undefined,
	redPropType: string | undefined,
	options: Partial<ExportOptions> = {},
): Promise<Blob> {
	const opts = { ...DEFAULT_EXPORT_OPTIONS, ...options };
	const tipEnds = pairTipEnds(bluePropType, redPropType);
	const paths = calculateMandalaGeometry(
		steps,
		bluePropType,
		redPropType,
		getMandalaPathOptions(opts.pathShape, tipEnds),
	);

	const canvas = document.createElement("canvas");
	canvas.width = opts.size;
	canvas.height = opts.size;
	const ctx = canvas.getContext("2d")!;

	// Fill background if not transparent
	if (opts.background !== "transparent") {
		ctx.fillStyle = opts.background;
		ctx.fillRect(0, 0, opts.size, opts.size);
	}

	// Draw the mandala straight to the canvas via the shared canvas renderer.
	// (The old path rasterized renderMandalaSVG through an <img>, but that SVG is
	// emitted with width/height="100%" and no intrinsic pixel size, so the <img>
	// loaded 0-sized and the drawImage produced a blank PNG. renderMandalaToCanvas
	// is the same primitive the animated frame renderer uses — no SVG round-trip.)
	renderMandalaToCanvas(ctx, paths, {
		size: opts.size,
		style: "stroke",
		show: opts.show,
		strokeWidth: opts.strokeWidth,
		offsetX: 0,
		offsetY: 0,
	});

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
