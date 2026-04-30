/**
 * Shared frame extractor interface.
 *
 * Extracts frames from a video element at specified intervals using an
 * async generator pattern. This keeps memory usage low because only one
 * frame's ImageData is alive at a time - the consumer processes and
 * discards each frame before the next one is extracted.
 *
 * Used by Skel2TKA's VideoFrameExtractor and ML Training's DataCapturer.
 */

export interface ExtractedFrame {
	index: number;
	timestamp: number;
	imageData: ImageData;
	width: number;
	height: number;
}

export interface FrameExtractionConfig {
	startFrame: number;
	endFrame: number;
	/** Extract every Nth frame. 1 = every frame, 2 = every other frame, etc. */
	stepSize: number;
	fps: number;
}

export interface IFrameExtractor {
	extractFrames(
		videoElement: HTMLVideoElement,
		config: FrameExtractionConfig,
		onProgress: (progress: number) => void,
	): AsyncGenerator<ExtractedFrame>;

	extractSingleFrame(
		videoElement: HTMLVideoElement,
		frameIndex: number,
		fps: number,
	): Promise<ExtractedFrame>;
}
