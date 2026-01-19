/**
 * Spell Results Layout State
 *
 * Manages visibility toggles for the spell tab results page:
 * - Animation canvas
 * - Step grid
 * - Playback controls + visibility settings
 *
 * Rules:
 * - At least one of Animation or Grid must be visible
 * - Controls can only be visible when Animation is visible
 * - State persists across sessions
 */

import { createPersistenceHelper } from "$lib/shared/state/utils/persistent-state";

// ============================================================================
// PERSISTENCE
// ============================================================================

const animationVisiblePersistence = createPersistenceHelper({
  key: "tka_spell_results_animation_visible",
  defaultValue: true,
});

const gridVisiblePersistence = createPersistenceHelper({
  key: "tka_spell_results_grid_visible",
  defaultValue: false,
});

const controlsVisiblePersistence = createPersistenceHelper({
  key: "tka_spell_results_controls_visible",
  defaultValue: false,
});

// ============================================================================
// STATE FACTORY
// ============================================================================

export type SpellResultsLayoutState = {
  readonly animationVisible: boolean;
  readonly gridVisible: boolean;
  readonly controlsVisible: boolean;

  toggleAnimation: () => void;
  toggleGrid: () => void;
  toggleControls: () => void;

  /** Whether controls toggle is enabled (only when animation is visible) */
  readonly controlsEnabled: boolean;

  /** Cleanup function - call in onDestroy */
  dispose: () => void;
};

export function createSpellResultsLayoutState(): SpellResultsLayoutState {
  // Load persisted state
  let animationVisible = $state(animationVisiblePersistence.load());
  let gridVisible = $state(gridVisiblePersistence.load());
  let controlsVisible = $state(controlsVisiblePersistence.load());

  // Enforce initial constraints
  // At least one of animation or grid must be visible
  if (!animationVisible && !gridVisible) {
    animationVisible = true; // Default to animation if both are off
  }

  // Controls can only be visible when animation is visible
  if (controlsVisible && !animationVisible) {
    controlsVisible = false;
  }

  // Auto-save to localStorage
  const cleanupEffects = $effect.root(() => {
    $effect(() => {
      void animationVisible;
      animationVisiblePersistence.setupAutoSave(animationVisible);
    });

    $effect(() => {
      void gridVisible;
      gridVisiblePersistence.setupAutoSave(gridVisible);
    });

    $effect(() => {
      void controlsVisible;
      controlsVisiblePersistence.setupAutoSave(controlsVisible);
    });
  });

  return {
    get animationVisible() {
      return animationVisible;
    },

    get gridVisible() {
      return gridVisible;
    },

    get controlsVisible() {
      return controlsVisible;
    },

    get controlsEnabled() {
      return animationVisible;
    },

    toggleAnimation() {
      // Can't turn off animation if grid is also off (must show something)
      if (animationVisible && !gridVisible) {
        return; // Do nothing - keep animation visible
      }

      animationVisible = !animationVisible;

      // If turning off animation, also turn off controls
      if (!animationVisible && controlsVisible) {
        controlsVisible = false;
      }
    },

    toggleGrid() {
      // Can't turn off grid if animation is also off (must show something)
      if (gridVisible && !animationVisible) {
        return; // Do nothing - keep grid visible
      }

      gridVisible = !gridVisible;
    },

    toggleControls() {
      // Controls can only be toggled when animation is visible
      if (!animationVisible) {
        return; // Do nothing - controls require animation
      }

      controlsVisible = !controlsVisible;
    },

    dispose() {
      cleanupEffects();
    },
  };
}
