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

import type { RetroPictographData } from "../../shared/domain/pictograph-types";

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
