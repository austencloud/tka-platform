/**
 * LayerKeyDeriver
 *
 * Generates cache keys for individual layers.
 *
 * CRITICAL: Base layer keys EXCLUDE all visibility settings.
 * This allows the base layer cache to survive ALL visibility toggles.
 *
 * Key structure:
 * - Base: includes motions, props, darkMode, size
 *         (contains: background, center point, outer corner points, props, arrows)
 *         (EXCLUDES: TKA, reversals, hand points, layer 2 points)
 * - GridPoints: includes showNonRadialPoints, handPointVisibility, gridMode, size
 *         (contains: hand points, layer 2 points)
 * - TKA: includes letter, turnsTuple, motionTypes, darkMode, size (SHARED across pictographs with same arrangement!)
 * - Reversal: includes blueReversal, redReversal, size (only 4 states possible)
 * - Beat: includes stepNumber, size (simple text, rarely cached)
 *
 * Behavior:
 * - TKA toggle: base layer cache HIT (instant)
 * - Reversal toggle: base layer cache HIT (instant)
 * - Grid toggle: base layer cache HIT (instant) - only gridPoints layer re-renders
 */

import type { PreparedPictographData } from "../../../pictograph/shared/domain/models/PreparedPictographData";
import type { StepData } from "../../../../features/create/shared/domain/models/StepData";
import type { LayerRenderOptions, LayerType } from "../contracts/ILayerCompositor";

export interface BaseLayerKeyComponents {
  // Motion hash (identifies the pictograph's movements)
  motionHash: string;
  // Prop types (affects rendering)
  bluePropType: string;
  redPropType: string;
  // Visual settings
  darkMode: boolean;
  // Size
  size: number;
  // Per-color motion visibility — renderer skips hidden motions
  showBlueMotion: boolean;
  showRedMotion: boolean;
  // VTG/elemental/positions glyphs are baked into the base layer, so they
  // contribute to the cache key. Toggling any invalidates only those pictographs
  // that actually change visually (same letter/motions re-use the same blob).
  showVTG: boolean;
  showElemental: boolean;
  showPositions: boolean;
  // NOTE: The following are EXCLUDED from base layer key:
  // - showNonRadialPoints, handPointVisibility → rendered in gridPoints layer
  // - showTKA → rendered in TKA overlay
  // - showReversals → rendered in reversal overlay
  // This allows the base layer cache to survive ALL visibility toggles.
}

export interface GridPointsLayerKeyComponents {
  // Grid point visibility settings
  showNonRadialPoints: boolean;
  handPointVisibility: "all" | "active";
  // Grid mode affects which points exist
  gridMode: string;
  // Visual mode — grid point colors differ between dark and light
  darkMode: boolean;
  // Size
  size: number;
}

export interface TKALayerKeyComponents {
  // Letter identity (e.g., "A", "B", etc.)
  letter: string;
  // Turns tuple (e.g., "(s, 0, 1.5)")
  turnsTuple: string;
  // Motion types per hand — determines turn number colors
  // (e.g., blue=pro/red=anti vs blue=anti/red=pro produce different color assignments)
  blueMotionType: string;
  redMotionType: string;
  // Visual mode
  darkMode: boolean;
  // Size
  size: number;
}

export interface ReversalLayerKeyComponents {
  blueReversal: boolean;
  redReversal: boolean;
  size: number;
}

export interface StepLayerKeyComponents {
  stepNumber: number;
  darkMode: boolean;
  size: number;
}

export class LayerKeyDeriver {
  /**
   * Derive cache key for base layer
   *
   * IMPORTANT: This key intentionally EXCLUDES showTKA and showReversals.
   * The base layer is the same regardless of overlay visibility.
   */
  deriveBaseLayerKey(
    pictograph: PreparedPictographData,
    options: LayerRenderOptions
  ): string {
    const components = this.getBaseLayerComponents(pictograph, options);
    return `base:${this.hashComponents(components)}`;
  }

  /**
   * Get base layer key components (for debugging/inspection)
   *
   * EXCLUDED from base layer (rendered as separate layers):
   * - Grid point settings (showNonRadialPoints, handPointVisibility) → gridPoints layer
   * - TKA settings → TKA overlay
   * - Reversal settings → reversal overlay
   *
   * This allows the base layer cache to survive ALL visibility toggles.
   */
  getBaseLayerComponents(
    pictograph: PreparedPictographData,
    options: LayerRenderOptions
  ): BaseLayerKeyComponents {
    return {
      motionHash: this.deriveMotionHash(pictograph),
      bluePropType: options.bluePropType ?? pictograph.motions?.blue?.propType ?? "staff",
      redPropType: options.redPropType ?? pictograph.motions?.red?.propType ?? "staff",
      darkMode: options.darkMode,
      size: options.size,
      showBlueMotion: options.showBlueMotion ?? true,
      showRedMotion: options.showRedMotion ?? true,
      showVTG: options.showVTG ?? false,
      showElemental: options.showElemental ?? false,
      showPositions: options.showPositions ?? false,
    };
  }

  /**
   * Derive cache key for grid points overlay
   *
   * Grid dots are rendered separately so toggling hand point visibility
   * doesn't require re-rendering the entire base layer (props, arrows).
   */
  deriveGridPointsLayerKey(
    pictograph: PreparedPictographData,
    options: LayerRenderOptions
  ): string {
    const components = this.getGridPointsLayerComponents(pictograph, options);
    return `grid:${this.hashComponents(components)}`;
  }

  /**
   * Get grid points layer key components
   */
  getGridPointsLayerComponents(
    pictograph: PreparedPictographData,
    options: LayerRenderOptions
  ): GridPointsLayerKeyComponents {
    const prepared = pictograph._prepared;
    return {
      showNonRadialPoints: options.showNonRadialPoints,
      handPointVisibility: options.handPointVisibility,
      gridMode: prepared?.gridMode ?? "diamond",
      darkMode: options.darkMode,
      size: options.size,
    };
  }

  /**
   * Derive cache key for TKA overlay
   *
   * Key insight: TKA overlays can be SHARED across pictographs!
   * Same letter + same turns = same visual overlay.
   */
  deriveTKALayerKey(
    pictograph: PreparedPictographData,
    turnsTuple: string,
    options: Pick<LayerRenderOptions, "size" | "darkMode">
  ): string {
    const components = this.getTKALayerComponents(pictograph, turnsTuple, options);
    return `tka:${this.hashComponents(components)}`;
  }

  /**
   * Get TKA layer key components
   *
   * Includes motionType per hand because turn number colors depend on
   * which hand is pro vs anti (TYPE1_HYBRID), shift vs static (TYPE2), etc.
   * Without this, beats with swapped hand assignments share the wrong cached colors.
   */
  getTKALayerComponents(
    pictograph: PreparedPictographData,
    turnsTuple: string,
    options: Pick<LayerRenderOptions, "size" | "darkMode">
  ): TKALayerKeyComponents {
    return {
      letter: String(pictograph.letter ?? ""),
      turnsTuple,
      blueMotionType: pictograph.motions?.blue?.motionType ?? "",
      redMotionType: pictograph.motions?.red?.motionType ?? "",
      darkMode: options.darkMode,
      size: options.size,
    };
  }

  /**
   * Derive cache key for reversal overlay
   *
   * Only 4 possible states: none, blue, red, both
   */
  deriveReversalLayerKey(stepData: StepData, size: number): string {
    const components = this.getReversalLayerComponents(stepData, size);
    return `rev:${components.blueReversal ? "b" : ""}${components.redReversal ? "r" : ""}_${size}`;
  }

  /**
   * Get reversal layer key components
   */
  getReversalLayerComponents(stepData: StepData, size: number): ReversalLayerKeyComponents {
    return {
      blueReversal: stepData.blueReversal ?? false,
      redReversal: stepData.redReversal ?? false,
      size,
    };
  }

  /**
   * Derive cache key for beat number overlay
   */
  deriveBeatLayerKey(stepNumber: number, darkMode: boolean, size: number): string {
    return `beat:${stepNumber}_${darkMode ? "d" : "l"}_${size}`;
  }

  /**
   * Derive a hash representing the motion state
   *
   * This captures everything about the pictograph that affects
   * the base layer rendering (props, arrows, positions).
   */
  private deriveMotionHash(pictograph: PreparedPictographData): string {
    const blueMotion = pictograph.motions?.blue;
    const redMotion = pictograph.motions?.red;

    // Build a deterministic string from motion data
    const parts: string[] = [];

    if (blueMotion) {
      parts.push(`b:${blueMotion.motionType ?? ""}:${blueMotion.startLocation ?? ""}:${blueMotion.endLocation ?? ""}`);
      parts.push(`bt:${blueMotion.turns ?? 0}:${blueMotion.rotationDirection ?? ""}`);
      parts.push(`bo:${blueMotion.startOrientation ?? ""}:${blueMotion.endOrientation ?? ""}`);
    }

    if (redMotion) {
      parts.push(`r:${redMotion.motionType ?? ""}:${redMotion.startLocation ?? ""}:${redMotion.endLocation ?? ""}`);
      parts.push(`rt:${redMotion.turns ?? 0}:${redMotion.rotationDirection ?? ""}`);
      parts.push(`ro:${redMotion.startOrientation ?? ""}:${redMotion.endOrientation ?? ""}`);
    }

    // Include grid mode if available
    const prepared = pictograph._prepared;
    if (prepared?.gridMode) {
      parts.push(`g:${prepared.gridMode}`);
    }

    return this.simpleHash(parts.join("|"));
  }

  /**
   * Hash an object into a short string
   */
  private hashComponents(obj: object): string {
    const str = JSON.stringify(obj, Object.keys(obj).sort());
    return this.simpleHash(str);
  }

  /**
   * Simple string hash (same as used elsewhere in codebase)
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
    }
    return hash.toString(36);
  }
}
