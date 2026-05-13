/**
 * Performer Manager State
 *
 * Manages multiple performers in the 3D viewer.
 * Handles adding, removing, positioning, and selecting performers.
 */

import {
  createAvatarInstanceState,
  type AvatarInstanceState,
} from "./avatar-instance-state.svelte";
import {
  createAvatarSyncState,
  type AvatarSyncState,
} from "./avatar-sync-state.svelte";
import {
  getDefaultPositions,
  MAX_PERFORMERS,
} from "@austencloud/scene-3d";
// propInterpolator / sequenceConverter injected as module functions; no imports needed here
import type { AvatarId, FormationPreset } from "@austencloud/scene-3d";
import {
  createFormationManager,
} from "@austencloud/scene-3d";
// FormationManager type inferred from createFormationManager return

/**
 * Dependencies for performer manager
 */
export interface PerformerManagerDeps {
  initialAvatarId: AvatarId;
  /**
   * Optional cap override. Defaults to the shared STAGE.MAX_PERFORMERS (4).
   * The standalone 3D viewer passes STAGE.MAX_VIEWER_PERFORMERS (8).
   */
  maxPerformers?: number;
}

/**
 * Create performer manager state
 */
export function createPerformerManager(deps: PerformerManagerDeps) {
  const { initialAvatarId } = deps;
  const maxPerformers = deps.maxPerformers ?? MAX_PERFORMERS;

  // Performer states (1-4 performers)
  let performerStates = $state<AvatarInstanceState[]>([]);
  let activePerformerIndex = $state(0);
  let syncState: AvatarSyncState | null = $state(null);

  // Formation manager for flexible positioning. Pass maxPerformers through
  // so the standalone viewer's 8-performer cap reaches the formation
  // engine - otherwise its internal clamp drops performers 5-8 from
  // slot calculations and they never move on preset apply.
  const formationManager = createFormationManager(1, maxPerformers);

  // Derived: active performer state
  const activeState = $derived(performerStates[activePerformerIndex] ?? null);

  // Helper getters for sync (first two performers)
  const avatar1State = $derived(performerStates[0] ?? null);
  const avatar2State = $derived(performerStates[1] ?? null);

  /**
   * Create a performer at a given index
   */
  function createPerformer(index: number): AvatarInstanceState {
    const positions = getDefaultPositions(performerStates.length + 1);
    const pos = positions[index] ?? { x: 0, z: 0 };

    return createAvatarInstanceState(
      {
        id: `performer-${index}`,
        positionX: pos.x,
        positionZ: pos.z,
        avatarModelId: initialAvatarId,
      },
      {}
    );
  }

  /**
   * Initialize with a single performer
   */
  function initialize(): AvatarInstanceState {
    const initialPosition = getDefaultPositions(1)[0] ?? { x: 0, z: 0 };
    const initialPerformer = createAvatarInstanceState(
      {
        id: "performer-0",
        positionX: initialPosition.x,
        positionZ: initialPosition.z,
        avatarModelId: initialAvatarId,
      },
      {}
    );

    performerStates = [initialPerformer];
    return initialPerformer;
  }

  /**
   * Update all performer positions based on formation.
   *
   * Some presets are capped (grid-2x2 at 4, back-to-back/facing/stage-lr at 2).
   * When the performer count exceeds the preset's cap, the formation manager
   * returns slots only for the covered indices. Performers beyond the cap
   * would otherwise freeze at whatever position they spawned at, drifting
   * based on spawn history. Fall back to the default row-pair layout for
   * any index the preset doesn't cover - this produces a seamless 2-column
   * grid for grid-2x2 at counts 5-8 (since grid-2x2's 4 slots align exactly
   * with rows 0-1 of the row-pair default).
   */
  function updatePositions() {
    formationManager.setPerformerCount(performerStates.length);

    const positions = formationManager.getAllPerformerPositions();
    const defaults = getDefaultPositions(performerStates.length);

    performerStates.forEach((performer, i) => {
      const pos = positions.find((p) => p.index === i);
      if (pos) {
        performer.position.x = pos.position.x;
        performer.position.z = pos.position.z;
        performer.setFacingAngle(pos.facingAngle);
      } else {
        const fallback = defaults[i];
        if (fallback) {
          performer.position.x = fallback.x;
          performer.position.z = fallback.z;
          // Leave facing unchanged - the default layout doesn't imply a
          // specific facing, and new performers already face the audience.
        }
      }
    });
  }

  /**
   * Apply a formation preset (immediately, no transition)
   */
  function applyFormationPreset(preset: FormationPreset) {
    formationManager.applyPreset(preset);
    updatePositions();
  }

  /**
   * Transition to a formation preset (smooth animation)
   */
  function transitionToFormation(preset: FormationPreset, durationMs: number = 500) {
    formationManager.transitionToPreset(preset, durationMs);
  }

  /**
   * Update formation transition (called each frame when transitioning).
   * Uses the same default-layout fallback as updatePositions - if the
   * target preset doesn't cover an index, that performer stays at its
   * default row-pair slot instead of drifting.
   */
  function updateFormationTransition(timestamp?: number) {
    if (!formationManager.isTransitioning) return;

    formationManager.updateTransition(timestamp ?? performance.now());

    const positions = formationManager.getAllPerformerPositions();
    const defaults = getDefaultPositions(performerStates.length);

    performerStates.forEach((performer, i) => {
      const pos = positions.find((p) => p.index === i);
      if (pos) {
        performer.position.x = pos.position.x;
        performer.position.z = pos.position.z;
        performer.setFacingAngle(pos.facingAngle);
      } else {
        const fallback = defaults[i];
        if (fallback) {
          performer.position.x = fallback.x;
          performer.position.z = fallback.z;
          // Leave facing unchanged - the default layout doesn't imply a
          // specific facing, and new performers already face the audience.
        }
      }
    });
  }

  /**
   * Add a new performer
   */
  function addPerformer() {
    if (performerStates.length >= maxPerformers) return;

    const newPerformer = createPerformer(performerStates.length);
    performerStates = [...performerStates, newPerformer];
    updatePositions();

    // Create sync state when we have exactly 2 performers
    if (performerStates.length === 2) {
      const first = performerStates[0];
      const second = performerStates[1];
      if (first && second) {
        syncState?.destroy();
        syncState = createAvatarSyncState(first, second);
      }
    }
  }

  /**
   * Remove the last performer
   */
  function removePerformer() {
    if (performerStates.length <= 1) return;

    const removed = performerStates[performerStates.length - 1];
    if (!removed) return;
    removed.destroy();

    performerStates = performerStates.slice(0, -1);
    updatePositions();

    // Adjust active index if needed
    if (activePerformerIndex >= performerStates.length) {
      activePerformerIndex = performerStates.length - 1;
    }

    // Destroy sync if down to 1 performer
    if (performerStates.length < 2) {
      syncState?.destroy();
      syncState = null;
    }
  }

  /**
   * Select a performer by index
   */
  function selectPerformer(index: number) {
    if (index >= 0 && index < performerStates.length) {
      activePerformerIndex = index;
    }
  }

  /**
   * Handle performer drag
   */
  function handleDrag(index: number, newPos: { x: number; z: number }) {
    const performer = performerStates[index];
    if (performer) {
      performer.position.x = newPos.x;
      performer.position.z = newPos.z;
    }
  }

  /**
   * Set speed on all performers
   */
  function setSpeed(speed: number) {
    performerStates.forEach((p) => (p.speed = speed));
  }

  /**
   * Ensure we have at least N performers
   */
  function ensurePerformerCount(count: number) {
    while (performerStates.length < count && performerStates.length < maxPerformers) {
      addPerformer();
    }
  }

  /**
   * Clean up all performers
   */
  function destroy() {
    performerStates.forEach((p) => p.destroy());
    syncState?.destroy();
  }

  return {
    // State
    get performers() {
      return performerStates;
    },
    get activeIndex() {
      return activePerformerIndex;
    },
    get activeState() {
      return activeState;
    },
    get syncState() {
      return syncState;
    },
    get avatar1State() {
      return avatar1State;
    },
    get avatar2State() {
      return avatar2State;
    },
    get count() {
      return performerStates.length;
    },
    get maxPerformers() {
      return maxPerformers;
    },

    // Formation state
    get currentFormation() {
      return formationManager.currentFormation;
    },
    get currentFormationPreset() {
      return formationManager.currentFormation.preset;
    },
    get isFormationTransitioning() {
      return formationManager.isTransitioning;
    },

    // Methods
    initialize,
    addPerformer,
    removePerformer,
    selectPerformer,
    handleDrag,
    setSpeed,
    ensurePerformerCount,
    destroy,

    // Formation methods
    applyFormationPreset,
    transitionToFormation,
    updateFormationTransition,
  };
}

export type PerformerManager = ReturnType<typeof createPerformerManager>;
