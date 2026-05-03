/**
 * Animation Visibility Sync Types
 *
 * Co-exported types for the animation visibility system.
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

