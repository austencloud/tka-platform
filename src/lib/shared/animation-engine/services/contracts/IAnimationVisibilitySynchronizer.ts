/**
 * Animation Visibility Sync Service Interface
 *
 * Provides a clean interface for components to subscribe to all
 * animation visibility settings at once, eliminating repetitive
 * individual state variable syncing.
 */

import type { EffectType, TipEffectMap } from "../../domain/types/TipEffectTypes";

/**
 * All visibility settings as a single object
 */
export interface AnimationVisibilityState {
  grid: boolean;
  stepNumbers: boolean;
  props: boolean;
  trails: boolean;
  tkaGlyph: boolean; // TKA Glyph includes turn numbers
  /** Dark Mode: dark background, inverted grid, white text/outlines */
  darkMode: boolean;
  /** Word header overlay showing sequence name */
  wordHeader: boolean;
  activeEffect: EffectType;
  tipEffectMap: TipEffectMap;
}

/**
 * Callback for visibility state changes
 */
export type VisibilityStateCallback = (state: AnimationVisibilityState) => void;

/**
 * Service for syncing animation visibility state
 */
export interface IAnimationVisibilitySynchronizer {
  /**
   * Get current visibility state
   */
  getState(): AnimationVisibilityState;

  /**
   * Subscribe to visibility changes
   * @returns Unsubscribe function
   */
  subscribe(callback: VisibilityStateCallback): () => void;

  /**
   * Clean up resources
   */
  dispose(): void;
}
