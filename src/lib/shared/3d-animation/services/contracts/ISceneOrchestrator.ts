/**
 * ISceneOrchestrator Contract
 *
 * Service for loading, playing, and coordinating multi-performer scenes.
 * Manages sequence loading, formation cues, and camera choreography playback.
 */

import type {
  Scene,
  ScenePlaybackState,
  PerformerAssignment,
  FormationCue,
} from "../../domain/scene";
import type { FormationPreset } from "../../domain/formation";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

/**
 * Sequence loader function type
 * Implementations provide this to load sequences by ID
 */
export type SequenceLoader = (sequenceId: string) => Promise<SequenceData | null>;

/**
 * Performer state update from orchestrator
 */
export interface PerformerStateUpdate {
  slot: number;
  sequence: SequenceData | null;
  currentBeat: number;
  progress: number;
  isPlaying: boolean;
}

/**
 * Formation update from orchestrator
 */
export interface FormationUpdate {
  preset: FormationPreset;
  isTransitioning: boolean;
  transitionProgress: number;
}

/**
 * Callback types
 */
export type PlaybackStateCallback = (state: ScenePlaybackState) => void;
export type BeatChangeCallback = (beat: number, progress: number) => void;
export type FormationChangeCallback = (update: FormationUpdate) => void;
export type PerformerUpdateCallback = (updates: PerformerStateUpdate[]) => void;

export interface ISceneOrchestrator {
  // ============================================
  // Scene Management
  // ============================================

  /**
   * Load a scene and prepare for playback
   * @param scene - Scene definition to load
   * @param sequenceLoader - Function to load sequences by ID
   */
  loadScene(scene: Scene, sequenceLoader: SequenceLoader): Promise<void>;

  /**
   * Unload current scene and reset state
   */
  unloadScene(): void;

  /**
   * Get currently loaded scene
   */
  readonly scene: Scene | null;

  /**
   * Check if a scene is loaded
   */
  readonly hasScene: boolean;

  /**
   * Get loaded sequences map (sequenceId -> SequenceData)
   */
  readonly loadedSequences: Map<string, SequenceData>;

  // ============================================
  // Playback Control
  // ============================================

  /**
   * Start playback from current position
   */
  play(): void;

  /**
   * Pause playback
   */
  pause(): void;

  /**
   * Stop playback and reset to beginning
   */
  stop(): void;

  /**
   * Toggle play/pause
   */
  togglePlay(): void;

  /**
   * Seek to a specific beat
   */
  seekToBeat(beat: number): void;

  /**
   * Set playback speed multiplier
   */
  setSpeed(speed: number): void;

  /**
   * Set loop mode
   */
  setLoop(loop: boolean): void;

  // ============================================
  // State Queries
  // ============================================

  /**
   * Current playback state
   */
  readonly playbackState: ScenePlaybackState;

  /**
   * Whether scene is currently playing
   */
  readonly isPlaying: boolean;

  /**
   * Current beat number (0-indexed)
   */
  readonly currentBeat: number;

  /**
   * Progress within current beat (0-1)
   */
  readonly beatProgress: number;

  /**
   * Combined beat time (currentBeat + beatProgress)
   */
  readonly beatTime: number;

  /**
   * Total beats in scene
   */
  readonly totalBeats: number;

  /**
   * Overall progress (0-1)
   */
  readonly progress: number;

  /**
   * Playback speed multiplier
   */
  readonly speed: number;

  /**
   * Loop mode enabled
   */
  readonly loop: boolean;

  /**
   * Current active formation preset
   */
  readonly activeFormation: FormationPreset;

  /**
   * Whether a formation transition is in progress
   */
  readonly isFormationTransitioning: boolean;

  // ============================================
  // Scene Editing
  // ============================================

  /**
   * Add a performer assignment
   */
  addPerformer(assignment: PerformerAssignment): void;

  /**
   * Remove a performer by slot
   */
  removePerformer(slot: number): void;

  /**
   * Update a performer assignment
   */
  updatePerformer(slot: number, updates: Partial<PerformerAssignment>): void;

  /**
   * Add a formation cue
   */
  addFormationCue(cue: FormationCue): void;

  /**
   * Remove a formation cue by ID
   */
  removeFormationCue(id: string): void;

  /**
   * Update a formation cue
   */
  updateFormationCue(id: string, updates: Partial<Omit<FormationCue, "id">>): void;

  // ============================================
  // Frame Update
  // ============================================

  /**
   * Update orchestrator state (call each frame during playback)
   * @param deltaMs - Milliseconds since last frame
   */
  update(deltaMs: number): void;

  // ============================================
  // Events
  // ============================================

  /**
   * Subscribe to playback state changes
   */
  onPlaybackStateChange(callback: PlaybackStateCallback): () => void;

  /**
   * Subscribe to beat changes
   */
  onBeatChange(callback: BeatChangeCallback): () => void;

  /**
   * Subscribe to formation changes
   */
  onFormationChange(callback: FormationChangeCallback): () => void;

  /**
   * Subscribe to performer state updates
   */
  onPerformerUpdate(callback: PerformerUpdateCallback): () => void;
}
