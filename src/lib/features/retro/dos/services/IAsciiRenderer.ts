/**
 * IAsciiRenderer -- Contract for the DOS-era ASCII pictograph renderer
 *
 * Converts RetroPictographData into multi-line HTML-colored terminal output
 * using box-drawing characters, directional arrows, and color spans.
 * The renderer outputs character art that matches what Bellweather Technical
 * Institute's TKAUTIL.COM v1.0 would have produced on a monochrome terminal.
 *
 * Domain: Retro DOS Era
 */

import type { RetroPictographData } from "../../shared/domain/pictograph-types";

export interface AsciiRenderOptions {
	layers?: {
		grid?: boolean;
		hands?: boolean;
		staves?: boolean;
		arrows?: boolean;
	};
}

export interface IAsciiRenderer {
	/**
	 * Render a full pictograph as an array of HTML-colored terminal lines.
	 *
	 * Each line is a string containing HTML `<span>` tags for coloring
	 * (e.g., `<span class="dos-blue">B</span>`). The caller writes
	 * each line to the terminal via `writeHtml()`.
	 *
	 * Diamond grid: ~21 chars wide, ~11 lines tall.
	 * Box grid: ~21 chars wide, ~9 lines tall.
	 */
	renderPictograph(data: RetroPictographData, options?: AsciiRenderOptions): string[];

	/**
	 * Render a placeholder for empty or error states.
	 * Returns the same grid structure with "?" at center
	 * and no hand markers.
	 */
	renderPlaceholder(): string[];

	/**
	 * Render a compact single-line summary for listings and inline display.
	 *
	 * Format: `"[B:N->NE pro | R:S->SW anti]"` showing hand positions,
	 * motion type, and end location.
	 */
	renderCompact(data: RetroPictographData): string;

	/**
	 * Render multiple pictographs side by side as a horizontal sequence.
	 *
	 * Each step is rendered to its own buffer, then joined horizontally
	 * with a separator column. Shorter buffers (box mode = 11 rows) are
	 * vertically centered against taller ones (diamond = 13 rows).
	 */
	renderSequence(steps: RetroPictographData[], options?: AsciiRenderOptions): string[];
}
