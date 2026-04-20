/**
 * ILedOverlayRenderer
 *
 * Interface for the WebGL LED overlay that composites
 * additive glow sprites with PBR bloom and POV trail
 * accumulation on top of the Canvas2D animation.
 */

import type { LedFrameInput, LedOverlayConfig } from "../../domain/types/LedTypes";

export interface ILedOverlayRenderer {
	/**
	 * Create the WebGL canvas, compile shaders, allocate framebuffers.
	 * @param container - Parent element to append the overlay canvas into
	 * @param width - Initial canvas width in CSS pixels
	 * @param height - Initial canvas height in CSS pixels
	 */
	initialize(container: HTMLElement, width: number, height: number): boolean;

	/**
	 * Resize the overlay canvas (e.g., when container resizes).
	 */
	resize(width: number, height: number): void;

	/**
	 * Render one frame of LEDs.
	 * Called after Canvas2D renderScene() in the same RAF tick.
	 */
	renderLeds(input: LedFrameInput, config: LedOverlayConfig): void;

	/**
	 * Clean up WebGL resources and remove canvas from DOM.
	 */
	dispose(): void;

	/**
	 * Whether the renderer has been successfully initialized.
	 */
	isInitialized(): boolean;

	/**
	 * Return the underlying canvas element (for clearing when switching render modes).
	 */
	getCanvas(): HTMLCanvasElement | null;

	/**
	 * Set the CSS z-index on the overlay canvas.
	 */
	setCanvasZIndex(z: number): void;
}
