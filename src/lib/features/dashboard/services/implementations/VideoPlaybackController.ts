/**
 * Video Playback Controller Implementation
 *
 * Manages intersection-based autoplay for videos in the feed.
 * Uses IntersectionObserver with TikTok-style thresholds:
 * - Play when 75% visible (TikTok standard)
 * - Pause when <25% visible
 * Only one video plays at a time, always starting muted.
 */

import type { IVideoPlaybackController } from "../contracts/IVideoPlaybackController";

/** Minimum visibility ratio to start playback (TikTok uses 75%) */
const PLAY_THRESHOLD = 0.75;

/** Visibility ratio below which to pause */
const PAUSE_THRESHOLD = 0.25;

export class VideoPlaybackController implements IVideoPlaybackController {
	private observer: IntersectionObserver | null = null;
	private activeVideo: HTMLVideoElement | null = null;
	private videos = new Set<HTMLVideoElement>();

	constructor() {
		// Only create observer in browser environment
		if (typeof window !== "undefined" && typeof IntersectionObserver !== "undefined") {
			this.observer = new IntersectionObserver(
				(entries) => this.handleIntersection(entries),
				{ threshold: [0, 0.25, 0.5, 0.75, 1] }
			);
		}
	}

	private handleIntersection(entries: IntersectionObserverEntry[]) {
		for (const entry of entries) {
			const video = entry.target as HTMLVideoElement;

			if (entry.isIntersecting && entry.intersectionRatio >= PLAY_THRESHOLD) {
				// This video is 75%+ visible - play it
				this.playVideo(video);
			} else if (entry.intersectionRatio < PAUSE_THRESHOLD) {
				// Less than 25% visible - pause if this is active video
				if (video === this.activeVideo) {
					this.pauseVideo(video);
				}
			}
		}
	}

	private playVideo(video: HTMLVideoElement) {
		// Only one video plays at a time
		if (this.activeVideo && this.activeVideo !== video) {
			this.activeVideo.pause();
		}

		this.activeVideo = video;
		video.muted = true; // Always start muted (browser autoplay policy)

		// Attempt to play, ignore errors (autoplay may be blocked)
		video.play().catch(() => {
			// Autoplay blocked - this is expected in some scenarios
		});
	}

	private pauseVideo(video: HTMLVideoElement) {
		video.pause();
		if (this.activeVideo === video) {
			this.activeVideo = null;
		}
	}

	observe(video: HTMLVideoElement) {
		if (!this.observer) return;

		this.videos.add(video);
		this.observer.observe(video);
	}

	unobserve(video: HTMLVideoElement) {
		if (!this.observer) return;

		this.videos.delete(video);
		this.observer.unobserve(video);

		if (this.activeVideo === video) {
			this.activeVideo = null;
		}
	}

	muteAll() {
		for (const video of this.videos) {
			video.muted = true;
		}
	}

	dispose() {
		if (this.observer) {
			this.observer.disconnect();
			this.observer = null;
		}

		this.videos.clear();
		this.activeVideo = null;
	}
}
