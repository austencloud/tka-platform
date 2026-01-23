/**
 * Video Playback Controller Contract
 *
 * Manages intersection-based autoplay for videos in the feed.
 * Only one video plays at a time, always starting muted.
 */

export interface IVideoPlaybackController {
	/**
	 * Start observing a video element for visibility changes.
	 * Video will autoplay (muted) when >50% visible.
	 */
	observe(video: HTMLVideoElement): void;

	/**
	 * Stop observing a video element.
	 * Call this when the video is unmounted.
	 */
	unobserve(video: HTMLVideoElement): void;

	/**
	 * Mute all observed videos.
	 */
	muteAll(): void;

	/**
	 * Clean up all observers and references.
	 * Call this when the feed is unmounted.
	 */
	dispose(): void;
}
