/**
 * IRetroRenderer — Shared rendering contract for all retro eras.
 *
 * Each era implements this to transform pictograph data into
 * era-specific visual output:
 * - DOS: ASCII character art
 * - Win95: 64x64 pixel canvas with Bayer dithering
 * - Win98: 128x128 enhanced pixel canvas
 * - WinXP: Anti-aliased vector-style rendering
 */

import type { RetroPictographData } from "../../domain/pictograph-types";

/** Playback control returned by animation renderers */
export interface RetroPlaybackControl {
	play(): void;
	pause(): void;
	stop(): void;
	readonly isPlaying: boolean;
}

/** Frame callback for animation rendering */
export type RetroFrameCallback = (frameIndex: number, totalFrames: number) => void;

/**
 * Every era implements this interface to render TKA pictographs
 * in its own visual language.
 */
export interface IRetroRenderer {
	/** Render a single pictograph to the era's output target */
	renderPictograph(data: RetroPictographData, target: HTMLElement, size?: number): void;

	/** Render a placeholder (empty/loading state) */
	renderPlaceholder(target: HTMLElement, size?: number): void;

	/** Render an animated sequence of pictographs */
	renderAnimation(
		sequence: RetroPictographData[],
		target: HTMLElement,
		onFrame?: RetroFrameCallback,
	): RetroPlaybackControl;
}
