/**
 * Video Playback Controller Contract
 *
 * Interface for managing video playback in the feed.
 */

export interface IVideoPlaybackController {
	/**
	 * Register a video element for tracking.
	 */
	register(id: string, video: HTMLVideoElement): void;

	/**
	 * Unregister a video element.
	 */
	unregister(id: string): void;

	/**
	 * Play a specific video, pausing others.
	 */
	play(id: string): void;

	/**
	 * Pause a specific video.
	 */
	pause(id: string): void;

	/**
	 * Pause all videos.
	 */
	pauseAll(): void;

	/**
	 * Get the currently playing video ID.
	 */
	get currentPlayingId(): string | null;
}
