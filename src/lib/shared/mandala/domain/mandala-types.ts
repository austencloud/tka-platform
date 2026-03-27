export interface SVGPathData {
	/** SVG path "d" attribute string */
	d: string;
	/** 0 = left end, 1 = right end (tip) — matches trail system endType */
	endType: 0 | 1;
}

export interface MandalaPaths {
	blue: SVGPathData[];
	red: SVGPathData[];
}

export interface MandalaRenderOptions {
	/** Pixel size of the SVG viewBox (square) */
	size: number;
	/** Stroke or filled petal rendering */
	style: "stroke" | "filled";
	/** Show cardinal/intercardinal grid dots + center */
	showGridDots: boolean;
	/** Which hands to render */
	show: "blue" | "red" | "both";
	/** SVG stroke width */
	strokeWidth?: number;
}

export type MandalaMode = "card-back" | "gallery" | "animated";

export interface MandalaPoint {
	x: number;
	y: number;
}
