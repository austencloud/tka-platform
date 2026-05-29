/**
 * Mandala Overlay Canvas
 *
 * Dedicated Canvas2D overlay for live mandala rendering. Draws pre-computed
 * bezier paths using setLineDash progressive reveal, so the mandala traces
 * out smoothly in sync with animation playback. After the first loop
 * completes, destination-out fade gradually erases old content so the
 * mandala stays fresh without unbounded accumulation.
 *
 * Follows the same overlay pattern as TrailOverlayCanvas:
 * position: absolute, pointer-events: none. Uses z-index: 0 so it renders
 * BEHIND trails (z-index 1).
 */

import type { MandalaOverlayRenderParams } from "../domain/mandala-overlay-types";
import {
	OVERLAY_WARMUP_FRAMES,
	OVERLAY_ALPHA_DECAY,
} from "../domain/mandala-constants";

export class MandalaOverlayCanvas {
	private canvas: HTMLCanvasElement | null = null;
	private ctx: CanvasRenderingContext2D | null = null;
	private bufferCanvas: OffscreenCanvas | null = null;
	private bufferCtx: OffscreenCanvasRenderingContext2D | null = null;
	private width = 0;
	private height = 0;
	private dpr = 1;

	// After the first full loop, we start fading old content so the
	// mandala doesn't accumulate indefinitely
	private firstLoopComplete = false;

	// Smooth ramp-up: after first loop detected, gradually increase fade
	// intensity over ~3 seconds so the transition isn't jarring.
	// 0.0 = no fade, 1.0 = full fade rate.
	private fadeRampProgress = 0;
	private static readonly FADE_RAMP_DURATION_S = 3.0;

	// Track the current step to detect seeks/jumps. When the step changes
	// non-sequentially (user clicked to a different beat), clear the canvas
	// so we don't show stale content from a different part of the sequence.
	private lastStep = -1;

	// Let props settle before drawing - the first few frames often have
	// props at intermediate positions before the animation engine places
	// them, which produces artifact lines
	private warmupFramesRemaining = OVERLAY_WARMUP_FRAMES;

	initialize(container: HTMLElement, width: number, height: number): void {
		this.dispose();

		const dpr = typeof window !== "undefined" ? window.devicePixelRatio ?? 1 : 1;
		this.dpr = dpr;

		const canvas = document.createElement("canvas");
		// Set canvas buffer to high-DPI resolution
		canvas.width = width * dpr;
		canvas.height = height * dpr;
		canvas.setAttribute("aria-hidden", "true");

		// CSS size matches the logical container size
		canvas.style.position = "absolute";
		canvas.style.top = "0";
		canvas.style.left = "0";
		canvas.style.width = "100%";
		canvas.style.height = "100%";
		canvas.style.pointerEvents = "none";
		canvas.style.zIndex = "0";
		canvas.style.background = "transparent";

		container.appendChild(canvas);

		this.canvas = canvas;
		this.ctx = canvas.getContext("2d", { willReadFrequently: true });
		// Scale the context so drawing commands use logical pixels
		this.ctx?.scale(dpr, dpr);

		this.bufferCanvas = new OffscreenCanvas(width * dpr, height * dpr);
		this.bufferCtx = this.bufferCanvas.getContext("2d");
		this.bufferCtx?.scale(dpr, dpr);

		this.width = width;
		this.height = height;
		this.warmupFramesRemaining = OVERLAY_WARMUP_FRAMES;
	}

	resize(width: number, height: number): void {
		if (!this.canvas) return;

		const dpr = this.dpr;
		this.canvas.width = width * dpr;
		this.canvas.height = height * dpr;

		// Re-apply scale after dimension change (resets the transform)
		this.ctx?.scale(dpr, dpr);

		if (this.bufferCanvas) {
			this.bufferCanvas.width = width * dpr;
			this.bufferCanvas.height = height * dpr;
			this.bufferCtx?.scale(dpr, dpr);
		}

		this.width = width;
		this.height = height;

		this.warmupFramesRemaining = OVERLAY_WARMUP_FRAMES;
	}

	renderFrame(params: MandalaOverlayRenderParams): void {
		const ctx = this.ctx;
		if (!ctx || !params.config.enabled || !params.preparedPaths) return;

		const { preparedPaths, progress, config, deltaTime, currentStep } = params;

		// Let props settle before capturing - first frames often have
		// intermediate positions that produce artifact lines
		if (this.warmupFramesRemaining > 0) {
			this.warmupFramesRemaining--;
			this.lastStep = currentStep;
			return;
		}

		// Detect non-sequential step changes (user clicked/seeked to a new beat).
		// When this happens, clear the canvas to prevent stale content.
		if (this.lastStep >= 0) {
			const stepDiff = Math.abs(currentStep - this.lastStep);
			if (stepDiff > 1) {
				ctx.save();
				ctx.setTransform(1, 0, 0, 1, 0, 0);
				ctx.clearRect(0, 0, this.width * this.dpr, this.height * this.dpr);
				ctx.restore();
			}
		}
		this.lastStep = currentStep;

		// After the first loop completes, fade old content so the mandala
		// doesn't accumulate indefinitely. The fade ramps up gradually
		// over FADE_RAMP_DURATION_S seconds to avoid a jarring transition.
		if (this.firstLoopComplete) {
			this.fadeRampProgress = Math.min(
				1.0,
				this.fadeRampProgress + deltaTime / MandalaOverlayCanvas.FADE_RAMP_DURATION_S,
			);

			const easedRamp = this.fadeRampProgress * this.fadeRampProgress;

			// Use a long fade duration - about 1.5x the loop for gentle tail
			const fadeDurationMs = 12000 * (config.fadeDurationMultiplier ?? 1.0);
			const fadeAmount = this.computeFadeAmount(fadeDurationMs, deltaTime) * easedRamp;

			if (fadeAmount > 0.0001) {
				ctx.save();
				ctx.setTransform(1, 0, 0, 1, 0, 0);
				ctx.globalCompositeOperation = "destination-out";
				ctx.globalAlpha = fadeAmount;
				ctx.fillStyle = "black";
				ctx.fillRect(0, 0, this.width * this.dpr, this.height * this.dpr);
				ctx.restore();

				if (easedRamp > 0.5) {
					this.smoothAlphaDecay(ctx);
				}
			}
		}

		// Draw pre-computed paths up to current progress
		const bCtx = this.bufferCtx;
		if (!bCtx) return;

		// Clear buffer (full pixel dimensions)
		bCtx.save();
		bCtx.setTransform(1, 0, 0, 1, 0, 0);
		bCtx.clearRect(0, 0, this.width * this.dpr, this.height * this.dpr);
		bCtx.restore();

		// Apply mandala coordinate transform: translate to center, scale to fit
		const center = this.width / 2;
		const { paths, scale } = preparedPaths;

		bCtx.save();
		bCtx.translate(center, center);
		bCtx.scale(scale, scale);

		// Compensate stroke width for the scale transform so it stays consistent in pixels
		const adjustedStrokeWidth = config.strokeWidth / scale;

		for (const { path2d, totalLength, color } of paths) {
			const revealLength = totalLength * Math.max(0, Math.min(1, progress));

			bCtx.strokeStyle = color;
			bCtx.lineWidth = adjustedStrokeWidth;
			bCtx.lineCap = "round";
			bCtx.lineJoin = "round";
			bCtx.globalAlpha = 0.85;
			bCtx.setLineDash([revealLength, totalLength]);
			bCtx.lineDashOffset = 0;
			bCtx.stroke(path2d);
		}

		bCtx.restore();

		// Composite buffer onto main canvas
		ctx.save();
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.globalCompositeOperation = "source-over";
		ctx.globalAlpha = 1.0;
		ctx.drawImage(this.bufferCanvas!, 0, 0);
		ctx.restore();
	}

	clear(): void {
		if (this.ctx) {
			this.ctx.save();
			this.ctx.setTransform(1, 0, 0, 1, 0, 0);
			this.ctx.clearRect(0, 0, this.width * this.dpr, this.height * this.dpr);
			this.ctx.restore();
		}
		this.firstLoopComplete = false;
		this.fadeRampProgress = 0;
		this.lastStep = -1;
		this.warmupFramesRemaining = OVERLAY_WARMUP_FRAMES;
	}

	onLoopDetected(): void {
		if (!this.firstLoopComplete) {
			this.firstLoopComplete = true;
			this.fadeRampProgress = 0; // Start the ramp from zero
		}
	}

	setVisible(visible: boolean): void {
		if (!this.canvas) return;
		this.canvas.style.display = visible ? "block" : "none";
	}

	dispose(): void {
		if (this.canvas?.parentElement) {
			this.canvas.parentElement.removeChild(this.canvas);
		}
		this.canvas = null;
		this.ctx = null;
		this.bufferCanvas = null;
		this.bufferCtx = null;
		this.width = 0;
		this.height = 0;
		this.firstLoopComplete = false;
		this.fadeRampProgress = 0;
	}

	// -------------------------------------------------------------------
	// Internal helpers
	// -------------------------------------------------------------------

	/**
	 * Compute fade amount per frame. Same formula as TrailOverlayCanvas:
	 * converts a duration in ms to a per-frame fade multiplier using the
	 * exponential decay model.
	 */
	private computeFadeAmount(fadeDurationMs: number, deltaTime: number): number {
		const safeDuration = Math.max(fadeDurationMs, 16.67);
		const framesForFullFade = safeDuration / 16.67;
		const baseFade = 3.5 / framesForFullFade;
		return 1 - Math.pow(1 - baseFade, deltaTime * 60);
	}

	/**
	 * Subtract a constant from every low-alpha pixel. Destination-out's
	 * multiplicative fade can never reach 0 due to 8-bit integer rounding.
	 * Constant subtraction guarantees every pixel eventually reaches 0.
	 */
	private smoothAlphaDecay(ctx: CanvasRenderingContext2D): void {
		// getImageData operates on actual pixel buffer, not logical coords
		const w = this.width * this.dpr;
		const h = this.height * this.dpr;
		if (w === 0 || h === 0) return;

		// Save/restore to avoid the DPR scale affecting getImageData coordinates
		ctx.save();
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		const imageData = ctx.getImageData(0, 0, w, h);
		const data = imageData.data;
		let dirty = false;

		for (let i = 3; i < data.length; i += 4) {
			const a = data[i]!;
			if (a > 0 && a <= 28) {
				data[i] = Math.max(0, a - OVERLAY_ALPHA_DECAY);
				dirty = true;
			}
		}

		if (dirty) {
			ctx.putImageData(imageData, 0, 0);
		}
		ctx.restore();
	}
}
