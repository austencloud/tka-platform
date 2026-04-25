/**
 * IVideoPlayer
 *
 * Manages video element state, playback synchronization, and beat tracking.
 */
export interface IVideoPlayer {
  /**
   * Initialize the service with a video element
   * @param videoElement The HTML video element to control
   */
  initialize(videoElement: HTMLVideoElement): void;

  /**
   * Start video playback and beat tracking
   */
  play(): void;

  /**
   * Pause video playback and stop beat tracking
   */
  pause(): void;

  /**
   * Set the playback rate (speed)
   * @param rate The playback rate (1.0 = normal speed, 2.0 = 2x speed, etc.)
   */
  setPlaybackRate(rate: number): void;

  /**
   * Seek to a specific time in the video
   * @param timeInSeconds The time position to seek to
   */
  seek(timeInSeconds: number): void;

  /**
   * Start tracking the current beat position
   * @param onStepChange Callback fired on each frame with the current beat
   */
  startStepTracking(onStepChange: (beat: number) => void): void;

  /**
   * Stop tracking the beat position
   */
  stopBeatTracking(): void;

  /**
   * Get the current playback time in seconds
   */
  getCurrentTime(): number;

  /**
   * Get the current beat position (for videos at 60 BPM base, time = beat)
   */
  getCurrentStep(): number;

  /**
   * Clean up resources (cancel animation frames, etc.)
   */
  dispose(): void;
}
