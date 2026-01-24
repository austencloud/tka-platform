/**
 * @archived - 2026-01-24
 *
 * This state factory is archived and no longer imported.
 * Stagger mode is now handled by the Compose module via sequence-handoff.svelte.ts.
 * Kept for reference during the Compose multi-performer implementation.
 *
 * Original description:
 * Manages state for dual-performer stagger visualization.
 * Creates independent animation panel states for primary and secondary performers,
 * plus reactive offset/preset controls.
 */

import { createAnimationPanelState, type AnimationPanelState } from "$lib/features/compose/state/animation-panel-state.svelte";

// ============================================================================
// TYPES
// ============================================================================

/** Available stagger timing presets */
export type StaggerPreset = "half-beat" | "1-beat" | "2-beat" | "custom";

export interface StaggerModeState {
  // Animation states for each performer
  readonly primaryState: AnimationPanelState;
  readonly secondaryState: AnimationPanelState;

  // Preset selection
  readonly preset: StaggerPreset;
  setPreset: (preset: StaggerPreset) => void;

  // Custom offset (in beats) - only used when preset is "custom"
  readonly customOffsetBeats: number;
  setCustomOffsetBeats: (beats: number) => void;

  // Computed offset in milliseconds based on preset and BPM
  readonly effectiveOffsetMs: number;

  // Total steps in sequence (for calculating half-sequence offset)
  readonly totalSteps: number;
  setTotalSteps: (steps: number) => void;

  // Current BPM
  readonly bpm: number;
  setBpm: (bpm: number) => void;

  // Cleanup
  dispose: () => void;
}

// ============================================================================
// FACTORY
// ============================================================================

export function createStaggerModeState(): StaggerModeState {
  // Create independent animation states for each performer
  const primaryState = createAnimationPanelState();
  const secondaryState = createAnimationPanelState();

  // Local state
  let preset = $state<StaggerPreset>("half-beat");
  let customOffsetBeats = $state(1);
  let totalSteps = $state(0);
  let bpm = $state(60);

  // Computed offset in milliseconds
  const effectiveOffsetMs = $derived.by(() => {
    const msPerBeat = 60000 / bpm;

    switch (preset) {
      case "half-beat":
        return 0.5 * msPerBeat;  // Half a beat offset
      case "1-beat":
        return msPerBeat;        // One full beat offset
      case "2-beat":
        return 2 * msPerBeat;    // Two beats offset
      case "custom":
        return customOffsetBeats * msPerBeat;
      default:
        return msPerBeat;
    }
  });

  return {
    // Animation states
    get primaryState() {
      return primaryState;
    },
    get secondaryState() {
      return secondaryState;
    },

    // Preset
    get preset() {
      return preset;
    },
    setPreset: (newPreset: StaggerPreset) => {
      preset = newPreset;
    },

    // Custom offset
    get customOffsetBeats() {
      return customOffsetBeats;
    },
    setCustomOffsetBeats: (beats: number) => {
      // Clamp to reasonable range (0 to total steps)
      customOffsetBeats = Math.max(0, Math.min(beats, totalSteps || 16));
    },

    // Computed offset
    get effectiveOffsetMs() {
      return effectiveOffsetMs;
    },

    // Total steps
    get totalSteps() {
      return totalSteps;
    },
    setTotalSteps: (steps: number) => {
      totalSteps = steps;
    },

    // BPM
    get bpm() {
      return bpm;
    },
    setBpm: (newBpm: number) => {
      bpm = Math.max(30, Math.min(300, newBpm));
    },

    // Cleanup
    dispose: () => {
      primaryState.dispose();
      secondaryState.dispose();
    },
  };
}
