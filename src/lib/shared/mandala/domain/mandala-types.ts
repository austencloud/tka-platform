export interface SVGPathData {
	/** SVG path "d" attribute string */
	d: string;
	/** Index into prop's tip points array - matches trail system tipIndex */
	tipIndex: number;
}

/** Mandala color mode: fixed two-color pair, or animated flow morph. */
export type MandalaColorMode = "solid" | "flow";

/** Named color presets for the mandala viewer (+ "custom" two-color picker). */
export type MandalaPresetId =
	| "aurora"
	| "neon"
	| "ember"
	| "twilight"
	| "ice"
	| "solar"
	| "ink"
	| "gilded"
	| "abyss"
	| "custom";

export interface MandalaPaths {
	blue: SVGPathData[];
	red: SVGPathData[];
	purple: SVGPathData[];
}

/**
 * Optional color palette override. When omitted, MandalaRenderer falls back to
 * the dark-mode defaults (BLUE_STROKE/RED_STROKE/PURPLE_STROKE from
 * mandala-constants). Callers rendering against a light background should pass
 * the light-mode prop palette so the mandala matches the rest of the card.
 */
export interface MandalaPalette {
	blueStroke: string;
	blueFill: string;
	redStroke: string;
	redFill: string;
	purpleStroke: string;
	purpleFill: string;
}

export interface MandalaOverlapConfig {
	feather: number;
	bloomOpacity: number;
	bloomBlur: number;
	bloomWidth: number;
	coreOpacity: number;
}

export const DEFAULT_OVERLAP_CONFIG: MandalaOverlapConfig = {
	feather: 0.3,
	bloomOpacity: 0.3,
	bloomBlur: 4,
	bloomWidth: 2,
	coreOpacity: 1.0,
};

export interface MandalaRenderOptions {
	/** Pixel size of the SVG viewBox (square) */
	size: number;
	/** Stroke or filled petal rendering */
	style: "stroke" | "filled";
	/** Which hands to render */
	show: "blue" | "red" | "both";
	/** SVG stroke width */
	strokeWidth?: number;
	/** Override the default dark-mode prop colors (e.g. for light-mode backgrounds) */
	palette?: MandalaPalette;
	/** Overlap rendering parameters */
	overlap?: MandalaOverlapConfig;
	/** Current tip dx for dynamic viewBox scaling during animation */
	tipDx?: number;
	/** Per-path gradient colors: each path's stroke shifts from one color to the next */
	gradient?: { blue: [string, string]; red: [string, string]; purple: [string, string] };
	/**
	 * Canvas-only soft glow (px, DEVICE space — unaffected by ctx transform).
	 * When set, `renderMandalaToCanvas` strokes each path with a matching-color
	 * shadow to emulate the SVG `feGaussianBlur` glow + bloom filters, so the
	 * Path2D render reaches parity with the filtered `renderMandalaSVG` output
	 * without a 200ms SVG decode. Ignored by `renderMandalaSVG` (it has real
	 * filters). `bloomBlur` is the wider halo applied to the purple overlap.
	 */
	glow?: { blur: number; bloomBlur?: number };
	/**
	 * Canvas-only: reusable mask canvases for the purple-overlap pass. When the
	 * same pair is passed across many `renderMandalaToCanvas` calls (e.g. an
	 * export hot loop), it avoids allocating two full-res OffscreenCanvas per
	 * frame. Must match the target canvas size; mismatches fall back to fresh
	 * allocation.
	 */
	maskScratch?: { a: OffscreenCanvas; b: OffscreenCanvas };
}

export type MandalaPathShape = "arc" | "linear" | "concave" | "hybrid";

export type UndulationEasing =
	| "sine"
	| "ease"
	| "soft-elastic"
	| "breathe"
	| "heartbeat"
	| "drift"
	| "bloom"
	| "tidal";

export type MandalaMode = "card-back" | "gallery" | "animated";

export interface MandalaPoint {
	x: number;
	y: number;
}
