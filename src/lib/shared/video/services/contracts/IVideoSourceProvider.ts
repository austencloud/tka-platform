/**
 * Shared video source provider interface.
 *
 * Manages a single <video> element and offscreen canvas so that multiple
 * modules (Video Trails, Skel2TKA, ML Training) can load videos, seek to
 * specific frames, and extract pixel data without each creating their own
 * video infrastructure.
 */

export interface VideoSourceInfo {
	url: string;
	duration: number;
	width: number;
	height: number;
	fps: number;
	frameCount: number;
	originalFileName?: string;
}

export interface IVideoSourceProvider {
	loadFromFile(file: File): Promise<VideoSourceInfo>;
	loadFromUrl(url: string, fileName?: string): Promise<VideoSourceInfo>;
	getVideoElement(): HTMLVideoElement | null;
	seekToFrame(frameIndex: number, fps: number): Promise<void>;
	extractFrame(frameIndex: number, fps: number): Promise<ImageData>;
	getCurrentFrameData(): ImageData | null;
	dispose(): void;
}
