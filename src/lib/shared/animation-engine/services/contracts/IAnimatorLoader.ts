/**
 * Animator Loader Interface
 *
 * Handles lazy loading of animator-related services.
 * Provides access to core animation dependencies.
 */

import type { IAnimationRenderer } from "$lib/features/compose/services/contracts/IAnimationRenderer";
import type { ISVGGenerator } from "$lib/features/compose/services/contracts/ISVGGenerator";
import type { ITrailCapturer } from "$lib/features/compose/services/contracts/ITrailCapturer";
import type { ISequenceAnimationOrchestrator } from "$lib/features/compose/services/contracts/ISequenceAnimationOrchestrator";
import type { ITurnsTupleGenerator } from "$lib/shared/pictograph/arrow/positioning/placement/services/contracts/ITurnsTupleGenerator";
import type { ISettingsState } from "$lib/shared/settings/services/contracts/ISettingsState";

/**
 * Core animator services bundle
 */
export interface AnimatorServices {
  svgGenerator: ISVGGenerator;
  settingsService: ISettingsState;
  orchestrator: ISequenceAnimationOrchestrator;
  TrailCapturer: ITrailCapturer;
  turnsTupleGenerator: ITurnsTupleGenerator;
}

/**
 * Result of loading animator services
 */
export type AnimatorServiceLoadResult =
  | { success: true; services: AnimatorServices }
  | { success: false; error: string };

/**
 * Result of loading animation renderer
 */
export type AnimationRendererLoadResult =
  | { success: true; renderer: IAnimationRenderer }
  | { success: false; error: string };

/** @deprecated Use AnimationRendererLoadResult instead */
export type PixiLoadResult = AnimationRendererLoadResult;

/**
 * Service for loading animator-related dependencies
 */
export interface IAnimatorLoader {
  /**
   * Load core animator services.
   * Does NOT load renderer - that's handled separately.
   */
  loadAnimatorServices(): AnimatorServiceLoadResult;

  /**
   * Load animation renderer.
   */
  loadAnimationRenderer(): AnimationRendererLoadResult;

  /** @deprecated Use loadAnimationRenderer() instead */
  loadPixiRenderer(): AnimationRendererLoadResult;
}
