export interface SVGPathData {
	/** SVG path "d" attribute string */
	d: string;
	/** Index into prop's tip points array — matches trail system tipIndex */
	tipIndex: number;
}

export interface MandalaPaths {
	blue: SVGPathData[];
	red: SVGPathData[];
	purple: SVGPathData[];
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
	/** Transparent background (no dark rect) — use when embedding in themed containers */
	transparentBackground?: boolean;
}

export type MandalaMode = "card-back" | "gallery" | "animated";

export interface MandalaPoint {
	x: number;
	y: number;
}
