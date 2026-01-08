/**
 * StageSceneAdapter
 *
 * Interprets compose's TimelineState for multi-performer 3D rendering.
 * Maps timeline concepts to Stage concepts:
 *   - Performer tracks → Avatar assignments
 *   - Clips on performer tracks → Sequence playback
 *   - Formation track clips → Formation cue triggers
 *   - Camera track clips → Camera keyframe choreography
 *
 * This adapter allows Stage to reuse compose's DAW timeline infrastructure
 * without duplicating playback, UI, or state management code.
 *
 * @example
 * ```typescript
 * // In Viewer3DModule.svelte (timeline-driven mode)
 * import { getTimelineState } from "$lib/features/compose/timeline/state/timeline-state.svelte";
 * import { createStageSceneAdapter } from "./services/implementations/StageSceneAdapter";
 *
 * const timelineState = getTimelineState();
 * const adapter = createStageSceneAdapter(timelineState);
 *
 * // In $effect: drive avatar animations from timeline
 * $effect(() => {
 *   const clips = adapter.getAllActivePerformerClips();
 *   for (const [index, clipInfo] of clips) {
 *     if (clipInfo && performerStates[index]) {
 *       performerStates[index].setSequence(clipInfo.clip.sequence);
 *       performerStates[index].goToBeat(clipInfo.beatIndex);
 *     }
 *   }
 * });
 *
 * // Get current formation
 * const formation = $derived(adapter.getActiveFormation());
 *
 * // Get camera state (if camera track exists)
 * const camera = $derived(adapter.getCameraState());
 * ```
 */

import type {
  TimelineState,
} from "$lib/features/compose/timeline/state/timeline-state.svelte";
import type {
  TimelineTrack,
  TimelineClip,
  TimeSeconds,
} from "$lib/features/compose/timeline/domain/timeline-types";
import type { FormationPreset } from "../../domain/formation";

// ============================================================================
// Types
// ============================================================================

/**
 * Active clip info for a performer at current playhead position
 */
export interface ActivePerformerClip {
  /** The timeline clip */
  clip: TimelineClip;
  /** Progress within the clip (0-1) */
  progress: number;
  /** Current beat index within the sequence */
  beatIndex: number;
  /** Sub-beat progress within current beat (0-1) */
  beatProgress: number;
}

/**
 * Camera keyframe from a camera track clip
 * (stored in clip.label as JSON or parsed from clip metadata)
 */
export interface CameraKeyframe {
  position: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
}

/**
 * Interpolated camera state from camera track
 */
export interface StageCamera {
  position: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
}

// ============================================================================
// Adapter Factory
// ============================================================================

export interface StageSceneAdapter {
  // Read-only accessors
  readonly playheadPosition: TimeSeconds;
  readonly isPlaying: boolean;
  readonly bpm: number;

  // Performer methods
  getPerformerTracks(): TimelineTrack[];
  getActivePerformerClip(performerIndex: number): ActivePerformerClip | null;
  getAllActivePerformerClips(): Map<number, ActivePerformerClip | null>;

  // Formation methods
  getActiveFormation(): FormationPreset;
  getFormationTrack(): TimelineTrack | null;

  // Camera methods
  getCameraTrack(): TimelineTrack | null;
  getCameraState(): StageCamera | null;
}

/**
 * Create an adapter that interprets compose's timeline state for Stage 3D rendering.
 *
 * @param timelineState - The compose timeline state (from getTimelineState())
 * @returns An adapter with methods to query timeline data for Stage rendering
 */
export function createStageSceneAdapter(
  timelineState: TimelineState
): StageSceneAdapter {
  // =========================================================================
  // Performer Track Methods
  // =========================================================================

  /**
   * Get all tracks that are performer tracks (type === "performer")
   */
  function getPerformerTracks(): TimelineTrack[] {
    return timelineState.project.tracks.filter((t) => t.type === "performer");
  }

  /**
   * Get the active clip at current playhead for a specific performer.
   * Returns clip info with progress and beat calculations.
   */
  function getActivePerformerClip(
    performerIndex: number
  ): ActivePerformerClip | null {
    const performerTracks = getPerformerTracks();
    const track = performerTracks[performerIndex];
    if (!track) return null;

    const position = timelineState.playhead.position;

    // Find clip that spans the current playhead position
    const activeClip = track.clips.find(
      (clip) =>
        !clip.muted &&
        position >= clip.startTime &&
        position < clip.startTime + clip.duration
    );

    if (!activeClip) return null;

    // Calculate progress within the clip
    const clipProgress =
      (position - activeClip.startTime) / activeClip.duration;

    // Calculate beat info from the sequence
    const beatCount = activeClip.sequence.beats.length;
    if (beatCount === 0) {
      return {
        clip: activeClip,
        progress: clipProgress,
        beatIndex: 0,
        beatProgress: 0,
      };
    }

    // Map progress to beats (accounting for in/out points and playbackRate)
    const effectiveProgress =
      activeClip.inPoint +
      clipProgress * (activeClip.outPoint - activeClip.inPoint);
    const exactBeat = effectiveProgress * beatCount;
    const beatIndex = Math.floor(exactBeat) % beatCount;
    const beatProgress = exactBeat - Math.floor(exactBeat);

    return {
      clip: activeClip,
      progress: clipProgress,
      beatIndex,
      beatProgress,
    };
  }

  /**
   * Get active clips for all performers at current playhead
   */
  function getAllActivePerformerClips(): Map<
    number,
    ActivePerformerClip | null
  > {
    const result = new Map<number, ActivePerformerClip | null>();
    const performerTracks = getPerformerTracks();

    performerTracks.forEach((_, index) => {
      result.set(index, getActivePerformerClip(index));
    });

    return result;
  }

  // =========================================================================
  // Formation Track Methods
  // =========================================================================

  /**
   * Get the formation track (type === "formation")
   */
  function getFormationTrack(): TimelineTrack | null {
    return (
      timelineState.project.tracks.find((t) => t.type === "formation") ?? null
    );
  }

  /**
   * Get the currently active formation preset based on playhead position.
   * Formation cues are "instant" - we find the most recent cue before playhead.
   */
  function getActiveFormation(): FormationPreset {
    const formationTrack = getFormationTrack();
    if (!formationTrack) return "grid-2x2";

    const position = timelineState.playhead.position;

    // Find all formation cues that have started before or at current position
    const pastCues = formationTrack.clips.filter(
      (clip) => !clip.muted && clip.startTime <= position
    );

    if (pastCues.length === 0) return "grid-2x2";

    // Get the most recent cue (highest startTime)
    const latestCue = pastCues.reduce((latest, current) =>
      current.startTime > latest.startTime ? current : latest
    );

    // Formation preset is stored in the clip's label
    // Validate it's a known preset, fallback to default
    const presetValue = latestCue.label as FormationPreset;
    const validPresets: FormationPreset[] = [
      "grid-2x2",
      "line",
      "circle",
      "v-shape",
      "diagonal",
      "custom",
    ];

    if (validPresets.includes(presetValue)) {
      return presetValue;
    }

    return "grid-2x2";
  }

  // =========================================================================
  // Camera Track Methods
  // =========================================================================

  /**
   * Get the camera track (type === "camera")
   */
  function getCameraTrack(): TimelineTrack | null {
    return (
      timelineState.project.tracks.find((t) => t.type === "camera") ?? null
    );
  }

  /**
   * Get interpolated camera state from camera track.
   * Camera clips contain keyframe data; we interpolate between them.
   */
  function getCameraState(): StageCamera | null {
    const cameraTrack = getCameraTrack();
    if (!cameraTrack || cameraTrack.clips.length === 0) return null;

    const position = timelineState.playhead.position;

    // Filter unmuted clips and sort by start time
    const validClips = cameraTrack.clips
      .filter((c) => !c.muted)
      .sort((a, b) => a.startTime - b.startTime);

    if (validClips.length === 0) return null;

    // Find surrounding keyframes for interpolation
    let beforeClip: TimelineClip | null = null;
    let afterClip: TimelineClip | null = null;

    for (const clip of validClips) {
      if (clip.startTime <= position) {
        beforeClip = clip;
      } else if (afterClip === null) {
        afterClip = clip;
        break;
      }
    }

    // If no keyframe before, use the first one
    if (!beforeClip) {
      const firstClip = validClips[0];
      if (!firstClip) return null;
      return parseCameraKeyframe(firstClip);
    }

    // If no keyframe after, use the last one (hold)
    if (!afterClip) {
      return parseCameraKeyframe(beforeClip);
    }

    // Interpolate between before and after keyframes
    const t =
      (position - beforeClip.startTime) /
      (afterClip.startTime - beforeClip.startTime);

    const beforeState = parseCameraKeyframe(beforeClip);
    const afterState = parseCameraKeyframe(afterClip);

    if (!beforeState || !afterState) {
      return beforeState ?? afterState;
    }

    // Linear interpolation
    return {
      position: {
        x: lerp(beforeState.position.x, afterState.position.x, t),
        y: lerp(beforeState.position.y, afterState.position.y, t),
        z: lerp(beforeState.position.z, afterState.position.z, t),
      },
      target: {
        x: lerp(beforeState.target.x, afterState.target.x, t),
        y: lerp(beforeState.target.y, afterState.target.y, t),
        z: lerp(beforeState.target.z, afterState.target.z, t),
      },
    };
  }

  /**
   * Parse camera keyframe data from a clip's label (stored as JSON)
   */
  function parseCameraKeyframe(clip: TimelineClip): StageCamera | null {
    if (!clip.label) return null;

    try {
      const data = JSON.parse(clip.label) as CameraKeyframe;
      return {
        position: data.position ?? { x: 0, y: 200, z: 500 },
        target: data.target ?? { x: 0, y: 100, z: 0 },
      };
    } catch {
      // Label is not JSON - might be a simple string
      return null;
    }
  }

  // =========================================================================
  // Helpers
  // =========================================================================

  function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  // =========================================================================
  // Return Adapter Interface
  // =========================================================================

  return {
    // Read-only accessors
    get playheadPosition() {
      return timelineState.playhead.position;
    },
    get isPlaying() {
      return timelineState.playhead.isPlaying;
    },
    get bpm() {
      return timelineState.project.defaultBpm;
    },

    // Performer methods
    getPerformerTracks,
    getActivePerformerClip,
    getAllActivePerformerClips,

    // Formation methods
    getActiveFormation,
    getFormationTrack,

    // Camera methods
    getCameraTrack,
    getCameraState,
  };
}
