/**
 * Performer Manager State
 *
 * Manages multiple performers in the 3D viewer.
 * Handles adding, removing, positioning, and selecting performers.
 */

import {
  createAvatarInstanceState,
  makeStandaloneDeps,
  type AvatarInstanceState,
} from "./avatar-instance-state.svelte";
import type { DefaultPerformerSettings } from "./performer-settings-types";
import {
  createAvatarSyncState,
  type AvatarSyncState,
} from "./avatar-sync-state.svelte";
import { getDefaultPositions, MAX_PERFORMERS } from "@austencloud/scene-3d";
// propInterpolator / sequenceConverter injected as module functions; no imports needed here
import type { AvatarId, FormationPreset } from "@austencloud/scene-3d";
import { createFormationManager } from "@austencloud/scene-3d";
import {
  sampleInterruptibleAngle,
  sampleInterruptibleHermite,
  type TimedTransition,
} from "../camera/transitions";
import {
  resolveViewerFormationFacingAngle,
  VIEWER_FRONT_STAGE_FACING_ANGLE,
} from "../domain/viewer-formation-facing";
// FormationManager type inferred from createFormationManager return

const COUNT_CHANGE_TRANSITION_MS = 320;

export interface PerformerLayoutSnapshot {
  position: { x: number; z: number };
  facingAngle: number;
}

interface PerformerLayoutVelocity {
  position: { x: number; z: number };
  facingAngle: number;
}

interface PerformerLayoutTransitionMember {
  id: string;
  start: PerformerLayoutSnapshot;
  end: PerformerLayoutSnapshot;
  startVelocity: PerformerLayoutVelocity;
}

interface ActivePerformerLayoutTransition {
  timing: TimedTransition;
  members: PerformerLayoutTransitionMember[];
}

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
  /**
   * Optional viewer-level defaults provider. When set, each performer
   * inherits these defaults via the cascade (null override → inherit).
   * When omitted, performers use standalone defaults.
   */
  getDefaults?: () => DefaultPerformerSettings;
  /**
   * Threaded through to every `createAvatarInstanceState` call as
   * `AvatarInstanceConfig.persistent`. Defaults to `true` (unchanged
   * behavior) when omitted. Pass `false` for a seeded/ephemeral viewer so
   * its avatar instances never read or write the persisted plane-mode /
   * rotation-variant localStorage keys.
   */
  persistent?: boolean;
}

/**
 * Create performer manager state
 */
function buildPerformerManager(deps: PerformerManagerDeps) {
  const { initialAvatarId } = deps;
  const maxPerformers = deps.maxPerformers ?? MAX_PERFORMERS;
  const getDefaults = deps.getDefaults;
  const persistent = deps.persistent;

  // Performer states (1-4 performers)
  let performerStates = $state<AvatarInstanceState[]>([]);
  let activePerformerIndex = $state(0);
  let syncState: AvatarSyncState | null = $state(null);

  // Formation manager for flexible positioning. Pass maxPerformers through
  // so the standalone viewer's 8-performer cap reaches the formation
  // engine - otherwise its internal clamp drops performers 5-8 from
  // slot calculations and they never move on preset apply.
  const formationManager = createFormationManager(1, maxPerformers);
  let activeLayoutTransition: ActivePerformerLayoutTransition | null = null;
  let nextLayoutTransitionId = 1;

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

    const performer = createAvatarInstanceState(
      {
        id: `performer-${index}`,
        positionX: pos.x,
        positionZ: pos.z,
        avatarModelId: initialAvatarId,
        persistent,
      },
      getDefaults ? { getDefaults } : makeStandaloneDeps()
    );
    performer.snapFacingAngle(VIEWER_FRONT_STAGE_FACING_ANGLE);
    return performer;
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
        persistent,
      },
      getDefaults ? { getDefaults } : makeStandaloneDeps()
    );

    initialPerformer.snapFacingAngle(VIEWER_FRONT_STAGE_FACING_ANGLE);
    performerStates = [initialPerformer];
    return initialPerformer;
  }

  function captureLayout(): Map<string, PerformerLayoutSnapshot> {
    return new Map(
      performerStates.map((performer) => [
        performer.id,
        {
          position: { ...performer.position },
          facingAngle: performer.facingAngle,
        },
      ])
    );
  }

  function zeroLayoutVelocity(): PerformerLayoutVelocity {
    return {
      position: { x: 0, z: 0 },
      facingAngle: 0,
    };
  }

  /**
   * Apply the shared layout clock to every performer and return the exact
   * velocities visible at this instant. Those velocities become the tangents
   * of a replacement transition when add/remove/formation actions arrive in
   * quick succession.
   */
  function sampleLayoutTransition(
    nowMs: number
  ): Map<string, PerformerLayoutVelocity> {
    const velocities = new Map<string, PerformerLayoutVelocity>();
    const transition = activeLayoutTransition;
    if (!transition) return velocities;

    let done = false;
    for (const member of transition.members) {
      const performer = performerStates.find(
        (candidate) => candidate.id === member.id
      );
      if (!performer) continue;

      const x = sampleInterruptibleHermite(
        member.start.position.x,
        member.end.position.x,
        member.startVelocity.position.x,
        transition.timing,
        nowMs
      );
      const z = sampleInterruptibleHermite(
        member.start.position.z,
        member.end.position.z,
        member.startVelocity.position.z,
        transition.timing,
        nowMs
      );
      const facing = sampleInterruptibleAngle(
        member.start.facingAngle,
        member.end.facingAngle,
        member.startVelocity.facingAngle,
        transition.timing,
        nowMs
      );

      performer.position.x = x.value;
      performer.position.z = z.value;
      performer.setFacingAngle(facing.value);
      velocities.set(member.id, {
        position: { x: x.velocity, z: z.velocity },
        facingAngle: facing.velocity,
      });
      done = x.done;
    }

    if (done) activeLayoutTransition = null;
    return velocities;
  }

  function beginLayoutTransition(
    targets: readonly PerformerLayoutSnapshot[],
    durationMs: number,
    carriedVelocities: ReadonlyMap<string, PerformerLayoutVelocity>,
    nowMs: number
  ): TimedTransition {
    const timing: TimedTransition = {
      id: nextLayoutTransitionId++,
      startTimeMs: nowMs,
      durationMs,
    };

    activeLayoutTransition = {
      timing,
      members: performerStates.flatMap((performer, index) => {
        const end = targets[index];
        if (!end) return [];
        return [
          {
            id: performer.id,
            start: {
              position: { ...performer.position },
              facingAngle: performer.facingAngle,
            },
            end: {
              position: { ...end.position },
              facingAngle: end.facingAngle,
            },
            startVelocity:
              carriedVelocities.get(performer.id) ?? zeroLayoutVelocity(),
          },
        ];
      }),
    };

    return timing;
  }

  function cancelFormationTransition(nowMs: number = performance.now()): void {
    sampleLayoutTransition(nowMs);
    activeLayoutTransition = null;
    formationManager.cancelTransition();
  }

  /**
   * Resolve every performer's destination under the active formation.
   * Presets with a smaller fixed cast fall back to the same centered layout
   * used before this transition work, so counts five through eight remain
   * deterministic.
   */
  function resolveLayoutTargets(): PerformerLayoutSnapshot[] {
    formationManager.setPerformerCount(performerStates.length);

    const formation = formationManager.currentFormation;
    const positions = formationManager.getAllPerformerPositions();
    const defaults = getDefaultPositions(performerStates.length);
    const coversAll = positions.length >= performerStates.length;

    return performerStates.map((performer, index) => {
      if (coversAll) {
        const target = positions.find((position) => position.index === index);
        if (target) {
          const slot = formation.slots.find(
            (candidate) => candidate.index === index
          );
          return {
            position: { ...target.position },
            facingAngle: resolveViewerFormationFacingAngle(
              slot,
              formation,
              target.facingAngle
            ),
          };
        }
      }

      const fallback = defaults[index] ?? performer.position;
      return {
        position: { ...fallback },
        facingAngle: resolveViewerFormationFacingAngle(
          undefined,
          formation,
          performer.facingAngle
        ),
      };
    });
  }

  /**
   * A new performer appears directly in its destination while the existing
   * cast glides out of the way. On removal, the remaining cast starts from
   * the exact positions visible in the previous frame and closes the gap.
   */
  function transitionAfterCountChange(
    previousLayout: Map<string, PerformerLayoutSnapshot>,
    carriedVelocities: ReadonlyMap<string, PerformerLayoutVelocity>,
    nowMs: number
  ): PerformerLayoutSnapshot[] {
    formationManager.cancelTransition();
    const targets = resolveLayoutTargets();

    performerStates.forEach((performer, index) => {
      if (previousLayout.has(performer.id)) return;
      const target = targets[index];
      if (!target) return;
      performer.position.x = target.position.x;
      performer.position.z = target.position.z;
      performer.setFacingAngle(target.facingAngle);
    });
    beginLayoutTransition(
      targets,
      COUNT_CHANGE_TRANSITION_MS,
      carriedVelocities,
      nowMs
    );
    return targets;
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
    activeLayoutTransition = null;
    formationManager.cancelTransition();
    const targets = resolveLayoutTargets();
    performerStates.forEach((performer, i) => {
      const target = targets[i];
      if (!target) return;
      performer.position.x = target.position.x;
      performer.position.z = target.position.z;
      performer.setFacingAngle(target.facingAngle);
    });
  }

  /**
   * Apply a formation preset (immediately, no transition)
   */
  function applyFormationPreset(preset: FormationPreset) {
    activeLayoutTransition = null;
    formationManager.applyPreset(preset);
    updatePositions();
  }

  /**
   * Transition to a formation preset (smooth animation)
   */
  function transitionToFormation(
    preset: FormationPreset,
    durationMs: number = 500
  ) {
    const nowMs = performance.now();
    const carriedVelocities = sampleLayoutTransition(nowMs);
    formationManager.cancelTransition();
    formationManager.applyPreset(preset);
    const targets = resolveLayoutTargets();
    beginLayoutTransition(targets, durationMs, carriedVelocities, nowMs);
  }

  /**
   * Update formation transition (called each frame when transitioning).
   * Uses the same default-layout fallback as updatePositions - if the
   * target preset doesn't cover an index, that performer stays at its
   * default row-pair slot instead of drifting.
   */
  function updateFormationTransition(timestamp?: number) {
    sampleLayoutTransition(timestamp ?? performance.now());
  }

  /**
   * Add a new performer
   */
  function addPerformer(): PerformerLayoutSnapshot[] | null {
    if (performerStates.length >= maxPerformers) return null;

    const nowMs = performance.now();
    const carriedVelocities = sampleLayoutTransition(nowMs);
    const previousLayout = captureLayout();
    const newPerformer = createPerformer(performerStates.length);
    performerStates = [...performerStates, newPerformer];
    const layoutTargets = transitionAfterCountChange(
      previousLayout,
      carriedVelocities,
      nowMs
    );

    // Create sync state when we have exactly 2 performers
    if (performerStates.length === 2) {
      const first = performerStates[0];
      const second = performerStates[1];
      if (first && second) {
        syncState?.destroy();
        syncState = createAvatarSyncState(first, second);
      }
    }

    return layoutTargets;
  }

  /**
   * Remove a performer. Existing callers that omit an index retain the
   * original remove-last behavior used by snapshot restoration.
   */
  function removePerformer(
    index = performerStates.length - 1
  ): PerformerLayoutSnapshot[] | null {
    if (performerStates.length <= 1) return null;
    if (index < 0 || index >= performerStates.length) return null;

    const nowMs = performance.now();
    const carriedVelocities = sampleLayoutTransition(nowMs);
    const previousLayout = captureLayout();
    const removed = performerStates[index];
    if (!removed) return null;
    removed.destroy();

    performerStates = performerStates.filter(
      (_, performerIndex) => performerIndex !== index
    );
    const layoutTargets = transitionAfterCountChange(
      previousLayout,
      carriedVelocities,
      nowMs
    );

    // Adjust active index if needed
    if (activePerformerIndex >= performerStates.length) {
      activePerformerIndex = performerStates.length - 1;
    }

    // Removing either member of the synchronized pair changes its owners.
    syncState?.destroy();
    const first = performerStates[0];
    const second = performerStates[1];
    if (first && second) {
      syncState = createAvatarSyncState(first, second);
    } else {
      syncState = null;
    }

    return layoutTargets;
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
    cancelFormationTransition();
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
    while (
      performerStates.length < count &&
      performerStates.length < maxPerformers
    ) {
      addPerformer();
    }
  }

  /**
   * Clean up all performers
   */
  function destroy() {
    activeLayoutTransition = null;
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
      return activeLayoutTransition !== null;
    },
    get formationTransitionTiming(): TimedTransition | null {
      return activeLayoutTransition?.timing ?? null;
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
    cancelFormationTransition,
  };
}

export type PerformerManager = ReturnType<typeof buildPerformerManager>;

export function createPerformerManager(
  deps: PerformerManagerDeps
): PerformerManager {
  return buildPerformerManager(deps);
}
