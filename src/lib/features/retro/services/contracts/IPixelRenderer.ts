/**
 * IPixelRenderer — Contract for the retro pixel pictograph renderer
 *
 * Renders TKA pictographs as chunky 16-color dithered bitmaps on
 * an HTML canvas, simulating what a 1995 EGA/VGA display would
 * produce if the Bellweather Technical Institute had shipped
 * SCRIBE.EXE with a built-in notation viewer.
 *
 * Domain: Retro SCRIBE App
 */

// ============================================================================
// RETRO PICTOGRAPH DATA
// ============================================================================

/**
 * Grid locations on the diamond grid.
 * Retro renderer only supports the 8 compass points + center.
 */
export type RetroGridLocation =
	| "n"
	| "ne"
	| "e"
	| "se"
	| "s"
	| "sw"
	| "w"
	| "nw"
	| "c";

/**
 * Simplified motion type for retro display.
 * No float or complex motions — this is 1995.
 */
export type RetroMotionType = "pro" | "anti" | "static" | "dash";

/**
 * Simplified prop orientation for retro display.
 * Cardinal orientations only — interradial and centric
 * orientations weren't invented until Level 5-6.
 */
export type RetroOrientation = "in" | "out" | "clock" | "counter";

/**
 * Hand/prop data for a single hand in a retro pictograph.
 */
export interface RetroHandData {
	/** Which hand: blue (left) or red (right) */
	readonly color: "blue" | "red";

	/** Where the hand sits on the grid */
	readonly location: RetroGridLocation;

	/** Which direction the prop points */
	readonly orientation: RetroOrientation;

	/** Motion type (determines arrow style) */
	readonly motionType: RetroMotionType;

	/** Where the hand ends up after the motion */
	readonly endLocation: RetroGridLocation;

	/** Number of turns (0, 0.5, 1, 1.5, 2, 2.5, 3) */
	readonly turns: number;
}

/**
 * Complete data for a single retro pictograph beat.
 * Intentionally simplified — this is a parody renderer.
 */
export interface RetroPictographData {
	/** The TKA letter this beat represents (e.g., "A", "Sigma") */
	readonly letter: string;

	/** Blue hand (left) */
	readonly blueHand: RetroHandData;

	/** Red hand (right) */
	readonly redHand: RetroHandData;

	/** Grid mode: diamond is the standard, box for intercardinal letters */
	readonly gridMode: "diamond" | "box";
}

// ============================================================================
// RENDERER INTERFACE
// ============================================================================

export interface IPixelRenderer {
	/**
	 * Render a retro pictograph onto a canvas element.
	 *
	 * Draws at 64x64 internal resolution. The caller scales the
	 * canvas to display size with `image-rendering: pixelated`.
	 *
	 * @param canvas - Target HTML canvas element
	 * @param data - Pictograph data to render
	 * @param size - Internal render size (default 64)
	 */
	render(canvas: HTMLCanvasElement, data: RetroPictographData, size?: number): void;

	/**
	 * Render a placeholder "no data" state.
	 *
	 * Gray fill with a centered "?" character.
	 *
	 * @param canvas - Target HTML canvas element
	 * @param size - Internal render size (default 64)
	 */
	renderPlaceholder(canvas: HTMLCanvasElement, size?: number): void;
}
