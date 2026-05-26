import type { PreparedMandalaPaths } from "../services/contracts/types";

export interface MandalaOverlayConfig {
	enabled: boolean;
	/** How long before fully faded - multiplier of loop duration (default: 1.0) */
	fadeDurationMultiplier: number;
	/** Line thickness in canvas pixels (default: 2.5) */
	strokeWidth: number;
	/** Which hands to draw */
	show: "blue" | "red" | "both";
	/** Global opacity of the overlay (0-1, default: 0.9) */
	opacity: number;
	/** Hide prop rendering for pure mandala view */
	hideProps: boolean;
}

export const DEFAULT_MANDALA_OVERLAY_CONFIG: MandalaOverlayConfig = {
	enabled: false,
	fadeDurationMultiplier: 1.0,
	strokeWidth: 2.5,
	show: "both",
	opacity: 0.9,
	hideProps: false,
};

/** Parameters passed to MandalaOverlayCanvas.renderFrame() each frame */
export interface MandalaOverlayRenderParams {
	/** Pre-computed Path2D objects with lengths and colors */
	preparedPaths: PreparedMandalaPaths | null;
	/** Animation progress through the sequence: 0.0 = start, 1.0 = end of loop */
	progress: number;
	config: MandalaOverlayConfig;
	/** Seconds since last frame */
	deltaTime: number;
	/** Canvas size in pixels */
	canvasSize: number;
	/** Current animation step index - used to detect seeks/jumps */
	currentStep: number;
}
