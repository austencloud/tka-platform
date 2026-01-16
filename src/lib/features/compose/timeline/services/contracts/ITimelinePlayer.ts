/**
 * ITimelinePlayer - Contract for timeline playback management
 *
 * Handles playback state, transport controls, shuttle (J/K/L),
 * and audio synchronization.
 */

import type { TimeSeconds, TimelineClip } from "../../domain/timeline-types";

export interface ActiveClipInfo {
  clip: TimelineClip;
  /** Progress through the clip (0-1) */
  progress: number;
  /** Current beat within the clip */
  currentStep: number;
  /** Whether this clip is looping */
  isLooping: boolean;
}

export interface ITimelinePlayer {
  // State getters
  readonly isPlaying: boolean;
  readonly position: TimeSeconds;
  readonly direction: 1 | -1;
  readonly shuttleSpeed: number;
  readonly loopStart: TimeSeconds | null;
  readonly loopEnd: TimeSeconds | null;
  readonly hasLoopRegion: boolean;
  readonly activeClips: TimelineClip[];
  readonly activeClipInfos: ActiveClipInfo[];

  // Transport controls
  play(): void;
  pause(): void;
  stop(): void;
  togglePlayPause(): void;
  seek(position: TimeSeconds): void;
  goToStart(): void;
  goToEnd(): void;

  // Shuttle controls (J/K/L)
  shuttleForward(): void;
  shuttleReverse(): void;
  shuttleStop(): void;

  // Frame stepping
  stepForward(frames?: number): void;
  stepBackward(frames?: number): void;

  // Loop region
  setLoopRegion(start: TimeSeconds, end: TimeSeconds): void;
  clearLoopRegion(): void;
  setInPointAtPlayhead(): void;
  setOutPointAtPlayhead(): void;

  // Audio sync
  connectAudio(audioElement: HTMLAudioElement): void;
  disconnectAudio(): void;

  // Lifecycle
  initialize(): void;
  destroy(): void;
}
