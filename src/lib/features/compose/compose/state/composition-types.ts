/**
 * Composition State Types
 *
 * Type definitions for the composition builder state.
 */

// ============================================================================
// Workflow Phase Types
// ============================================================================

/** Workflow phases within the Arrange tab */
export type WorkflowPhase = "canvas" | "audio" | "export";

/** Beat marker for audio sync */
export interface BeatMarker {
  id: string;
  beat: number;
  time: number; // seconds
  isHalfBeat?: boolean;
  cellId?: string; // for per-cell custom timing
}

/** Tempo region for variable BPM support */
export interface TempoRegion {
  id: string;
  startTime: number; // seconds
  endTime: number; // seconds
  bpm: number;
  /** Optional: ramp from previous region's BPM */
  rampFromPrevious?: boolean;
}

/** Audio state for the composition */
export interface AudioState {
  file: File | null;
  url: string | null;
  fileName: string | null;
  duration: number; // seconds
  detectedBpm: number | null;
  manualBpm: number | null; // user override
  globalBeatMarkers: BeatMarker[];
  /** Tempo regions for variable BPM (empty = use detectedBpm/manualBpm) */
  tempoRegions: TempoRegion[];
  isAnalyzing: boolean;
  isLoaded: boolean;
}

// ============================================================================
// Storage Keys
// ============================================================================

export const STORAGE_KEYS = {
  COMPOSITION: "compose-current-composition",
  PREVIEW_MODE: "compose-preview-mode",
  PLAYBACK_BPM: "compose-playback-bpm",
  WORKFLOW_PHASE: "compose-workflow-phase",
} as const;
