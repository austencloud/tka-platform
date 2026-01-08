/**
 * SceneOrchestrator Implementation
 *
 * Coordinates multi-performer scene playback with formation cues
 * and camera choreography. Uses factory function pattern.
 */

import type {
  Scene,
  ScenePlaybackState,
  PerformerAssignment,
  FormationCue,
} from "../../domain/scene";

import {
  sortFormationCues,
  getActiveFormationAtBeat,
  createFormationCue,
} from "../../domain/scene";

import type { FormationPreset } from "../../domain/formation";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

import type {
  ISceneOrchestrator,
  SequenceLoader,
  PerformerStateUpdate,
  FormationUpdate,
  PlaybackStateCallback,
  BeatChangeCallback,
  FormationChangeCallback,
  PerformerUpdateCallback,
} from "../contracts/ISceneOrchestrator";

/**
 * Create a SceneOrchestrator instance
 */
export function createSceneOrchestrator(): ISceneOrchestrator {
  // Scene state
  let scene: Scene | null = null;
  let loadedSequences = new Map<string, SequenceData>();

  // Playback state
  let playbackState: ScenePlaybackState = "idle";
  let currentBeat = 0;
  let beatProgress = 0;
  let speed = 1;
  let loop = false;

  // Formation state
  let activeFormation: FormationPreset = "grid-2x2";
  let isFormationTransitioning = false;
  let formationTransitionProgress = 0;
  let formationTransitionStart = 0;
  let formationTransitionDuration = 0;
  let targetFormation: FormationPreset | null = null;

  // Timing
  let lastTriggeredCueId: string | null = null;

  // Callbacks
  const playbackStateCallbacks = new Set<PlaybackStateCallback>();
  const beatChangeCallbacks = new Set<BeatChangeCallback>();
  const formationChangeCallbacks = new Set<FormationChangeCallback>();
  const performerUpdateCallbacks = new Set<PerformerUpdateCallback>();

  // ============================================
  // Internal Helpers
  // ============================================

  function notifyPlaybackState(): void {
    for (const cb of playbackStateCallbacks) cb(playbackState);
  }

  function notifyBeatChange(): void {
    for (const cb of beatChangeCallbacks) cb(currentBeat, beatProgress);
  }

  function notifyFormationChange(): void {
    const update: FormationUpdate = {
      preset: targetFormation ?? activeFormation,
      isTransitioning: isFormationTransitioning,
      transitionProgress: formationTransitionProgress,
    };
    for (const cb of formationChangeCallbacks) cb(update);
  }

  function notifyPerformerUpdate(): void {
    if (!scene) return;

    const updates: PerformerStateUpdate[] = scene.performers.map((performer) => {
      const sequence = loadedSequences.get(performer.sequenceId) ?? null;
      const sequenceBeats = sequence?.beats?.length ?? 0;

      // Calculate performer's local beat position
      const localBeatTime = currentBeat + beatProgress - performer.startBeat - performer.beatOffset;
      const localBeat = Math.max(0, Math.floor(localBeatTime));
      const localProgress = localBeatTime - localBeat;

      // Check if performer is active (within their sequence)
      const isActive = localBeatTime >= 0 && localBeat < sequenceBeats;

      return {
        slot: performer.slot,
        sequence,
        currentBeat: isActive ? Math.min(localBeat, sequenceBeats - 1) : 0,
        progress: isActive ? Math.max(0, Math.min(1, localProgress)) : 0,
        isPlaying: isActive && playbackState === "playing",
      };
    });

    for (const cb of performerUpdateCallbacks) cb(updates);
  }

  function checkFormationCues(): void {
    if (!scene) return;

    const beatTime = currentBeat + beatProgress;
    const sortedCues = sortFormationCues(scene.formationCues);

    for (const cue of sortedCues) {
      if (cue.id === lastTriggeredCueId) continue;
      if (cue.beatNumber <= beatTime && cue.beatNumber > beatTime - 0.1) {
        // Trigger this cue
        lastTriggeredCueId = cue.id;
        startFormationTransition(cue.preset, cue.transitionDurationMs);
        break;
      }
    }
  }

  function startFormationTransition(preset: FormationPreset, durationMs: number): void {
    targetFormation = preset;
    isFormationTransitioning = true;
    formationTransitionProgress = 0;
    formationTransitionStart = performance.now();
    formationTransitionDuration = durationMs;
    notifyFormationChange();
  }

  function updateFormationTransition(deltaMs: number): void {
    if (!isFormationTransitioning || !targetFormation) return;

    const elapsed = performance.now() - formationTransitionStart;
    formationTransitionProgress = Math.min(1, elapsed / formationTransitionDuration);

    if (formationTransitionProgress >= 1) {
      // Transition complete
      activeFormation = targetFormation;
      targetFormation = null;
      isFormationTransitioning = false;
      formationTransitionProgress = 0;
    }

    notifyFormationChange();
  }

  function advancePlayback(deltaMs: number): void {
    if (!scene || playbackState !== "playing") return;

    // Convert delta to beats based on BPM
    const beatsPerMs = scene.bpm / 60000;
    const deltaBeatTime = deltaMs * beatsPerMs * speed;

    // Advance beat time
    let newBeatTime = currentBeat + beatProgress + deltaBeatTime;

    // Handle looping or end
    if (newBeatTime >= scene.totalBeats) {
      if (loop) {
        newBeatTime = newBeatTime % scene.totalBeats;
        lastTriggeredCueId = null; // Reset cue tracking for loop
      } else {
        newBeatTime = scene.totalBeats;
        playbackState = "ready";
        notifyPlaybackState();
      }
    }

    // Update beat and progress
    const oldBeat = currentBeat;
    currentBeat = Math.floor(newBeatTime);
    beatProgress = newBeatTime - currentBeat;

    // Notify if beat changed
    if (currentBeat !== oldBeat || deltaBeatTime > 0) {
      notifyBeatChange();
    }

    // Check formation cues
    checkFormationCues();

    // Notify performer updates
    notifyPerformerUpdate();

    // Update formation transition
    updateFormationTransition(deltaMs);
  }

  // ============================================
  // Public Interface
  // ============================================

  const orchestrator: ISceneOrchestrator = {
    // Scene Management
    async loadScene(newScene: Scene, sequenceLoader: SequenceLoader): Promise<void> {
      playbackState = "loading";
      notifyPlaybackState();

      scene = { ...newScene };
      loadedSequences.clear();

      // Load all sequences
      const loadPromises = scene.performers.map(async (performer) => {
        const sequence = await sequenceLoader(performer.sequenceId);
        if (sequence) {
          loadedSequences.set(performer.sequenceId, sequence);
        }
      });

      await Promise.all(loadPromises);

      // Initialize state
      currentBeat = 0;
      beatProgress = 0;
      activeFormation = scene.startingFormation;
      isFormationTransitioning = false;
      lastTriggeredCueId = null;

      playbackState = "ready";
      notifyPlaybackState();
      notifyBeatChange();
      notifyFormationChange();
      notifyPerformerUpdate();
    },

    unloadScene(): void {
      scene = null;
      loadedSequences.clear();
      currentBeat = 0;
      beatProgress = 0;
      activeFormation = "grid-2x2";
      isFormationTransitioning = false;
      lastTriggeredCueId = null;
      playbackState = "idle";
      notifyPlaybackState();
    },

    get scene() {
      return scene;
    },

    get hasScene() {
      return scene !== null;
    },

    get loadedSequences() {
      return loadedSequences;
    },

    // Playback Control
    play(): void {
      if (!scene || playbackState === "loading") return;
      playbackState = "playing";
      notifyPlaybackState();
    },

    pause(): void {
      if (playbackState === "playing") {
        playbackState = "paused";
        notifyPlaybackState();
      }
    },

    stop(): void {
      if (!scene) return;
      playbackState = "ready";
      currentBeat = 0;
      beatProgress = 0;
      activeFormation = scene.startingFormation;
      isFormationTransitioning = false;
      lastTriggeredCueId = null;
      notifyPlaybackState();
      notifyBeatChange();
      notifyFormationChange();
      notifyPerformerUpdate();
    },

    togglePlay(): void {
      if (playbackState === "playing") {
        this.pause();
      } else {
        this.play();
      }
    },

    seekToBeat(beat: number): void {
      if (!scene) return;

      currentBeat = Math.max(0, Math.min(beat, scene.totalBeats - 1));
      beatProgress = 0;

      // Update active formation for new position
      activeFormation = getActiveFormationAtBeat(scene, currentBeat);
      isFormationTransitioning = false;

      // Reset cue tracking
      lastTriggeredCueId = null;
      const sortedCues = sortFormationCues(scene.formationCues);
      for (const cue of sortedCues) {
        if (cue.beatNumber <= currentBeat) {
          lastTriggeredCueId = cue.id;
        }
      }

      notifyBeatChange();
      notifyFormationChange();
      notifyPerformerUpdate();
    },

    setSpeed(newSpeed: number): void {
      speed = Math.max(0.1, Math.min(4, newSpeed));
    },

    setLoop(newLoop: boolean): void {
      loop = newLoop;
    },

    // State Queries
    get playbackState() {
      return playbackState;
    },

    get isPlaying() {
      return playbackState === "playing";
    },

    get currentBeat() {
      return currentBeat;
    },

    get beatProgress() {
      return beatProgress;
    },

    get beatTime() {
      return currentBeat + beatProgress;
    },

    get totalBeats() {
      return scene?.totalBeats ?? 0;
    },

    get progress() {
      if (!scene || scene.totalBeats === 0) return 0;
      return (currentBeat + beatProgress) / scene.totalBeats;
    },

    get speed() {
      return speed;
    },

    get loop() {
      return loop;
    },

    get activeFormation() {
      return activeFormation;
    },

    get isFormationTransitioning() {
      return isFormationTransitioning;
    },

    // Scene Editing
    addPerformer(assignment: PerformerAssignment): void {
      if (!scene) return;
      scene = {
        ...scene,
        performers: [...scene.performers, assignment],
        updatedAt: new Date(),
      };
    },

    removePerformer(slot: number): void {
      if (!scene) return;
      scene = {
        ...scene,
        performers: scene.performers.filter((p) => p.slot !== slot),
        updatedAt: new Date(),
      };
    },

    updatePerformer(slot: number, updates: Partial<PerformerAssignment>): void {
      if (!scene) return;
      scene = {
        ...scene,
        performers: scene.performers.map((p) =>
          p.slot === slot ? { ...p, ...updates } : p
        ),
        updatedAt: new Date(),
      };
    },

    addFormationCue(cue: FormationCue): void {
      if (!scene) return;
      scene = {
        ...scene,
        formationCues: sortFormationCues([...scene.formationCues, cue]),
        updatedAt: new Date(),
      };
    },

    removeFormationCue(id: string): void {
      if (!scene) return;
      scene = {
        ...scene,
        formationCues: scene.formationCues.filter((c) => c.id !== id),
        updatedAt: new Date(),
      };
    },

    updateFormationCue(id: string, updates: Partial<Omit<FormationCue, "id">>): void {
      if (!scene) return;
      scene = {
        ...scene,
        formationCues: sortFormationCues(
          scene.formationCues.map((c) => (c.id === id ? { ...c, ...updates } : c))
        ),
        updatedAt: new Date(),
      };
    },

    // Frame Update
    update(deltaMs: number): void {
      advancePlayback(deltaMs);
    },

    // Events
    onPlaybackStateChange(callback: PlaybackStateCallback): () => void {
      playbackStateCallbacks.add(callback);
      return () => playbackStateCallbacks.delete(callback);
    },

    onBeatChange(callback: BeatChangeCallback): () => void {
      beatChangeCallbacks.add(callback);
      return () => beatChangeCallbacks.delete(callback);
    },

    onFormationChange(callback: FormationChangeCallback): () => void {
      formationChangeCallbacks.add(callback);
      return () => formationChangeCallbacks.delete(callback);
    },

    onPerformerUpdate(callback: PerformerUpdateCallback): () => void {
      performerUpdateCallbacks.add(callback);
      return () => performerUpdateCallbacks.delete(callback);
    },
  };

  return orchestrator;
}
