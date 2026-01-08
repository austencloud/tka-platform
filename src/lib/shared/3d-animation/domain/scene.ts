/**
 * Scene Domain Model
 *
 * A Scene combines multiple performer sequences, formation changes,
 * and camera choreography into a unified, playable composition.
 */

import type { FormationPreset } from "./formation";
import type { CameraChoreography } from "./camera-choreography";

/**
 * A performer's assignment in a scene
 */
export interface PerformerAssignment {
  /** Which performer slot (0-3) */
  slot: number;
  /** Library sequence ID to play */
  sequenceId: string;
  /** Sequence name for display */
  sequenceName?: string;
  /** When to start playing (beat number, 0 = scene start) */
  startBeat: number;
  /** Beat offset from master timing (for staggered starts) */
  beatOffset: number;
}

/**
 * Formation change cue in the scene timeline
 */
export interface FormationCue {
  /** Unique ID for this cue */
  id: string;
  /** Beat number when this formation change triggers */
  beatNumber: number;
  /** Formation preset to transition to */
  preset: FormationPreset;
  /** Transition duration in milliseconds */
  transitionDurationMs: number;
}

/**
 * Scene playback state
 */
export type ScenePlaybackState =
  | "idle"      // Not loaded or stopped
  | "loading"   // Loading sequences
  | "ready"     // Loaded and ready to play
  | "playing"   // Currently playing
  | "paused";   // Paused mid-playback

/**
 * Complete scene definition
 */
export interface Scene {
  /** Unique scene ID */
  id: string;
  /** Display name */
  name: string;
  /** Optional description */
  description?: string;

  /** Performer sequence assignments */
  performers: PerformerAssignment[];

  /** Starting formation preset */
  startingFormation: FormationPreset;
  /** Formation change cues */
  formationCues: FormationCue[];

  /** Camera choreography (optional) */
  cameraChoreography?: CameraChoreography;

  /** Total beats in scene (auto-calculated or manual) */
  totalBeats: number;
  /** Default BPM for playback */
  bpm: number;

  /** Metadata */
  createdAt: Date;
  updatedAt?: Date;
  createdBy?: string;
  tags?: string[];
}

/**
 * Scene summary for list display
 */
export interface SceneSummary {
  id: string;
  name: string;
  description?: string;
  performerCount: number;
  totalBeats: number;
  bpm: number;
  createdAt: Date;
  tags?: string[];
}

// ============================================
// Factory Functions
// ============================================

/**
 * Create a new empty scene
 */
export function createScene(
  name: string,
  options: Partial<Omit<Scene, "id" | "name" | "performers" | "formationCues">> = {}
): Scene {
  return {
    id: `scene-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    description: options.description,
    performers: [],
    startingFormation: options.startingFormation ?? "grid-2x2",
    formationCues: [],
    cameraChoreography: options.cameraChoreography,
    totalBeats: options.totalBeats ?? 0,
    bpm: options.bpm ?? 60,
    createdAt: options.createdAt ?? new Date(),
    updatedAt: options.updatedAt,
    createdBy: options.createdBy,
    tags: options.tags,
  };
}

/**
 * Create a performer assignment
 */
export function createPerformerAssignment(
  slot: number,
  sequenceId: string,
  options: Partial<Omit<PerformerAssignment, "slot" | "sequenceId">> = {}
): PerformerAssignment {
  return {
    slot,
    sequenceId,
    sequenceName: options.sequenceName,
    startBeat: options.startBeat ?? 0,
    beatOffset: options.beatOffset ?? 0,
  };
}

/**
 * Create a formation cue
 */
export function createFormationCue(
  beatNumber: number,
  preset: FormationPreset,
  transitionDurationMs: number = 500
): FormationCue {
  return {
    id: `cue-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    beatNumber,
    preset,
    transitionDurationMs,
  };
}

/**
 * Convert a Scene to a SceneSummary for list display
 */
export function toSceneSummary(scene: Scene): SceneSummary {
  return {
    id: scene.id,
    name: scene.name,
    description: scene.description,
    performerCount: scene.performers.length,
    totalBeats: scene.totalBeats,
    bpm: scene.bpm,
    createdAt: scene.createdAt,
    tags: scene.tags,
  };
}

// ============================================
// Scene Utilities
// ============================================

/**
 * Calculate total beats from performer assignments
 * Uses the longest sequence end point
 */
export function calculateSceneTotalBeats(
  performers: PerformerAssignment[],
  sequenceBeatCounts: Map<string, number>
): number {
  let maxBeat = 0;

  for (const performer of performers) {
    const sequenceBeats = sequenceBeatCounts.get(performer.sequenceId) ?? 0;
    const endBeat = performer.startBeat + sequenceBeats;
    maxBeat = Math.max(maxBeat, endBeat);
  }

  return maxBeat;
}

/**
 * Get formation cues sorted by beat number
 */
export function sortFormationCues(cues: FormationCue[]): FormationCue[] {
  return [...cues].sort((a, b) => a.beatNumber - b.beatNumber);
}

/**
 * Find the active formation at a given beat
 */
export function getActiveFormationAtBeat(
  scene: Scene,
  beatNumber: number
): FormationPreset {
  const sortedCues = sortFormationCues(scene.formationCues);

  // Find the last cue that has triggered
  let activePreset = scene.startingFormation;

  for (const cue of sortedCues) {
    if (cue.beatNumber <= beatNumber) {
      activePreset = cue.preset;
    } else {
      break;
    }
  }

  return activePreset;
}

/**
 * Find upcoming formation cue (if any)
 */
export function getNextFormationCue(
  scene: Scene,
  beatNumber: number
): FormationCue | null {
  const sortedCues = sortFormationCues(scene.formationCues);

  for (const cue of sortedCues) {
    if (cue.beatNumber > beatNumber) {
      return cue;
    }
  }

  return null;
}

/**
 * Check if a scene is valid (has at least one performer)
 */
export function isValidScene(scene: Scene): boolean {
  return scene.performers.length > 0 && scene.totalBeats > 0;
}

/**
 * Clone a scene with a new ID
 */
export function cloneScene(scene: Scene, newName?: string): Scene {
  return {
    ...scene,
    id: `scene-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: newName ?? `${scene.name} (Copy)`,
    createdAt: new Date(),
    updatedAt: undefined,
    formationCues: scene.formationCues.map((cue) => ({
      ...cue,
      id: `cue-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    })),
  };
}
