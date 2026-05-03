/**
 * Animation Visibility Sync Service Implementation
 *
 * Provides a clean interface for components to subscribe to all
 * animation visibility settings at once.
 */

import { getAnimationVisibilityManager, type AnimationVisibilityStateManager } from "../../state/animation-visibility-state.svelte";
import type {
  IAnimationVisibilitySynchronizer,
  AnimationVisibilityState,
  VisibilityStateCallback,
} from "../contracts/IAnimationVisibilitySynchronizer";

export class AnimationVisibilitySynchronizer {
  private manager: AnimationVisibilityStateManager;
  private callbacks: Set<VisibilityStateCallback> = new Set();
  private boundObserver: () => void;

  constructor(managerOverride?: AnimationVisibilityStateManager) {
    this.manager = managerOverride ?? getAnimationVisibilityManager();
    this.boundObserver = () => this.notifySubscribers();
    this.manager.registerObserver(this.boundObserver);
  }

  getState(): AnimationVisibilityState {
    return {
      grid: this.manager.isGridVisible(),
      stepNumbers: this.manager.getVisibility("stepNumbers"),
      props: this.manager.getVisibility("props"),
      trails: this.manager.isTrailsActive(),
      tkaGlyph: this.manager.getVisibility("tkaGlyph"), // TKA Glyph includes turn numbers
      darkMode: this.manager.isDarkMode(),
      wordHeader: this.manager.getVisibility("wordHeader"),
      activeEffect: this.manager.getActiveEffect(),
      tipEffectMap: this.manager.getTipEffectMap(),
    };
  }

  subscribe(callback: VisibilityStateCallback): () => void {
    this.callbacks.add(callback);
    // Immediately call with current state
    callback(this.getState());

    // Return unsubscribe function
    return () => {
      this.callbacks.delete(callback);
    };
  }

  dispose(): void {
    this.manager.unregisterObserver(this.boundObserver);
    this.callbacks.clear();
  }

  private notifySubscribers(): void {
    const state = this.getState();
    this.callbacks.forEach((callback) => {
      try {
        callback(state);
      } catch (error) {
        console.error(
          "[AnimationVisibilitySynchronizer] Error in callback:",
          error
        );
      }
    });
  }
}
