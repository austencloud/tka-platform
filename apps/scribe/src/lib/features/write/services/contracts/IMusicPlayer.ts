/**
 * IMusicPlayer - Contract for music playback in Write tab
 */
export interface IMusicPlayer {
  /** Prepare audio context/resources */
  initialize(): Promise<void>;

  /** Cleanup resources */
  cleanup(): void;

  /** Begin playback of a track by path or identifier */
  play(track: string): Promise<void>;

  /** Pause playback */
  pause(): Promise<void>;

  /** Stop playback and reset position */
  stop(): Promise<void>;
}
