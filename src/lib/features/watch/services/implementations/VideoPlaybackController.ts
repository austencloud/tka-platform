/**
 * Video Playback Controller Implementation
 *
 * Manages intersection-based autoplay for videos in the feed.
 * Uses IntersectionObserver with TikTok-style thresholds:
 * - Play when 75% visible (TikTok standard)
 * - Pause when <25% visible
 * Only one video plays at a time, always starting muted.
 */

/** Minimum visibility ratio to start playback (TikTok uses 75%) */
const PLAY_THRESHOLD = 0.75;

/** Visibility ratio below which to pause */
const PAUSE_THRESHOLD = 0.25;

export class VideoPlaybackController {
	private observer: IntersectionObserver | null = null;
	private videoElements = new Map<string, HTMLVideoElement>();
	private _currentPlayingId: string | null = null;

	constructor() {
		// Only create observer in browser environment
		if (typeof window !== "undefined" && typeof IntersectionObserver !== "undefined") {
			this.observer = new IntersectionObserver(
				(entries) => this.handleIntersection(entries),
				{ threshold: [0, 0.25, 0.5, 0.75, 1] }
			);
		}
	}

	get currentPlayingId(): string | null {
		return this._currentPlayingId;
	}

	register(id: string, video: HTMLVideoElement): void {
		this.videoElements.set(id, video);
		this.observer?.observe(video);
	}

	unregister(id: string): void {
		const video = this.videoElements.get(id);
		if (video) {
			this.observer?.unobserve(video);
			this.videoElements.delete(id);
		}
		if (this._currentPlayingId === id) {
			this._currentPlayingId = null;
		}
	}

	play(id: string): void {
		const video = this.videoElements.get(id);
		if (!video) return;

		// Pause other videos
		for (const [otherId, otherVideo] of this.videoElements) {
			if (otherId !== id) {
				otherVideo.pause();
			}
		}

		video.muted = true; // Always start muted
		video.play().catch(() => {
			// Autoplay blocked
		});
		this._currentPlayingId = id;
	}

	pause(id: string): void {
		const video = this.videoElements.get(id);
		if (video) {
			video.pause();
		}
		if (this._currentPlayingId === id) {
			this._currentPlayingId = null;
		}
	}

	pauseAll(): void {
		for (const video of this.videoElements.values()) {
			video.pause();
		}
		this._currentPlayingId = null;
	}

	private handleIntersection(entries: IntersectionObserverEntry[]) {
		for (const entry of entries) {
			const video = entry.target as HTMLVideoElement;
			const id = this.findIdByVideo(video);
			if (!id) continue;

			if (entry.isIntersecting && entry.intersectionRatio >= PLAY_THRESHOLD) {
				this.play(id);
			} else if (entry.intersectionRatio < PAUSE_THRESHOLD) {
				if (this._currentPlayingId === id) {
					this.pause(id);
				}
			}
		}
	}

	private findIdByVideo(video: HTMLVideoElement): string | null {
		for (const [id, v] of this.videoElements) {
			if (v === video) return id;
		}
		return null;
	}
}
