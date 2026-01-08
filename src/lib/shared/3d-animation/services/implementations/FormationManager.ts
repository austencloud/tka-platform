/**
 * FormationManager Implementation
 *
 * Manages performer formations with smooth transitions.
 * Uses Svelte 5 runes for reactive state management.
 *
 * Note: This is a factory function, not an injectable class,
 * because each Viewer3D instance needs its own formation state.
 */

import {
  type Formation,
  type FormationPreset,
  type FormationTransition,
  type Position2D,
  calculateFacingAngle,
  lerpPosition,
  lerpAngle,
} from "../../domain/formation";

import {
  createFormationFromPreset,
  getDefaultFormation,
} from "../../config/formation-presets";

import type {
  IFormationManager,
  PerformerFormationState,
  FormationChangeCallback,
  TransitionUpdateCallback,
} from "../contracts/IFormationManager";

/**
 * Easing function for smooth transitions (ease-in-out cubic)
 */
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * Create a FormationManager instance with reactive state
 */
export function createFormationManager(
  initialPerformerCount: number = 1
): IFormationManager {
  // Internal state using Svelte 5 runes would be ideal,
  // but for now we use plain mutable state since this is a service
  let performerCount = Math.max(1, Math.min(4, initialPerformerCount));
  let currentFormation = getDefaultFormation(performerCount);
  let activeTransition: FormationTransition | null = null;

  // Callbacks
  const formationChangeCallbacks = new Set<FormationChangeCallback>();
  const transitionUpdateCallbacks = new Set<TransitionUpdateCallback>();

  /**
   * Notify formation change subscribers
   */
  function notifyFormationChange(): void {
    for (const callback of formationChangeCallbacks) {
      callback(currentFormation);
    }
  }

  /**
   * Notify transition update subscribers
   */
  function notifyTransitionUpdate(): void {
    const positions = getAllPerformerPositions();
    for (const callback of transitionUpdateCallbacks) {
      callback(positions);
    }
  }

  /**
   * Get position for a performer from a formation
   */
  function getPositionFromFormation(
    formation: Formation,
    index: number
  ): PerformerFormationState | null {
    const slot = formation.slots.find((s) => s.index === index);
    if (!slot) return null;

    return {
      index,
      position: { ...slot.position },
      facingAngle: calculateFacingAngle(slot, formation),
    };
  }

  /**
   * Get all performer positions from a formation
   */
  function getAllPositionsFromFormation(
    formation: Formation
  ): PerformerFormationState[] {
    return formation.slots.map((slot) => ({
      index: slot.index,
      position: { ...slot.position },
      facingAngle: calculateFacingAngle(slot, formation),
    }));
  }

  /**
   * Get interpolated position during transition
   */
  function getInterpolatedPosition(
    fromFormation: Formation,
    toFormation: Formation,
    index: number,
    progress: number
  ): PerformerFormationState | null {
    const fromState = getPositionFromFormation(fromFormation, index);
    const toState = getPositionFromFormation(toFormation, index);

    if (!fromState) return toState;
    if (!toState) return fromState;

    const t = easeInOutCubic(progress);

    return {
      index,
      position: lerpPosition(fromState.position, toState.position, t),
      facingAngle: lerpAngle(fromState.facingAngle, toState.facingAngle, t),
    };
  }

  /**
   * Get performer position (handles transition interpolation)
   */
  function getPerformerPosition(
    index: number
  ): PerformerFormationState | null {
    if (activeTransition) {
      return getInterpolatedPosition(
        activeTransition.from,
        activeTransition.to,
        index,
        activeTransition.progress
      );
    }

    return getPositionFromFormation(currentFormation, index);
  }

  /**
   * Get all performer positions (handles transition interpolation)
   */
  function getAllPerformerPositions(): PerformerFormationState[] {
    const positions: PerformerFormationState[] = [];

    for (let i = 0; i < performerCount; i++) {
      const pos = getPerformerPosition(i);
      if (pos) positions.push(pos);
    }

    return positions;
  }

  // Return the manager interface
  const manager: IFormationManager = {
    get currentFormation() {
      return currentFormation;
    },

    get performerCount() {
      return performerCount;
    },

    get isTransitioning() {
      return activeTransition !== null;
    },

    get transitionProgress() {
      return activeTransition?.progress ?? 0;
    },

    get activeTransition() {
      return activeTransition;
    },

    setPerformerCount(count: number): void {
      const newCount = Math.max(1, Math.min(4, count));
      if (newCount === performerCount) return;

      performerCount = newCount;

      // Update current formation with new performer count
      currentFormation = createFormationFromPreset(
        currentFormation.preset,
        performerCount
      );

      notifyFormationChange();
    },

    applyPreset(preset: FormationPreset): void {
      currentFormation = createFormationFromPreset(preset, performerCount);
      activeTransition = null;
      notifyFormationChange();
    },

    applyFormation(formation: Formation): void {
      currentFormation = formation;
      activeTransition = null;
      notifyFormationChange();
    },

    transitionToPreset(preset: FormationPreset, durationMs: number): void {
      const targetFormation = createFormationFromPreset(preset, performerCount);
      this.transitionTo(targetFormation, durationMs);
    },

    transitionTo(formation: Formation, durationMs: number): void {
      activeTransition = {
        from: currentFormation,
        to: formation,
        progress: 0,
        duration: durationMs,
        startTime: performance.now(),
      };
    },

    cancelTransition(): void {
      if (activeTransition) {
        currentFormation = activeTransition.to;
        activeTransition = null;
        notifyFormationChange();
      }
    },

    getPerformerPosition,

    getAllPerformerPositions,

    captureCurrentAsFormation(name: string): Formation {
      const positions = getAllPerformerPositions();

      return {
        id: `custom-${Date.now()}`,
        name,
        preset: "custom",
        facingMode: "custom",
        slots: positions.map((p) => ({
          index: p.index,
          position: { ...p.position },
          facingAngle: p.facingAngle,
        })),
        spacing: currentFormation.spacing,
        centerOffset: { ...currentFormation.centerOffset },
      };
    },

    updateTransition(timestamp: number): void {
      if (!activeTransition) return;

      const elapsed = timestamp - activeTransition.startTime;
      const progress = Math.min(1, elapsed / activeTransition.duration);

      activeTransition = {
        ...activeTransition,
        progress,
      };

      // Check if transition is complete
      if (progress >= 1) {
        currentFormation = activeTransition.to;
        activeTransition = null;
        notifyFormationChange();
      } else {
        notifyTransitionUpdate();
      }
    },

    onFormationChange(callback: FormationChangeCallback): () => void {
      formationChangeCallbacks.add(callback);
      return () => formationChangeCallbacks.delete(callback);
    },

    onTransitionUpdate(callback: TransitionUpdateCallback): () => void {
      transitionUpdateCallbacks.add(callback);
      return () => transitionUpdateCallbacks.delete(callback);
    },
  };

  return manager;
}
