import type { MandalaPaths, MandalaRenderOptions } from "../../domain/mandala-types";

export interface IMandalaRenderer {
	renderSVG(paths: MandalaPaths, options: MandalaRenderOptions): string;
	renderToCanvas(
		ctx: CanvasRenderingContext2D,
		paths: MandalaPaths,
		options: MandalaRenderOptions & { offsetX: number; offsetY: number },
	): void;
}
