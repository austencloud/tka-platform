/**
 * TimelinePlaybackEngine
 *
 * Handles real-time playback of the timeline:
 * - Animation frame loop for smooth playhead updates
 * - Audio sync (when audio is present)
 * - Shuttle control (variable speed forward/reverse)
 * - Loop region handling
 * - Clip activation/deactivation based on playhead position
 */

import type { TimeSeconds, TimelineClip } from "../domain/timeline-types";
import { getClipEndTime } from "../domain/timeline-types";

// ============================================================================
// Types
// ============================================================================

export interface PlaybackEngineConfig {
  /** Callback when playhead position changes */
  onPositionUpdate: (position: TimeSeconds) => void;

  /** Callback when active clips change */
  onActiveClipsChange: (clips: TimelineClip[]) => void;

  /** Callback when playback state changes */
  onPlaybackStateChange: (isPlaying: boolean) => void;

  /** Get current playhead state */
  getPlayheadState: () => PlayheadStateSnapshot;

  /** Get all clips */
  getClips: () => TimelineClip[];

  /** Get total duration */
  getTotalDuration: () => TimeSeconds;
}

export interface PlayheadStateSnapshot {
  position: TimeSeconds;
  isPlaying: boolean;
  direction: 1 | -1;
  shuttleSpeed: number;
  loopStart: TimeSeconds | null;
  loopEnd: TimeSeconds | null;
}

export interface ActiveClipInfo {
  clip: TimelineClip;
  /** Progress through the clip (0-1) */
  progress: number;
  /** Current beat within the clip */
  currentStep: number;
  /** Whether this clip is looping */
  isLooping: boolean;
}

// ============================================================================
// Playback Engine
// ============================================================================

export class TimelinePlaybackEngine {
  private config: PlaybackEngineConfig;
  private animationFrameId: number | null = null;
  private lastFrameTime: number = 0;
  private isRunning: boolean = false;

  // Audio element reference (optional)
  private audioElement: HTMLAudioElement | null = null;
  private audioSyncEnabled: boolean = false;

  constructor(config: PlaybackEngineConfig) {
    this.config = config;
  }

  // =========================================================================
  // Public API
  // =========================================================================

  /**
   * Start playback
   */
  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.lastFrameTime = performance.now();
    this.animationFrameId = requestAnimationFrame(this.tick.bind(this));
    this.config.onPlaybackStateChange(true);

    // Start audio if synced
    if (this.audioSyncEnabled && this.audioElement) {
      const state = this.config.getPlayheadState();
      this.audioElement.currentTime = state.position;
      this.audioElement.playbackRate = state.shuttleSpeed * state.direction;
      this.audioElement.play().catch(console.error);
    }

  }

  /**
   * Stop playback
   */
  stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;

    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    this.config.onPlaybackStateChange(false);

    // Pause audio if synced
    if (this.audioElement) {
      this.audioElement.pause();
    }

  }

  /**
   * Toggle play/pause
   */
  toggle(): void {
    if (this.isRunning) {
      this.stop();
    } else {
      this.start();
    }
  }

  /**
   * Seek to a specific position
   */
  seek(position: TimeSeconds): void {
    const duration = this.config.getTotalDuration();
    const clampedPosition = Math.max(0, Math.min(duration, position));

    this.config.onPositionUpdate(clampedPosition);

    // Sync audio position
    if (this.audioElement) {
      this.audioElement.currentTime = clampedPosition;
    }

    // Update active clips
    this.updateActiveClips(clampedPosition);
  }

  /**
   * Connect an audio element for sync
   */
  connectAudio(audioElement: HTMLAudioElement): void {
    this.audioElement = audioElement;
    this.audioSyncEnabled = true;

    // Listen for audio time updates as fallback sync
    audioElement.addEventListener(
      "timeupdate",
      this.handleAudioTimeUpdate.bind(this)
    );

  }

  /**
   * Disconnect audio
   */
  disconnectAudio(): void {
    if (this.audioElement) {
      this.audioElement.removeEventListener(
        "timeupdate",
        this.handleAudioTimeUpdate.bind(this)
      );
      this.audioElement = null;
    }
    this.audioSyncEnabled = false;
  }

  /**
   * Update shuttle speed (for J/K/L controls)
   */
  updateShuttle(speed: number, direction: 1 | -1): void {
    if (this.audioElement && this.isRunning) {
      // Audio playback rate can't be negative, so we handle reverse differently
      if (direction === -1) {
        // For reverse, we manually step backwards
        this.audioElement.pause();
      } else {
        this.audioElement.playbackRate = speed;
        if (this.isRunning) {
          this.audioElement.play().catch(console.error);
        }
      }
    }
  }

  /**
   * Get clips active at a specific time
   */
  getActiveClipsAt(time: TimeSeconds): ActiveClipInfo[] {
    const clips = this.config.getClips();
    const activeClips: ActiveClipInfo[] = [];

    for (const clip of clips) {
      if (clip.muted) continue;

      const clipStart = clip.startTime;
      const clipEnd = getClipEndTime(clip);

      // Check if playhead is within this clip
      if (time >= clipStart && time < clipEnd) {
        const clipDuration = clip.duration;
        const timeInClip = time - clipStart;

        // Calculate progress accounting for in/out points and playback rate
        const sourceRange = clip.outPoint - clip.inPoint;
        const rawProgress = timeInClip / clipDuration;

        // Handle looping
        let progress: number;
        let isLooping = false;

        if (clip.loop && rawProgress > 1) {
          progress = rawProgress % 1;
          isLooping = true;
        } else {
          progress = Math.min(1, rawProgress);
        }

        // Map to source range
        const sourceProgress = clip.inPoint + progress * sourceRange;

        // Calculate current beat
        const stepCount = clip.sequence.steps.length;
        const currentStep = Math.floor(sourceProgress * stepCount);

        activeClips.push({
          clip,
          progress: sourceProgress,
          currentStep,
          isLooping,
        });
      }
    }

    return activeClips;
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.stop();
    this.disconnectAudio();
  }

  // =========================================================================
  // Private Methods
  // =========================================================================

  /**
   * Animation frame tick
   */
  private tick(currentTime: number): void {
    if (!this.isRunning) return;

    const state = this.config.getPlayheadState();
    const deltaMs = currentTime - this.lastFrameTime;
    this.lastFrameTime = currentTime;

    // Calculate new position
    const deltaSeconds =
      (deltaMs / 1000) * state.shuttleSpeed * state.direction;
    let newPosition = state.position + deltaSeconds;

    // Handle loop region
    if (state.loopStart !== null && state.loopEnd !== null) {
      if (state.direction === 1 && newPosition >= state.loopEnd) {
        newPosition = state.loopStart + (newPosition - state.loopEnd);
      } else if (state.direction === -1 && newPosition <= state.loopStart) {
        newPosition = state.loopEnd - (state.loopStart - newPosition);
      }
    }

    // Clamp to valid range
    const duration = this.config.getTotalDuration();
    if (newPosition >= duration) {
      // Reached end
      newPosition = duration;
      this.stop();
      this.config.onPositionUpdate(0); // Reset to start
    } else if (newPosition < 0) {
      // Reached start (reverse playback)
      newPosition = 0;
      this.stop();
    } else {
      this.config.onPositionUpdate(newPosition);
    }

    // Update active clips
    this.updateActiveClips(newPosition);

    // Continue loop
    if (this.isRunning) {
      this.animationFrameId = requestAnimationFrame(this.tick.bind(this));
    }
  }

  /**
   * Update which clips are active at current position
   */
  private updateActiveClips(position: TimeSeconds): void {
    const activeClips = this.getActiveClipsAt(position).map(
      (info) => info.clip
    );
    this.config.onActiveClipsChange(activeClips);
  }

  /**
   * Handle audio timeupdate events (fallback sync)
   */
  private handleAudioTimeUpdate(): void {
    if (!this.audioElement || !this.audioSyncEnabled) return;

    // Only sync from audio if we're playing with audio as master
    if (this.isRunning && this.config.getPlayheadState().direction === 1) {
      // Use audio as time source for forward playback
      // This ensures perfect sync even if animation frame drifts
      const audioTime = this.audioElement.currentTime;
      this.config.onPositionUpdate(audioTime);
    }
  }
}

// ============================================================================
// Factory
// ============================================================================

let engineInstance: TimelinePlaybackEngine | null = null;

/**
 * Create or get the singleton playback engine
 */
export function createPlaybackEngine(
  config: PlaybackEngineConfig
): TimelinePlaybackEngine {
  if (engineInstance) {
    engineInstance.destroy();
  }
  engineInstance = new TimelinePlaybackEngine(config);
  return engineInstance;
}

/**
 * Get the current engine instance
 */
export function getPlaybackEngine(): TimelinePlaybackEngine | null {
  return engineInstance;
}
