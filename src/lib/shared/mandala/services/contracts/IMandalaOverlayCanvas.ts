import type { MandalaOverlayRenderParams } from "../../domain/mandala-overlay-types";

export interface IMandalaOverlayCanvas {
	/** Create the overlay canvas and attach to container */
	initialize(container: HTMLElement, width: number, height: number): void;

	/** Handle canvas resize */
	resize(width: number, height: number): void;

	/** Draw one frame of the live mandala */
	renderFrame(params: MandalaOverlayRenderParams): void;

	/** Clear all drawn content and reset loop state */
	clear(): void;

	/** Called when the animation loops - transitions from accumulation to fade mode */
	onLoopDetected(): void;

	/** Show or hide the overlay canvas */
	setVisible(visible: boolean): void;

	/** Clean up canvas and release resources */
	dispose(): void;
}
