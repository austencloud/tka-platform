/**
 * Scene State
 *
 * Svelte 5 runes-based state for scene orchestration.
 * Provides reactive state updates for scene playback.
 */

import type {
  Scene,
  ScenePlaybackState,
  PerformerAssignment,
  FormationCue,
} from "../domain/scene";

import { createScene, createPerformerAssignment, createFormationCue } from "../domain/scene";
import type { FormationPreset } from "../domain/formation";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

import { createSceneOrchestrator } from "../services/implementations/SceneOrchestrator";
import type {
  ISceneOrchestrator,
  SequenceLoader,
  PerformerStateUpdate,
  FormationUpdate,
} from "../services/contracts/ISceneOrchestrator";

/**
 * Create scene state with Svelte 5 reactivity
 */
export function createSceneState() {
  // Internal orchestrator
  const orchestrator: ISceneOrchestrator = createSceneOrchestrator();

  // Reactive state
  let playbackState = $state<ScenePlaybackState>("idle");
  let currentBeat = $state(0);
  let beatProgress = $state(0);
  let totalBeats = $state(0);
  let activeFormation = $state<FormationPreset>("grid-2x2");
  let isFormationTransitioning = $state(false);
  let formationTransitionProgress = $state(0);
  let performerStates = $state<PerformerStateUpdate[]>([]);
  let speed = $state(1);
  let loop = $state(false);

  // Derived state
  const hasScene = $derived(orchestrator.hasScene);
  const isPlaying = $derived(playbackState === "playing");
  const isLoading = $derived(playbackState === "loading");
  const isReady = $derived(playbackState === "ready" || playbackState === "paused");
  const progress = $derived(totalBeats > 0 ? (currentBeat + beatProgress) / totalBeats : 0);
  const beatTime = $derived(currentBeat + beatProgress);

  // Subscribe to orchestrator events
  orchestrator.onPlaybackStateChange((state) => {
    playbackState = state;
  });

  orchestrator.onBeatChange((beat, prog) => {
    currentBeat = beat;
    beatProgress = prog;
  });

  orchestrator.onFormationChange((update: FormationUpdate) => {
    activeFormation = update.preset;
    isFormationTransitioning = update.isTransitioning;
    formationTransitionProgress = update.transitionProgress;
  });

  orchestrator.onPerformerUpdate((updates) => {
    performerStates = updates;
  });

  // ============================================
  // Scene Management
  // ============================================

  /**
   * Load a scene
   */
  async function loadScene(scene: Scene, sequenceLoader: SequenceLoader): Promise<void> {
    await orchestrator.loadScene(scene, sequenceLoader);
    totalBeats = orchestrator.totalBeats;
  }

  /**
   * Create and load a new empty scene
   */
  async function createNewScene(name: string): Promise<Scene> {
    const scene = createScene(name);
    // Don't load yet - just return for editing
    return scene;
  }

  /**
   * Unload current scene
   */
  function unloadScene(): void {
    orchestrator.unloadScene();
    totalBeats = 0;
    performerStates = [];
  }

  // ============================================
  // Playback Control
  // ============================================

  function play(): void {
    orchestrator.play();
  }

  function pause(): void {
    orchestrator.pause();
  }

  function stop(): void {
    orchestrator.stop();
  }

  function togglePlay(): void {
    orchestrator.togglePlay();
  }

  function seekToBeat(beat: number): void {
    orchestrator.seekToBeat(beat);
  }

  function setSpeed(newSpeed: number): void {
    speed = newSpeed;
    orchestrator.setSpeed(newSpeed);
  }

  function setLoop(newLoop: boolean): void {
    loop = newLoop;
    orchestrator.setLoop(newLoop);
  }

  // ============================================
  // Scene Editing
  // ============================================

  function addPerformer(slot: number, sequenceId: string, sequenceName?: string): void {
    const assignment = createPerformerAssignment(slot, sequenceId, { sequenceName });
    orchestrator.addPerformer(assignment);
  }

  function removePerformer(slot: number): void {
    orchestrator.removePerformer(slot);
  }

  function updatePerformer(slot: number, updates: Partial<PerformerAssignment>): void {
    orchestrator.updatePerformer(slot, updates);
  }

  function addFormationCue(beatNumber: number, preset: FormationPreset, transitionMs?: number): void {
    const cue = createFormationCue(beatNumber, preset, transitionMs);
    orchestrator.addFormationCue(cue);
  }

  function removeFormationCue(id: string): void {
    orchestrator.removeFormationCue(id);
  }

  function updateFormationCue(id: string, updates: Partial<Omit<FormationCue, "id">>): void {
    orchestrator.updateFormationCue(id, updates);
  }

  // ============================================
  // Frame Update
  // ============================================

  /**
   * Update the scene orchestrator (call each frame)
   */
  function update(deltaMs: number): void {
    orchestrator.update(deltaMs);
  }

  return {
    // State
    get playbackState() { return playbackState; },
    get currentBeat() { return currentBeat; },
    get beatProgress() { return beatProgress; },
    get beatTime() { return beatTime; },
    get totalBeats() { return totalBeats; },
    get progress() { return progress; },
    get activeFormation() { return activeFormation; },
    get isFormationTransitioning() { return isFormationTransitioning; },
    get formationTransitionProgress() { return formationTransitionProgress; },
    get performerStates() { return performerStates; },
    get speed() { return speed; },
    get loop() { return loop; },

    // Derived
    get hasScene() { return hasScene; },
    get isPlaying() { return isPlaying; },
    get isLoading() { return isLoading; },
    get isReady() { return isReady; },

    // Scene access
    get scene() { return orchestrator.scene; },
    get loadedSequences() { return orchestrator.loadedSequences; },

    // Scene management
    loadScene,
    createNewScene,
    unloadScene,

    // Playback
    play,
    pause,
    stop,
    togglePlay,
    seekToBeat,
    setSpeed,
    setLoop,

    // Editing
    addPerformer,
    removePerformer,
    updatePerformer,
    addFormationCue,
    removeFormationCue,
    updateFormationCue,

    // Frame update
    update,

    // Direct orchestrator access for advanced use
    get orchestrator() { return orchestrator; },
  };
}

export type SceneState = ReturnType<typeof createSceneState>;
