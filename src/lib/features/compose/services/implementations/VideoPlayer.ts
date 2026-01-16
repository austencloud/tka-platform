import type { IVideoPlayer } from "../contracts/IVideoPlayer";

/**
 * VideoPlayer
 *
 * Manages video element state, playback synchronization, and beat tracking.
 * Assumes videos are generated at 60 BPM (1 beat = 1 second).
 */
export class VideoPlayer implements IVideoPlayer {
  private videoElement: HTMLVideoElement | null = null;
  private beatTrackingFrameId: number | null = null;
  private beatChangeCallback: ((beat: number) => void) | null = null;

  initialize(videoElement: HTMLVideoElement): void {
    this.videoElement = videoElement;
  }

  play(): void {
    if (!this.videoElement) {
      console.warn("VideoPlayer: No video element initialized");
      return;
    }

    this.videoElement.play().catch((error) => {
      console.error("VideoPlayer: Play failed", error);
    });
  }

  pause(): void {
    if (!this.videoElement) {
      console.warn("VideoPlayer: No video element initialized");
      return;
    }

    this.videoElement.pause();
  }

  setPlaybackRate(rate: number): void {
    if (!this.videoElement) {
      console.warn("VideoPlayer: No video element initialized");
      return;
    }

    this.videoElement.playbackRate = rate;
  }

  seek(timeInSeconds: number): void {
    if (!this.videoElement) {
      console.warn("VideoPlayer: No video element initialized");
      return;
    }

    this.videoElement.currentTime = timeInSeconds;
  }

  startBeatTracking(onBeatChange: (beat: number) => void): void {
    // Don't start if already tracking
    if (this.beatTrackingFrameId !== null) {
      return;
    }

    this.beatChangeCallback = onBeatChange;

    const trackBeat = () => {
      if (this.videoElement && this.beatChangeCallback) {
        // Video is at 60 BPM base, so currentTime in seconds = currentBeat
        const currentBeat = this.videoElement.currentTime;
        this.beatChangeCallback(currentBeat);
      }
      this.beatTrackingFrameId = requestAnimationFrame(trackBeat);
    };

    this.beatTrackingFrameId = requestAnimationFrame(trackBeat);
  }

  stopBeatTracking(): void {
    if (this.beatTrackingFrameId !== null) {
      cancelAnimationFrame(this.beatTrackingFrameId);
      this.beatTrackingFrameId = null;
    }
    this.beatChangeCallback = null;
  }

  getCurrentTime(): number {
    if (!this.videoElement) {
      return 0;
    }
    return this.videoElement.currentTime;
  }

  getCurrentBeat(): number {
    // For videos at 60 BPM base, currentTime = currentBeat
    return this.getCurrentTime();
  }

  dispose(): void {
    this.stopBeatTracking();
    this.videoElement = null;
    this.beatChangeCallback = null;
  }
}

// Singleton instance
let instance: VideoPlayer | null = null;

export function getVideoPlayer(): VideoPlayer {
  if (!instance) {
    instance = new VideoPlayer();
  }
  return instance;
}
